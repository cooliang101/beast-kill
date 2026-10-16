import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { gainExp } from '../src/progression/leveling';

describe('经验与升级流程', () => {
  it('经验曲线：升级后 expNext = round(prev * 1.25 + 12)', () => {
    const world = createWorld();
    world.player.expNext = 18;
    expect(gainExp(world, 18)).toBe(true);
    expect(world.player.level).toBe(2);
    expect(world.player.expNext).toBe(Math.round(18 * 1.25 + 12));
  });

  it('经验不足不升级', () => {
    const world = createWorld();
    expect(gainExp(world, 5)).toBe(false);
    expect(world.player.level).toBe(1);
    expect(world.player.exp).toBe(5);
  });

  it('Lv.5 触发阶段进化事件（而非普通升级）', () => {
    const world = createWorld();
    let evoStage = 0;
    let upgCount = 0;
    world.events = {
      onStageEvolution: (s) => { evoStage = s; },
      onLevelUp: () => { upgCount++; },
    };
    world.player.level = 4;
    world.player.exp = 0;
    world.player.expNext = 10;
    gainExp(world, 10);
    expect(world.player.level).toBe(5);
    expect(evoStage).toBe(2);
    expect(upgCount).toBe(0);
  });

  it('Lv.10 / 15 / 20 对应三/四/五阶', () => {
    for (const [level, stage] of [[10, 3], [15, 4], [20, 5]] as const) {
      const world = createWorld();
      let evoStage = 0;
      world.events = { onStageEvolution: (s) => { evoStage = s; } };
      world.player.level = level - 1;
      world.player.exp = 0;
      world.player.expNext = 10;
      gainExp(world, 10);
      expect(evoStage).toBe(stage);
    }
  });

  it('已到该阶段时不重复触发进化，走普通升级', () => {
    const world = createWorld();
    let upgCount = 0;
    world.events = { onLevelUp: () => { upgCount++; } };
    world.player.level = 4;
    world.player.stage = 2; // 已在二阶，Lv.5 不应再触发二阶进化
    world.player.exp = 0;
    world.player.expNext = 10;
    gainExp(world, 10);
    expect(upgCount).toBe(1);
  });
});
