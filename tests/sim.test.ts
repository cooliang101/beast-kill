import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { updateWorld } from '../src/game/update';
import { recalculateStatsAndGenes } from '../src/progression/genes';
import { dealDamage } from '../src/combat/damage';
import type { Enemy } from '../src/game/types';

function addEnemy(world: ReturnType<typeof createWorld>, x: number, y: number, hp: number): Enemy {
  const e = world.pools.enemy.acquire();
  e.x = x;
  e.y = y;
  e.primary = '#fff';
  e.secondary = '#fff';
  e.accent = '#38bdf8';
  e.maxHp = hp;
  e.hp = hp;
  e.speed = 2;
  e.radius = 15;
  e.angle = 0;
  e.walkPhase = 0;
  e.hurtTimer = 0;
  e.isBoss = false;
  e.name = '';
  e.typeIndex = 0;
  world.enemies.push(e);
  return e;
}

const STEP = 1 / 60;
const STILL = { x: 0, y: 0 };

/** 关闭自然刷怪与 Boss 的测试世界（首步即会刷怪，测试需可控） */
function quietWorld(): ReturnType<typeof createWorld> {
  const world = createWorld();
  recalculateStatsAndGenes(world);
  world.spawnTimer = 99999;
  world.nextBossTime = 99999;
  return world;
}

describe('主模拟循环集成', () => {
  it('敌人向玩家移动并在接触后造成伤害', () => {
    const world = quietWorld();
    world.player.hp = world.player.maxHp;
    const e = addEnemy(world, 220, 0, 100000);
    const hp0 = world.player.hp;

    for (let i = 0; i < 360; i++) updateWorld(world, STEP, STILL);

    expect(e.x).toBeLessThan(220);
    expect(world.player.hp).toBeLessThan(hp0);
  });

  it('击杀结算：怪物移除、掉落经验球、计数增加', () => {
    const world = quietWorld();
    const e = addEnemy(world, 60, 0, 50);
    dealDamage(world, e, 9999, '#fff', 0);
    expect(e.hp).toBeLessThanOrEqual(0);

    updateWorld(world, STEP, STILL);
    expect(world.kills).toBe(1);
    expect(world.enemies.length).toBe(0);
    expect(world.gems.length).toBe(1);
  });

  it('经验球被吸附吞噬并获得经验', () => {
    const world = quietWorld();
    const e = addEnemy(world, 60, 0, 50);
    dealDamage(world, e, 9999, '#fff', 0);
    updateWorld(world, STEP, STILL);

    for (let i = 0; i < 240 && world.gems.length > 0; i++) updateWorld(world, STEP, STILL);

    expect(world.gems.length).toBe(0);
    expect(world.player.exp + (world.player.level - 1) * 100).toBeGreaterThan(0);
  });

  it('武器冷却运转：利爪会命中附近敌人', () => {
    const world = quietWorld();
    const e = addEnemy(world, 80, 0, 100000);
    for (let i = 0; i < 120; i++) updateWorld(world, STEP, STILL);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('对象池复用：击杀后实体回收到池', () => {
    const world = quietWorld();
    const e = addEnemy(world, 60, 0, 50);
    dealDamage(world, e, 9999, '#fff', 0);
    updateWorld(world, STEP, STILL);
    expect(world.pools.enemy.size).toBeGreaterThanOrEqual(1);
  });

  it('Boss 到点刷新并触发事件', () => {
    const world = quietWorld();
    let bossName = '';
    world.events = { onBossSpawn: (n) => { bossName = n; } };
    world.nextBossTime = 0.01;
    world.time = 0.02;
    updateWorld(world, STEP, STILL);
    expect(world.enemies.some((x) => x.isBoss)).toBe(true);
    expect(bossName.length).toBeGreaterThan(0);
  });

  it('玩家死亡触发 onGameOver', () => {
    const world = quietWorld();
    world.player.hp = 1;
    world.player.armor = 0;
    addEnemy(world, 30, 0, 100000);
    let over = false;
    world.events = { onGameOver: () => { over = true; } };
    for (let i = 0; i < 120 && !over; i++) updateWorld(world, STEP, STILL);
    expect(over).toBe(true);
  });
});
