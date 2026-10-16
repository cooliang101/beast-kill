import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { summarizeBuild } from '../src/progression/summary';

describe('本局构筑汇总 summarizeBuild', () => {
  it('初始局面：仅拥有利爪，其余器官未获得', () => {
    const world = createWorld();
    const s = summarizeBuild(world.player);
    expect(s.ownedOrganCount).toBe(1);
    expect(s.ownedPassiveCount).toBe(0);
    expect(s.organs.length).toBe(12);
    expect(s.passives.length).toBe(12);

    const claw = s.organs.find((o) => o.def.id === 'claw');
    expect(claw?.owned).toBe(true);
    expect(claw?.level).toBe(1);
    expect(claw?.status).toBe('leveling');

    const venom = s.organs.find((o) => o.def.id === 'venom');
    expect(venom?.owned).toBe(false);
    expect(venom?.status).toBe('locked');
  });

  it('超武状态机：满级缺被动 → needsPassive；补齐被动 → ready；觉醒 → awakened', () => {
    const world = createWorld();
    const p = world.player;

    p.organs = [{ id: 'claw', level: 5, evolved: false, timer: 0 }];
    p.passives = [];
    expect(summarizeBuild(p).organs.find((o) => o.def.id === 'claw')?.status).toBe('needsPassive');

    p.passives = [{ id: 'fang', level: 1 }];
    expect(summarizeBuild(p).organs.find((o) => o.def.id === 'claw')?.status).toBe('ready');

    p.organs[0].evolved = true;
    const s = summarizeBuild(p);
    expect(s.organs.find((o) => o.def.id === 'claw')?.status).toBe('awakened');
    expect(s.awakenedCount).toBe(1);
    expect(s.readyCount).toBe(0);
  });

  it('配对被动信息随器官一并返回', () => {
    const world = createWorld();
    const p = world.player;
    p.passives = [{ id: 'nerve', level: 3 }];
    const horn = summarizeBuild(p).organs.find((o) => o.def.id === 'horn');
    expect(horn?.passiveDef?.id).toBe('nerve');
    expect(horn?.passiveOwned).toBe(true);
    expect(horn?.passiveLevel).toBe(3);
  });

  it('派生属性与游戏内公式一致', () => {
    const world = createWorld();
    const p = world.player;
    p.passives = [
      { id: 'fang', level: 2 },
      { id: 'spirit', level: 3 },
      { id: 'nerve', level: 5 },
      { id: 'core', level: 2 },
      { id: 'blood_s', level: 2 },
      { id: 'heart', level: 4 },
    ];
    const d = summarizeBuild(p).derived;
    expect(d.critChance).toBeCloseTo(0.08 + 3 * 0.08, 6);
    expect(d.lifestealChance).toBe(0.2);
    expect(d.lifestealAmount).toBeCloseTo(2 * 0.7, 6);
    expect(d.cdrReduction).toBeCloseTo(1 - 0.5, 6); // nerve 5 → 冷却系数 0.5
    expect(d.areaMult).toBeCloseTo(1 + 2 * 0.18 + 2 * 0.15, 6);
    expect(d.regenPerSec).toBeCloseTo(4 * 2.5, 6);
    expect(d.pullRange).toBeCloseTo(115 * 1.25, 6); // 混沌幼崽引力 +25%
  });

  it('吞噬引力与经验加成随引力胃袋提升，且混沌幼崽有 1.25 倍加成', () => {
    const world = createWorld();
    const p = world.player;
    p.passives = [{ id: 'stomach', level: 5 }];
    const d = summarizeBuild(p).derived;
    expect(d.pullRange).toBeCloseTo((115 + 5 * 42) * 1.25, 6);
    expect(d.expBonusPct).toBeCloseTo(5 * 0.12, 6);

    // 进化后（非混沌幼崽）失去该加成
    p.form = { ...p.form, id: 'gale_wolf' };
    expect(summarizeBuild(p).derived.pullRange).toBeCloseTo(115 + 5 * 42, 6);
  });

  it('饕餮叠加计入气血与攻击加成', () => {
    const world = createWorld();
    const p = world.player;
    p.taotieStacks = 200;
    const d = summarizeBuild(p).derived;
    expect(d.hpBonusPct).toBeCloseTo(200 * 0.005, 6);
    expect(d.dmgBonusPct).toBeCloseTo(200 * 0.004, 6);
  });
});
