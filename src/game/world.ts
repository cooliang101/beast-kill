// 世界创建与重置。所有实体数组常驻、池化复用。

import { ALL_FORMS } from '../config/forms';
import { BALANCE } from '../config/balance';
import { Pool } from '../core/pool';
import { SpatialGrid } from '../core/spatial';
import { createDirector } from './spawn';
import type { BeastForm } from '../config/types';
import type { Enemy, EnemyShot, PlayerState, Pools, World } from './types';

/** 地图装饰要素（80 个辉光圆环），与原 demo 一致 */
export interface MapFeature {
  x: number;
  y: number;
  r: number;
  color: string;
}

export function createMapFeatures(): MapFeature[] {
  const features: MapFeature[] = [];
  for (let i = 0; i < 80; i++) {
    features.push({
      x: (Math.random() - 0.5) * 4000,
      y: (Math.random() - 0.5) * 4000,
      r: 25 + Math.random() * 60,
      color: ['#38bdf8', '#a855f7', '#f59e0b'][i % 3],
    });
  }
  return features;
}

function emptyGeneCounts(): PlayerState['geneCounts'] {
  return { wind: 0, fire: 0, thunder: 0, poison: 0, blood: 0, ice: 0, rock: 0, dark: 0, phantom: 0 };
}

export function createPlayer(form: BeastForm, startOrganId = 'claw'): PlayerState {
  return {
    x: 0,
    y: 0,
    angle: 0,
    walkPhase: 0,
    radius: 24,
    form,
    stage: 1,
    level: 1,
    exp: 0,
    expNext: BALANCE.expNextBase,
    hp: form.stats.hp,
    maxHp: form.stats.hp,
    speed: form.stats.speed,
    dmgMult: form.stats.dmgMult,
    armor: form.stats.armor,
    hurtTimer: 0,
    formSkillTimer: 0,
    taotieStacks: 0,
    organs: [{ id: startOrganId, level: 1, evolved: false, timer: 0.1 }],
    passives: [],
    geneCounts: emptyGeneCounts(),
    meta: { hpPct: 0, speedPct: 0, dmgPct: 0, critAdd: 0, armorAdd: 0 },
  };
}

function createPools(): Pools {
  return {
    enemy: new Pool<Enemy>(() => ({
      x: 0, y: 0, angle: 0, walkPhase: 0, hurtTimer: 0,
      primary: '#fff', secondary: '#fff', accent: '#fff',
      maxHp: 1, hp: 1, speed: 1, radius: 10, isBoss: false, name: '', typeIndex: 0,
      behavior: 'chaser', actionTimer: 0, actionState: 0, dashVx: 0, dashVy: 0,
      elite: false, affix: 'none', contactMult: 1, kbImmune: false, regen: 0,
    })),
    enemyShot: new Pool<EnemyShot>(() => ({
      x: 0, y: 0, vx: 0, vy: 0, r: 9, color: '#f87171', dmg: 0, life: 0,
    })),
    projectile: new Pool(() => ({
      x: 0, y: 0, vx: 0, vy: 0, r: 8, color: '#fff', dmg: 0, pierce: 1,
      style: 'ice_sword' as const, evo: false, homing: false, hasTrail: false,
      rot: 0, life: 0, trail: [],
    })),
    slash: new Pool(() => ({
      x: 0, y: 0, angle: 0, radius: 0, color: '#fff', life: 0, maxLife: 1, isGiant: false,
    })),
    bolt: new Pool(() => ({
      pts: [], branchPts: [], targetX: 0, targetY: 0, hasTarget: false,
      color: '#fff', isEvolved: false, life: 0, maxLife: 1,
    })),
    beam: new Pool(() => ({
      x1: 0, y1: 0, x2: 0, y2: 0, angle: 0, length: 0, width: 1,
      color: '#fff', isEvolved: false, life: 0, maxLife: 1,
    })),
    tentacle: new Pool(() => ({
      x: 0, y: 0, baseAngle: 0, len: 0, color: '#fff', phase: 0, life: 0, maxLife: 1,
    })),
    meteor: new Pool(() => ({
      startX: 0, startY: 0, targetX: 0, targetY: 0, radius: 0, color: '#fff',
      dmg: 0, isEvolved: false, progress: 0, speed: 3.4,
    })),
    zone: new Pool(() => ({
      x: 0, y: 0, r: 0, color: '#fff', dmg: 0, life: 0, maxLife: 1,
      tickTimer: 0, type: 'poison_web' as const, rot: 0,
    })),
    tornado: new Pool(() => ({
      x: 0, y: 0, vx: 0, vy: 0, r: 0, color: '#34d399', dmg: 0,
      life: 0, tickTimer: 0, phase: 0,
    })),
    spike: new Pool(() => ({ x: 0, y: 0, angle: 0, evolved: false, trail: [] })),
    particle: new Pool(() => ({
      x: 0, y: 0, vx: 0, vy: 0, r: 2, color: '#fff', life: 0, maxLife: 1,
    })),
    text: new Pool(() => ({ x: 0, y: 0, text: '', color: '#fff', size: 12, life: 0 })),
    gem: new Pool(() => ({ x: 0, y: 0, val: 0, color: '#fff', r: 5, beingPulled: false })),
  };
}

export function createWorld(): World {
  return {
    time: 0,
    kills: 0,
    shake: 0,
    view: { w: 1280, h: 720 },
    player: createPlayer(ALL_FORMS.stage1[0]),
    enemies: [],
    enemyShots: [],
    projectiles: [],
    meteors: [],
    slashes: [],
    bolts: [],
    beams: [],
    tentacles: [],
    zones: [],
    tornadoes: [],
    spikes: [],
    particles: [],
    texts: [],
    gems: [],
    spawnTimer: 0,
    nextBossTime: BALANCE.bossFirstTime,
    bossesKilled: 0,
    victory: false,
    endless: false,
    difficulty: 1,
    enemySpeedMult: 1,
    enemyExpMult: 1,
    startOrganId: 'claw',
    bloodline: null,
    director: createDirector(),
    pools: createPools(),
    grid: new SpatialGrid<Enemy>(BALANCE.hashCellSize),
    events: {},
  };
}

/** 重开一局：清空全部实体并回收到池，保留池与网格实例。
 *  注意：difficulty / startOrganId / bloodline 属于"本局配置"，由 Game 在调用前设置，此处保留。 */
export function resetWorld(world: World): void {
  const { pools } = world;
  for (const e of world.enemies) pools.enemy.release(e);
  for (const s of world.enemyShots) pools.enemyShot.release(s);
  for (const p of world.projectiles) pools.projectile.release(p);
  for (const s of world.slashes) pools.slash.release(s);
  for (const b of world.bolts) pools.bolt.release(b);
  for (const b of world.beams) pools.beam.release(b);
  for (const t of world.tentacles) pools.tentacle.release(t);
  for (const m of world.meteors) pools.meteor.release(m);
  for (const z of world.zones) pools.zone.release(z);
  for (const t of world.tornadoes) pools.tornado.release(t);
  for (const s of world.spikes) pools.spike.release(s);
  for (const p of world.particles) pools.particle.release(p);
  for (const t of world.texts) pools.text.release(t);
  for (const g of world.gems) pools.gem.release(g);

  world.enemies.length = 0;
  world.enemyShots.length = 0;
  world.projectiles.length = 0;
  world.slashes.length = 0;
  world.bolts.length = 0;
  world.beams.length = 0;
  world.tentacles.length = 0;
  world.meteors.length = 0;
  world.zones.length = 0;
  world.tornadoes.length = 0;
  world.spikes.length = 0;
  world.particles.length = 0;
  world.texts.length = 0;
  world.gems.length = 0;

  world.time = 0;
  world.kills = 0;
  world.shake = 0;
  world.spawnTimer = 0;
  world.nextBossTime = BALANCE.bossFirstTime;
  world.bossesKilled = 0;
  world.victory = false;
  world.endless = false;
  world.enemySpeedMult = 1;
  world.enemyExpMult = 1;
  world.director = createDirector();
  world.player = createPlayer(ALL_FORMS.stage1[0], world.startOrganId);
  world.grid.build(world.enemies);
}
