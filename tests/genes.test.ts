import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { recalculateStatsAndGenes } from '../src/progression/genes';

describe('九大基因亲和度与属性重算', () => {
  it('初始混沌幼崽：真身标签 dark/blood 各 +2，利爪 wind/blood 各 +1', () => {
    const world = createWorld();
    recalculateStatsAndGenes(world);
    const g = world.player.geneCounts;
    expect(g.dark).toBe(2);
    expect(g.blood).toBe(3);
    expect(g.wind).toBe(1);
    expect(g.fire).toBe(0);
    expect(g.thunder).toBe(0);
  });

  it('超武器官 = 等级 + 3，被动基因 = 等级 × 2', () => {
    const world = createWorld();
    const p = world.player;
    p.organs = [{ id: 'claw', level: 5, evolved: true, timer: 0 }];
    p.passives = [{ id: 'fang', level: 3 }];
    recalculateStatsAndGenes(world);
    // claw: wind/blood += 5+3=8；fang: blood += 6；真身 dark/blood +2
    expect(p.geneCounts.wind).toBe(8);
    expect(p.geneCounts.blood).toBe(2 + 8 + 6);
    expect(p.geneCounts.dark).toBe(2);
  });

  it('属性公式：甲壳加护甲与气血、心脏加气血、羽毛加速度、肌肉加体型', () => {
    const world = createWorld();
    const p = world.player;
    p.passives = [
      { id: 'carapace', level: 2 },
      { id: 'heart', level: 1 },
      { id: 'feather', level: 1 },
      { id: 'muscle', level: 1 },
    ];
    recalculateStatsAndGenes(world);
    // hp: 130 * (1 + 0.3 + 0.2) = 195
    expect(p.maxHp).toBe(195);
    // armor: 0 + 2*5 = 10
    expect(p.armor).toBe(10);
    // speed: 3.4 * 1.1
    expect(p.speed).toBeCloseTo(3.4 * 1.1, 5);
    // radius: (22 + 1*4) * 1.06
    expect(p.radius).toBeCloseTo(26 * 1.06, 5);
  });

  it('饕餮叠加提升气血与攻击', () => {
    const world = createWorld();
    const p = world.player;
    p.taotieStacks = 100;
    recalculateStatsAndGenes(world);
    expect(p.maxHp).toBe(Math.round(130 * (1 + 100 * 0.005)));
    expect(p.dmgMult).toBeCloseTo(1 * (1 + 100 * 0.004), 5);
  });
});
