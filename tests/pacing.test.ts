// 节奏探针（前期难度回归）。
//
// 两个探针：
// 1) 纯刷怪速率探针——只调用 spawnEnemies（世界不推进，怪不会死/动），
//    得到确定性的"每秒刷怪数"曲线，是节奏调参的主指标；
// 2) 密度探针——完整跑一局，但玩家无敌、原地不动、不选升级（最坏情况），
//    用来观察同屏怪量的实际包络。
// 跑 `npx vitest run tests/pacing.test.ts` 可在输出里看到曲线。

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWorld } from '../src/game/world';
import { updateWorld } from '../src/game/update';
import { recalculateStatsAndGenes } from '../src/progression/genes';
import { spawnEnemies, enemyCapAt } from '../src/game/spawn';
import { BALANCE } from '../src/config/balance';
import type { World } from '../src/game/types';

const STEP = 1 / 60;
const STILL = { x: 0, y: 0 };

/** 固定种子随机数：让密度探针的曲线可复现（每局随机剧本在测试里必须被钉死） */
function seedRandom(seed: number): void {
  let s = seed >>> 0;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** 关掉 Boss/事件/非平静段的干扰，得到干净的刷怪环境 */
function spawnHarness(startTimeSec: number): World {
  const world = createWorld();
  recalculateStatsAndGenes(world);
  world.spawnTimer = 0;
  world.nextBossTime = 1e9;
  world.director.plan = [{ phase: 'calm', duration: 1e9 }];
  world.director.index = 0;
  world.director.eventTimer = 1e9;
  world.time = startTimeSec;
  return world;
}

/** 纯刷怪速率：每秒新增怪数（怪不会死，所以就是生成量） */
function spawnRateAt(startTimeSec: number, windowSec = 60): number {
  const world = spawnHarness(startTimeSec);
  const steps = Math.round(windowSec / STEP);
  let spawned = 0;
  for (let i = 0; i < steps; i++) {
    world.time += STEP;
    const before = world.enemies.length;
    spawnEnemies(world, STEP);
    spawned += world.enemies.length - before;
  }
  return spawned / windowSec;
}

interface Sample {
  minute: number;
  enemies: number;
  elites: number;
  kills: number;
}

/** 密度探针：完整模拟（玩家无敌原地不动、不选升级）。随机数固定种子，曲线可复现 */
function densityProbe(durationSec: number, seed = 20261018): { samples: Sample[]; eliteFirstSec: number | null; eventFirstSec: number | null; eventCount: number } {
  seedRandom(seed);
  const world = createWorld();
  recalculateStatsAndGenes(world);
  world.player.hp = 1e9;
  world.player.maxHp = 1e9;
  world.spawnTimer = 0;

  let eliteFirstSec: number | null = null;
  let eventFirstSec: number | null = null;
  let eventCount = 0;
  world.events = {
    onEliteSpawn: () => { if (eliteFirstSec === null) eliteFirstSec = world.time; },
    onEvent: () => { if (eventFirstSec === null) eventFirstSec = world.time; eventCount++; },
  };

  const samples: Sample[] = [];
  let nextSample = 60; // 整分钟采样（避免 round 取整伪影）
  const total = Math.round(durationSec / STEP);
  for (let i = 0; i < total; i++) {
    updateWorld(world, STEP, STILL);
    if (world.time >= nextSample) {
      nextSample += 60;
      samples.push({
        minute: Math.round(world.time / 60),
        enemies: world.enemies.length,
        elites: world.enemies.filter((e) => e.elite).length,
        kills: world.kills,
      });
    }
  }
  return { samples, eliteFirstSec, eventFirstSec, eventCount };
}

describe('刷怪速率曲线（节奏主指标）', () => {
  it('开局克制：前 60 秒平均 1.1~1.9 只/秒', () => {
    const rate = spawnRateAt(0, 60);
    expect(rate).toBeGreaterThanOrEqual(1.1);
    expect(rate).toBeLessThanOrEqual(1.9);
  });

  it('5 分钟时约 4 只/秒，10 分钟时不超过 7 只/秒', () => {
    const at5 = spawnRateAt(300, 60);
    const at10 = spawnRateAt(600, 60);
    // 速率公式：1.2 + 0.55 * 分钟数 → 5 分钟 3.95/s、10 分钟 6.7/s（含 1/60 量化误差）
    expect(at5).toBeGreaterThan(3.4);
    expect(at5).toBeLessThan(5.2);
    expect(at10).toBeLessThan(7.2);
  });

  it('速率随时间单调上升且有上限', () => {
    const r0 = spawnRateAt(0, 30);
    const r5 = spawnRateAt(300, 30);
    const r15 = spawnRateAt(900, 30);
    expect(r5).toBeGreaterThan(r0);
    expect(r15).toBeGreaterThan(r5);
    expect(r15).toBeLessThanOrEqual(BALANCE.spawnRateMax * 1.15);
  });

  it('对比原 demo 公式：第 2 分钟不再出现 ~7.8 只/秒的暴涨', () => {
    // 原 demo: 1 + floor(t/35) 每 (0.75 - 0.002t) 秒 → t=120 时约 7.8/s
    const at2 = spawnRateAt(120, 30);
    expect(at2).toBeLessThan(4.2);
  });
});

describe('同屏怪量包络（最坏情况：无敌不动不升级）', () => {
  // 12 分钟完整模拟约需 6~8 秒，显式放宽超时
  it(
    '前 12 分钟曲线受上限与速率双重约束',
    { timeout: 60000 },
    () => {
    const r = densityProbe(12 * 60);

    console.log('\n=== 同屏怪量曲线（玩家无敌原地不动 · 最坏情况）===');
    console.log('分钟  同屏怪  精英   累计击杀');
    for (const s of r.samples) {
      console.log(`${String(s.minute).padStart(4)}  ${String(s.enemies).padStart(6)}  ${String(s.elites).padStart(4)}  ${String(s.kills).padStart(8)}`);
    }
    console.log(
      `首只精英: ${r.eliteFirstSec === null ? '无' : `${r.eliteFirstSec.toFixed(0)}s`}` +
      ` · 首个事件: ${r.eventFirstSec === null ? '无' : `${r.eventFirstSec.toFixed(0)}s`}` +
      ` · 12 分钟内事件数: ${r.eventCount}\n`,
    );

    const at = (min: number): Sample => {
      const s = r.samples.filter((x) => x.minute >= min).sort((a, b) => a.minute - b.minute)[0];
      if (!s) throw new Error(`缺 ${min} 分钟采样`);
      return s;
    };

    // 1 分钟时不超过"开局上限"，且远低于原 demo 的 115 满场
    expect(at(1).enemies).toBeLessThanOrEqual(BALANCE.enemyCapBase);
    // 2 分钟不超过 200（原参数下这里是 ~190，且当时上限是 500）
    expect(at(2).enemies).toBeLessThanOrEqual(200);
    // 全程不超过硬上限
    expect(at(11).enemies).toBeLessThanOrEqual(BALANCE.enemyCapMax);
    // 怪量确实随时间走高（后期才有"海量单位"的观感）
    expect(at(8).enemies).toBeGreaterThan(at(1).enemies);

    // 精英与事件都不抢跑
    expect(r.eliteFirstSec === null || r.eliteFirstSec >= BALANCE.earlyGraceTime).toBe(true);
    expect(r.eventFirstSec === null || r.eventFirstSec >= BALANCE.eventInterval[0]).toBe(true);
  });
});
