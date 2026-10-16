import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { generateUpgradeChoices, matchTop3FormsForStage } from '../src/progression/choices';

describe('升级三选一与 9 选 3 形态匹配', () => {
  it('器官满级且配对被动机因已拥有 → 出现超武共鸣选项', () => {
    const world = createWorld();
    world.player.organs = [{ id: 'claw', level: 5, evolved: false, timer: 0 }];
    world.player.passives = [{ id: 'fang', level: 1 }];
    const choices = generateUpgradeChoices(world);
    expect(choices.some((c) => c.type === 'synergy' && c.organId === 'claw')).toBe(true);
  });

  it('未满级或缺配对被动 → 不出现超武选项', () => {
    const world = createWorld();
    world.player.organs = [{ id: 'claw', level: 4, evolved: false, timer: 0 }];
    world.player.passives = [{ id: 'fang', level: 1 }];
    expect(generateUpgradeChoices(world).some((c) => c.type === 'synergy')).toBe(false);

    const world2 = createWorld();
    world2.player.organs = [{ id: 'claw', level: 5, evolved: false, timer: 0 }];
    world2.player.passives = [];
    expect(generateUpgradeChoices(world2).some((c) => c.type === 'synergy')).toBe(false);
  });

  it('始终返回 3 项；卡组全满且无超武可觉醒时以太古祖血兜底', () => {
    const world = createWorld();
    const p = world.player;
    // 器官全部已觉醒（不再满足超武条件）、被动全部满级：普通池与超武池均为空
    p.organs = ['claw', 'venom', 'horn', 'spikes', 'firesac', 'frost_b'].map((id) => ({ id, level: 5, evolved: true, timer: 0 }));
    p.passives = ['fang', 'blood_s', 'nerve', 'carapace', 'core', 'crystal'].map((id) => ({ id, level: 5 }));
    const choices = generateUpgradeChoices(world);
    expect(choices.length).toBe(3);
    expect(choices.every((c) => c.type === 'heal')).toBe(true);
  });

  it('卡组上限：拥有 6 个器官时不再出现新器官选项', () => {
    const world = createWorld();
    const p = world.player;
    p.organs = ['claw', 'venom', 'horn', 'spikes', 'firesac', 'frost_b'].map((id) => ({ id, level: 3, evolved: false, timer: 0 }));
    p.passives = [];
    const choices = generateUpgradeChoices(world);
    for (const c of choices) {
      if (c.type === 'active') {
        // 只能是对已有器官的升级（nextLv 对应已有等级 +1）
        const owned = p.organs.find((o) => o.id === c.def.id);
        expect(owned).toBeDefined();
      }
    }
  });

  it('matchTop3FormsForStage 只从目标阶级取 3 个形态', () => {
    const world = createWorld();
    for (let stage = 2; stage <= 5; stage++) {
      const result = matchTop3FormsForStage(world, stage);
      expect(result.length).toBe(3);
      for (const entry of result) {
        expect(entry.form.stage).toBe(stage);
        expect(entry.matchPct).toBeGreaterThanOrEqual(45);
        expect(entry.matchPct).toBeLessThanOrEqual(99);
      }
    }
  });
});
