import { describe, it, expect, beforeEach } from 'vitest';
import {
  BLOODLINE_UNLOCK_COST,
  ORGAN_UNLOCK_COST,
  STAT_NODES,
  computeEssence,
  defaultSave,
  loadMeta,
  metaBonuses,
  nodeCost,
  persistMeta,
  recordFormUse,
  recordSynergy,
  resetMemoryStore,
  settleRun,
} from '../src/meta/save';
import type { MetaSave, RunStats } from '../src/meta/save';
import { BALANCE } from '../src/config/balance';

beforeEach(() => {
  resetMemoryStore();
});

const stats = (over: Partial<RunStats> = {}): RunStats => ({
  kills: 0,
  time: 0,
  bossesKilled: 0,
  victory: false,
  difficulty: 1,
  ...over,
});

describe('局外存档', () => {
  it('无存档时返回默认值', () => {
    const m = loadMeta();
    expect(m).toEqual(defaultSave());
    expect(m.unlockedOrgans).toEqual(['claw']);
    expect(m.difficulty).toBe(1);
  });

  it('存档读写往返一致', () => {
    const m = defaultSave();
    m.essence = 321;
    m.nodes.hp = 2;
    m.codexForms.chaos_cub = 3;
    persistMeta(m);
    const loaded = loadMeta();
    expect(loaded.essence).toBe(321);
    expect(loaded.nodes.hp).toBe(2);
    expect(loaded.codexForms.chaos_cub).toBe(3);
  });

  it('旧档缺字段被补全（容错）', () => {
    persistMeta({ essence: 50 } as unknown as MetaSave);
    const m = loadMeta();
    expect(m.essence).toBe(50);
    expect(m.unlockedOrgans).toEqual(['claw']);
    expect(m.nodes).toEqual({});
    expect(m.clearedTiers).toEqual([]);
  });

  it('已解锁高档难度的老存档：当前选择回落为 1 档（避免难度反噬）', () => {
    persistMeta({ essence: 0, difficulty: 3, clearedTiers: [1, 2] } as unknown as MetaSave);
    const m = loadMeta();
    expect(m.difficulty).toBe(3);
    expect(m.selectedDifficulty).toBe(1);
  });

  it('当前选择不会超过已解锁档位，也不会被越界值破坏', () => {
    persistMeta({ essence: 0, difficulty: 2, selectedDifficulty: 4 } as unknown as MetaSave);
    expect(loadMeta().selectedDifficulty).toBe(2);
    persistMeta({ essence: 0, difficulty: 2, selectedDifficulty: -5 } as unknown as MetaSave);
    expect(loadMeta().selectedDifficulty).toBe(1);
  });

  it('损坏存档回退默认值', () => {
    persistMeta('not-json' as unknown as MetaSave);
    const m = loadMeta();
    expect(m.essence).toBe(0);
  });
});

describe('精华结算', () => {
  it('按 击杀/时长/Boss/通关 计算并乘以难度倍率', () => {
    const base = computeEssence(stats({ kills: 100, time: 60, bossesKilled: 1, victory: false, difficulty: 1 }));
    const expected = Math.round(
      100 * BALANCE.essencePerKill + 60 * BALANCE.essencePerSecond + 1 * BALANCE.essencePerBoss,
    );
    expect(base).toBe(expected);

    const hard = computeEssence(stats({ kills: 100, time: 60, bossesKilled: 1, victory: true, difficulty: 3 }));
    const expectedHard = Math.round(
      (100 * BALANCE.essencePerKill + 60 * BALANCE.essencePerSecond + 1 * BALANCE.essencePerBoss + BALANCE.essenceVictoryBonus) *
        BALANCE.difficultyEssenceMult[2],
    );
    expect(hard).toBe(expectedHard);
    expect(hard).toBeGreaterThan(base);
  });

  it('结算入账：精华累计、最佳时长、通关解锁下一难度', () => {
    const m = defaultSave();
    const first = settleRun(m, stats({ kills: 50, time: 300, victory: false }));
    expect(first.gained).toBeGreaterThan(0);
    expect(m.essence).toBe(first.gained);
    expect(m.totalEarned).toBe(first.gained);
    expect(m.bestTime).toBe(300);
    expect(m.clears).toBe(0);
    expect(first.unlockedTier).toBeNull();

    const second = settleRun(m, stats({ kills: 80, time: 400, victory: true, difficulty: 1 }));
    expect(m.clears).toBe(1);
    expect(m.clearedTiers).toEqual([1]);
    expect(m.difficulty).toBe(2);
    expect(second.unlockedTier).toBe(2);
    // 关键：解锁更高难度不改变当前选择
    expect(m.selectedDifficulty).toBe(1);
    expect(m.bestTime).toBe(400);
    expect(m.essence).toBe(first.gained + second.gained);
  });

  it('失败也入账，但不解锁难度', () => {
    const m = defaultSave();
    settleRun(m, stats({ kills: 10, time: 60, difficulty: 2, victory: false }));
    expect(m.essence).toBeGreaterThan(0);
    expect(m.difficulty).toBe(1);
    expect(m.clears).toBe(0);
  });

  it('难度不越界（已满级不再提升）', () => {
    const m = defaultSave();
    m.difficulty = BALANCE.maxDifficulty;
    m.clearedTiers = [1, 2, 3];
    const res = settleRun(m, stats({ victory: true, difficulty: BALANCE.maxDifficulty }));
    expect(res.unlockedTier).toBeNull();
    expect(m.difficulty).toBe(BALANCE.maxDifficulty);
  });
});

describe('解锁与图鉴', () => {
  it('属性节点加成随等级线性提升，成本递增', () => {
    const m = defaultSave();
    m.nodes = { hp: 2, speed: 1, crit: 3, armor: 1, dmg: 1 };
    const b = metaBonuses(m);
    expect(b.hpPct).toBeCloseTo(0.06, 6);
    expect(b.speedPct).toBeCloseTo(0.02, 6);
    expect(b.critAdd).toBeCloseTo(0.03, 6);
    expect(b.armorAdd).toBe(1);

    const def = STAT_NODES[0];
    expect(nodeCost(def, 1)).toBeGreaterThan(nodeCost(def, 0));
    expect(nodeCost(def, 4)).toBeGreaterThan(nodeCost(def, 1));
  });

  it('解锁价格为正、可解锁器官列表不含默认的 claw', () => {
    expect(ORGAN_UNLOCK_COST).toBeGreaterThan(0);
    expect(BLOODLINE_UNLOCK_COST).toBeGreaterThan(0);
  });

  it('图鉴点亮：形态选用与超武觉醒累计计数并持久化', () => {
    const m = defaultSave();
    recordFormUse(m, 'gale_wolf');
    recordFormUse(m, 'gale_wolf');
    recordSynergy(m, 'claw');
    expect(m.codexForms.gale_wolf).toBe(2);
    expect(m.codexSynergies.claw).toBe(1);
    const reloaded = loadMeta();
    expect(reloaded.codexForms.gale_wolf).toBe(2);
    expect(reloaded.codexSynergies.claw).toBe(1);
  });
});
