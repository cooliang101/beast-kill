import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/game/world';
import { checkVictory, updateWorld } from '../src/game/update';
import { recalculateStatsAndGenes } from '../src/progression/genes';
import { dealDamage } from '../src/combat/damage';
import {
  AFFIX_NAMES,
  BOSS_TEXTURE_INDEX,
  WILD_TYPES,
  generateRunPlan,
  spawnElites,
  triggerEvent,
  updateDirector,
} from '../src/game/spawn';
import { BALANCE } from '../src/config/balance';
import type { Enemy, EnemyBehavior, World } from '../src/game/types';

const STEP = 1 / 60;
const STILL = { x: 0, y: 0 };

function quietWorld(difficulty = 1): World {
  const world = createWorld();
  recalculateStatsAndGenes(world);
  world.spawnTimer = 99999;
  world.nextBossTime = 99999;
  world.difficulty = difficulty;
  world.director.eventTimer = 99999; // 关掉随机事件，保证测试可控
  return world;
}

function addEnemy(world: World, x: number, y: number, hp: number, behavior: EnemyBehavior = 'chaser', radius = 15): Enemy {
  const e = world.pools.enemy.acquire();
  e.x = x;
  e.y = y;
  e.primary = '#fff';
  e.secondary = '#fff';
  e.accent = '#38bdf8';
  e.maxHp = hp;
  e.hp = hp;
  e.speed = 2;
  e.radius = radius;
  e.angle = 0;
  e.walkPhase = 0;
  e.hurtTimer = 0;
  e.isBoss = false;
  e.name = '';
  e.typeIndex = 0;
  e.behavior = behavior;
  e.actionTimer = 0;
  e.actionState = 0;
  e.dashVx = 0;
  e.dashVy = 0;
  e.elite = false;
  e.affix = 'none';
  e.contactMult = 1;
  e.kbImmune = behavior === 'armored'; // 与 spawn.ts 的 initEnemy 保持一致
  e.regen = 0;
  world.enemies.push(e);
  return e;
}

describe('野生怪与行为覆盖', () => {
  it('六种野生怪覆盖了全部基础行为，Boss 贴图索引随类型数量动态取值', () => {
    expect(WILD_TYPES.length).toBe(6);
    const behaviors = new Set(WILD_TYPES.map((t) => t.behavior));
    for (const b of ['chaser', 'ranged', 'buffer', 'charger', 'armored', 'splitter'] as const) {
      expect(behaviors.has(b)).toBe(true);
    }
    expect(BOSS_TEXTURE_INDEX).toBe(WILD_TYPES.length);
  });
});

describe('波次导演', () => {
  it('剧本覆盖目标时长、包含全部四种段、时长落在配置区间', () => {
    const plan = generateRunPlan();
    const total = plan.reduce((a, s) => a + s.duration, 0);
    expect(total).toBeGreaterThanOrEqual(BALANCE.victoryTime);
    const kinds = new Set(plan.map((s) => s.phase));
    for (const k of ['calm', 'horde', 'elite', 'breather'] as const) expect(kinds.has(k)).toBe(true);
    for (const seg of plan) {
      expect(seg.duration).toBeGreaterThan(0);
      expect(seg.duration).toBeLessThan(45);
    }
  });

  it('两局剧本不同（跨局随机性）', () => {
    const a = generateRunPlan().map((s) => `${s.phase}:${s.duration.toFixed(2)}`).join(',');
    const b = generateRunPlan().map((s) => `${s.phase}:${s.duration.toFixed(2)}`).join(',');
    let same = 0;
    for (let i = 0; i < 5; i++) {
      const c = generateRunPlan().map((s) => `${s.phase}:${s.duration.toFixed(2)}`).join(',');
      if (c === a || c === b) same++;
    }
    expect(same).toBeLessThan(2);
  });

  it('导演按时间推进段位', () => {
    const world = quietWorld();
    world.director.plan = [
      { phase: 'calm', duration: 1 },
      { phase: 'horde', duration: 1 },
      { phase: 'elite', duration: 1 },
    ];
    world.director.index = 0;
    for (let i = 0; i < 61; i++) updateDirector(world, STEP); // 约 1.02 秒
    expect(world.director.index).toBe(1);
    for (let i = 0; i < 61; i++) updateDirector(world, STEP);
    expect(world.director.index).toBe(2);
  });

  it('血月事件：敌速与经验倍率提升，到期恢复', () => {
    const world = quietWorld();
    triggerEvent(world, 'bloodmoon');
    expect(world.director.bloodMoonTimer).toBeCloseTo(BALANCE.bloodMoonDuration, 5);
    updateDirector(world, STEP);
    expect(world.enemySpeedMult).toBeCloseTo(BALANCE.bloodMoonSpeedMult, 5);
    expect(world.enemyExpMult).toBeCloseTo(BALANCE.bloodMoonExpMult, 5);
    updateDirector(world, BALANCE.bloodMoonDuration + 0.1);
    expect(world.enemySpeedMult).toBe(1);
    expect(world.enemyExpMult).toBe(1);
  });

  it('兽潮事件：一次投放成批敌人', () => {
    const world = quietWorld();
    const before = world.enemies.length;
    triggerEvent(world, 'horde');
    expect(world.enemies.length).toBe(before + BALANCE.eventHordeCount);
  });

  it('宝物妖事件：逃跑行为 + 击杀掉落宝石簇', () => {
    const world = quietWorld();
    triggerEvent(world, 'treasure');
    const treasure = world.enemies.find((e) => e.behavior === 'flee');
    expect(treasure).toBeDefined();
    expect(treasure?.name).toBe('宝物妖');

    const gemsBefore = world.gems.length;
    dealDamage(world, treasure!, 999999, '#fff', 0);
    updateWorld(world, STEP, STILL);
    expect(world.gems.length).toBeGreaterThanOrEqual(gemsBefore + BALANCE.treasureGemCount);
  });

  it('精英猎杀事件：出现精英', () => {
    const world = quietWorld();
    triggerEvent(world, 'eliteHunt');
    const elites = world.enemies.filter((e) => e.elite);
    expect(elites.length).toBe(2);
    for (const e of elites) expect(AFFIX_NAMES[e.affix]).not.toBe('普通');
  });
});

describe('敌人行为', () => {
  it('远程怪保持距离并发射敌方弹幕，弹幕命中扣血', () => {
    const world = quietWorld();
    const e = addEnemy(world, BALANCE.rangedKeepDist + 20, 0, 100000, 'ranged');
    const hp0 = world.player.hp;

    // 约 0.7 秒：弹幕应在飞行途中
    for (let i = 0; i < 40; i++) updateWorld(world, STEP, STILL);
    expect(world.enemyShots.length).toBeGreaterThan(0);
    // 敌人没有贴脸（保持距离行为生效）
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(BALANCE.rangedKeepDist - 60);

    // 再跑约 1.5 秒：弹幕应命中玩家
    for (let i = 0; i < 90; i++) updateWorld(world, STEP, STILL);
    expect(world.player.hp).toBeLessThan(hp0);
  });

  it('冲锋怪经过 蓄力→冲刺→硬直 状态机', () => {
    const world = quietWorld();
    const e = addEnemy(world, 200, 0, 100000, 'charger');
    const seen = new Set<number>();
    for (let i = 0; i < 240; i++) {
      updateWorld(world, STEP, STILL);
      seen.add(e.actionState);
      if (seen.has(1) && seen.has(2) && seen.has(3)) break;
    }
    expect(seen.has(1)).toBe(true); // 蓄力
    expect(seen.has(2)).toBe(true); // 冲刺
    expect(seen.has(3)).toBe(true); // 硬直
  });

  it('分裂怪死亡后生成子体（行为转为追击，不再分裂）', () => {
    const world = quietWorld();
    const e = addEnemy(world, 60, 0, 40, 'splitter');
    dealDamage(world, e, 99999, '#fff', 0);
    updateWorld(world, STEP, STILL);
    // 原体死亡 + 分裂子体
    expect(world.enemies.length).toBe(BALANCE.splitterChildren);
    for (const child of world.enemies) {
      expect(child.behavior).toBe('chaser');
      expect(child.radius).toBeLessThan(e.radius);
    }
  });

  it('重甲怪免疫击退', () => {
    const world = quietWorld();
    const armored = addEnemy(world, 200, 0, 100000, 'armored');
    const chaser = addEnemy(world, 200, 300, 100000, 'chaser');
    const ax = armored.x;
    const cx = chaser.x;
    dealDamage(world, armored, 10, '#fff', 20);
    dealDamage(world, chaser, 10, '#fff', 20);
    expect(Math.abs(armored.x - ax)).toBeLessThan(0.001);
    expect(Math.abs(chaser.x - cx)).toBeGreaterThan(1);
  });

  it('光环怪为周围敌人回血', () => {
    const world = quietWorld();
    addEnemy(world, 0, 0, 100000, 'buffer');
    const hurt = addEnemy(world, 80, 0, 100000, 'chaser');
    hurt.hp = 1000; // 制造受损状态
    updateWorld(world, STEP, STILL);
    expect(hurt.hp).toBeGreaterThan(1000);
  });
});

describe('精英怪', () => {
  it('精英体型/血量放大并携带词缀；护盾免击退、吸血有回血', () => {
    const world = quietWorld();
    spawnElites(world, 6, 400);
    const elites = world.enemies.filter((e) => e.elite);
    expect(elites.length).toBe(6);
    for (const e of elites) {
      expect(e.maxHp).toBeGreaterThan(0);
      expect(e.radius).toBeGreaterThan(WILD_TYPES[e.typeIndex].r * BALANCE.eliteRadiusMult - 0.01);
      if (e.affix === 'shielded') expect(e.kbImmune).toBe(true);
      if (e.affix === 'leech') expect(e.regen).toBeGreaterThan(0);
      if (e.affix === 'ferocious') expect(e.contactMult).toBeCloseTo(BALANCE.eliteContactMult, 5);
    }
  });

  it('吸血精英在受伤后自行回血', () => {
    const world = quietWorld();
    // 构造一个必定吸血词缀的精英
    const e = addEnemy(world, 200, 0, 100000, 'chaser');
    e.elite = true;
    e.affix = 'leech';
    e.regen = e.maxHp * BALANCE.leechRegenPct;
    e.hp = 500;
    updateWorld(world, STEP, STILL);
    expect(e.hp).toBeGreaterThan(500);
  });
});

describe('难度与胜利条件', () => {
  it('高难度下敌人接触伤害更高', () => {
    const dmgAt = (difficulty: number): number => {
      const world = quietWorld(difficulty);
      world.player.hp = 100000;
      world.player.maxHp = 100000;
      world.player.armor = 0;
      addEnemy(world, 20, 0, 100000, 'chaser');
      updateWorld(world, STEP, STILL);
      return 100000 - world.player.hp;
    };
    const normal = dmgAt(1);
    const brutal = dmgAt(4);
    expect(brutal).toBeGreaterThan(normal);
  });

  it('击败足够数量 Boss 触发通关（且只触发一次）', () => {
    const world = quietWorld();
    let victories = 0;
    world.events = { onVictory: () => { victories++; } };
    world.bossesKilled = BALANCE.victoryBosses;
    checkVictory(world);
    checkVictory(world);
    expect(world.victory).toBe(true);
    expect(victories).toBe(1);
  });

  it('存活到时限也会通关', () => {
    const world = quietWorld();
    let victory = false;
    world.events = { onVictory: () => { victory = true; } };
    world.time = BALANCE.victoryTime + 1;
    checkVictory(world);
    expect(victory).toBe(true);
  });

  it('无尽模式下不再触发通关', () => {
    const world = quietWorld();
    world.endless = true;
    world.bossesKilled = BALANCE.victoryBosses + 5;
    checkVictory(world);
    expect(world.victory).toBe(false);
  });

  it('Boss 击杀被计数', () => {
    const world = quietWorld();
    const boss = addEnemy(world, 60, 0, 100, 'chaser', 44);
    boss.isBoss = true;
    const before = world.bossesKilled;
    dealDamage(world, boss, 99999, '#fff', 0);
    updateWorld(world, STEP, STILL);
    expect(world.bossesKilled).toBe(before + 1);
  });
});
