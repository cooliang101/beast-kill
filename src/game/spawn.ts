// 刷怪 / 精英 / 波次导演 / 随机事件（P1）。
//
// 设计要点：
// - 敌人在"数值"之外新增"行为"：追击 / 远程弹幕 / 蓄力冲撞 / 免击退重甲 / 治疗光环 / 死亡分裂 / 逃跑。
// - 精英怪 = 体型放大 + 词缀（狂暴/分裂/护盾/爆裂/吸血），刷新率随时间上升。
// - 波次导演：每局开局生成一份**随机剧本**（平静/兽潮/精英/喘息段随机排列），
//   运行时按剧本推进并周期触发随机事件，制造节奏波峰——这是"每局不一样"的主要来源。
// - 剧本在局内确定（可测试、可复现），跨局随机。

import { BALANCE } from '../config/balance';
import { spawnMeteorStrike } from '../combat/effects';
import type { Director, EliteAffix, EncounterPhase, EncounterSegment, Enemy, EnemyBehavior, World } from '../game/types';

export interface WildType {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  hp: number;
  speed: number;
  r: number;
  behavior: EnemyBehavior;
}

/** 六种野生怪，覆盖全部基础行为 */
export const WILD_TYPES: WildType[] = [
  { name: '荒原骨狼', primary: '#475569', secondary: '#94a3b8', accent: '#38bdf8', hp: 28, speed: 2.1, r: 15, behavior: 'chaser' },
  { name: '赤炎火蜥', primary: '#991b1b', secondary: '#f87171', accent: '#fde047', hp: 42, speed: 1.8, r: 17, behavior: 'ranged' },
  { name: '腐骨毒蝎', primary: '#365314', secondary: '#a3e635', accent: '#c084fc', hp: 36, speed: 2.2, r: 16, behavior: 'buffer' },
  { name: '玄冥鬼蝠', primary: '#4c1d95', secondary: '#c084fc', accent: '#f43f5e', hp: 32, speed: 2.6, r: 15, behavior: 'charger' },
  { name: '雷泽狂牛', primary: '#78350f', secondary: '#fbbf24', accent: '#38bdf8', hp: 68, speed: 1.7, r: 21, behavior: 'armored' },
  { name: '混沌裂虫', primary: '#3f6212', secondary: '#84cc16', accent: '#c084fc', hp: 40, speed: 1.9, r: 17, behavior: 'splitter' },
];

/** 渲染层贴图帧约定：0..WILD_TYPES.length-1 为野生类型，末位为 Boss 配色 */
export const BOSS_TEXTURE_INDEX = WILD_TYPES.length;

const BOSS_NAMES = ['太古凶兽·浑沌魔尊', '北冥霸主·深渊狂鲲', '南荒妖帝·九婴鬼车', '不周凶神·刑天魔躯'];

const AFFIXES: EliteAffix[] = ['ferocious', 'splitting', 'shielded', 'explosive', 'leech'];

export const AFFIX_NAMES: Record<EliteAffix, string> = {
  none: '普通',
  ferocious: '狂暴',
  splitting: '分裂',
  shielded: '护盾',
  explosive: '爆裂',
  leech: '吸血',
};

export const AFFIX_COLORS: Record<EliteAffix, string> = {
  none: '#94a3b8',
  ferocious: '#f43f5e',
  splitting: '#a3e635',
  shielded: '#38bdf8',
  explosive: '#fb923c',
  leech: '#c084fc',
};

// ---------------------------------------------------------------- 基础生成

interface SpawnOpts {
  elite?: boolean;
  eliteAffix?: EliteAffix;
  hpMult?: number;
  radiusMult?: number;
  speedMult?: number;
  name?: string;
  behavior?: EnemyBehavior;
}

function initEnemy(world: World, e: Enemy, typeIndex: number, x: number, y: number, scaleMult: number, opts: SpawnOpts): void {
  const t = WILD_TYPES[typeIndex] ?? WILD_TYPES[0];
  e.x = x;
  e.y = y;
  e.primary = t.primary;
  e.secondary = t.secondary;
  e.accent = t.accent;
  e.maxHp = Math.round(t.hp * scaleMult * (opts.hpMult ?? 1));
  e.hp = e.maxHp;
  e.speed = t.speed * (0.9 + Math.random() * 0.25) * (opts.speedMult ?? 1);
  e.radius = t.r * (opts.radiusMult ?? 1);
  e.angle = 0;
  e.walkPhase = Math.random() * 10;
  e.hurtTimer = 0;
  e.isBoss = false;
  e.name = opts.name ?? '';
  e.typeIndex = typeIndex;
  e.behavior = opts.behavior ?? t.behavior;
  e.actionTimer = Math.random() * 1.2;
  e.actionState = 0;
  e.dashVx = 0;
  e.dashVy = 0;
  e.elite = opts.elite ?? false;
  e.affix = opts.eliteAffix ?? 'none';
  e.contactMult = 1;
  e.kbImmune = e.behavior === 'armored';
  e.regen = 0;
  if (e.elite) applyAffix(world, e, e.affix);
  world.enemies.push(e);
}

function applyAffix(world: World, e: Enemy, affix: EliteAffix): void {
  e.elite = true;
  e.affix = affix;
  e.maxHp = Math.round(e.maxHp * BALANCE.eliteHpMult);
  e.hp = e.maxHp;
  e.radius *= BALANCE.eliteRadiusMult;
  switch (affix) {
    case 'ferocious':
      e.speed *= 1.35;
      e.contactMult = BALANCE.eliteContactMult;
      break;
    case 'shielded':
      e.kbImmune = true;
      e.speed *= 0.92;
      break;
    case 'leech':
      e.regen = e.maxHp * BALANCE.leechRegenPct;
      break;
    case 'splitting':
    case 'explosive':
    default:
      break;
  }
  world.events.onEliteSpawn?.(AFFIX_NAMES[affix]);
}

function pickAffix(): EliteAffix {
  return AFFIXES[Math.floor(Math.random() * AFFIXES.length)];
}

/** 分裂：生成若干缩小的子体（子体不再分裂，行为转为追击） */
export function spawnSplitChildren(world: World, parent: Enemy, count: number): void {
  for (let i = 0; i < count; i++) {
    if (world.enemies.length >= BALANCE.enemyCap + 80) break; // 允许分裂短时超上限
    const a = (i / count) * Math.PI * 2 + Math.random();
    const e = world.pools.enemy.acquire();
    initEnemy(world, e, parent.typeIndex, parent.x + Math.cos(a) * parent.radius, parent.y + Math.sin(a) * parent.radius, 1, {
      hpMult: parent.hp / Math.max(1, parent.maxHp) * BALANCE.splitterChildHpMult,
      radiusMult: BALANCE.splitterChildScale,
      behavior: 'chaser',
      speedMult: 1.15,
    });
  }
}

// ---------------------------------------------------------------- 敌方弹幕

export function spawnEnemyShot(world: World, x: number, y: number, angle: number, dmg: number, color: string, speed: number): void {
  const s = world.pools.enemyShot.acquire();
  s.x = x;
  s.y = y;
  s.vx = Math.cos(angle) * speed;
  s.vy = Math.sin(angle) * speed;
  s.r = 9;
  s.color = color;
  s.dmg = dmg;
  s.life = BALANCE.rangedShotLife;
  world.enemyShots.push(s);
}

// ---------------------------------------------------------------- Boss / 宝箱怪

function difficultyHpMult(world: World): number {
  return BALANCE.difficultyEnemyHpMult[Math.min(world.difficulty, BALANCE.maxDifficulty) - 1] ?? 1;
}

/** 精英增援（导演/事件/试炼台共用） */
export function spawnElites(world: World, count: number, distance = 470): void {
  const scaleMult = (1 + world.time * BALANCE.scaleTimeFactor + Math.pow(world.player.level, 1.22) * BALANCE.scaleLevelFactor) * difficultyHpMult(world);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = world.pools.enemy.acquire();
    initEnemy(world, e, Math.floor(Math.random() * WILD_TYPES.length),
      world.player.x + Math.cos(a) * distance, world.player.y + Math.sin(a) * distance,
      scaleMult, { elite: true, eliteAffix: pickAffix() });
  }
}

export function spawnBoss(world: World): void {
  const ang = Math.random() * Math.PI * 2;
  const dist = 500;
  const bName = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
  const hp = Math.round(BALANCE.bossHpBase * (1 + world.time * BALANCE.bossHpTimeFactor) * difficultyHpMult(world));

  const e = world.pools.enemy.acquire();
  initEnemy(world, e, BOSS_TEXTURE_INDEX, world.player.x + Math.cos(ang) * dist, world.player.y + Math.sin(ang) * dist, 1, {
    name: bName,
    radiusMult: 1,
  });
  e.primary = '#881337';
  e.secondary = '#f43f5e';
  e.accent = '#fde047';
  e.maxHp = hp;
  e.hp = hp;
  e.speed = BALANCE.bossSpeed;
  e.radius = BALANCE.bossRadius;
  e.isBoss = true;
  e.behavior = 'chaser';

  world.shake = 14;
  world.events.onBossSpawn?.(bName);
}

/** 宝物妖：高速逃跑、血厚，击杀后掉落宝石簇 */
export function spawnTreasureMonster(world: World): void {
  const ang = Math.random() * Math.PI * 2;
  const e = world.pools.enemy.acquire();
  initEnemy(world, e, 0, world.player.x + Math.cos(ang) * 420, world.player.y + Math.sin(ang) * 420, 1, {
    hpMult: BALANCE.treasureHpMult,
    speedMult: BALANCE.fleeSpeedMult,
    behavior: 'flee',
    name: '宝物妖',
  });
  e.primary = '#ca8a04';
  e.secondary = '#fde047';
  e.accent = '#fef9c3';
  e.radius = 19;
}

// ---------------------------------------------------------------- 波次导演

function segDuration(phase: EncounterPhase): number {
  switch (phase) {
    case 'horde': return BALANCE.segmentHorde[0] + Math.random() * (BALANCE.segmentHorde[1] - BALANCE.segmentHorde[0]);
    case 'elite': return BALANCE.segmentElite[0] + Math.random() * (BALANCE.segmentElite[1] - BALANCE.segmentElite[0]);
    case 'breather': return BALANCE.segmentBreather[0] + Math.random() * (BALANCE.segmentBreather[1] - BALANCE.segmentBreather[0]);
    default: return BALANCE.segmentCalm[0] + Math.random() * (BALANCE.segmentCalm[1] - BALANCE.segmentCalm[0]);
  }
}

/** 生成一份覆盖全局长度的随机剧本（每局不同；段序与时长都带随机） */
export function generateRunPlan(): EncounterSegment[] {
  const plan: EncounterSegment[] = [];
  const template: EncounterPhase[] = ['calm', 'horde', 'calm', 'elite', 'breather', 'horde', 'calm', 'elite', 'breather', 'horde'];
  const rest = template.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const order: EncounterPhase[] = ['calm', ...rest];
  let total = 0;
  const target = BALANCE.victoryTime + 180;
  let k = 0;
  while (total < target) {
    const phase = order[k % order.length];
    const duration = segDuration(phase);
    plan.push({ phase, duration });
    total += duration;
    k++;
  }
  return plan;
}

export function createDirector(): Director {
  return {
    plan: generateRunPlan(),
    index: 0,
    segmentElapsed: 0,
    eventTimer: BALANCE.eventInterval[0] + Math.random() * (BALANCE.eventInterval[1] - BALANCE.eventInterval[0]),
    bloodMoonTimer: 0,
  };
}

export function currentPhase(world: World): EncounterPhase {
  const d = world.director;
  return d.plan[d.index]?.phase ?? 'calm';
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  horde: { label: '⚠️ 兽潮突袭！', color: '#f43f5e' },
  meteor: { label: '☄️ 天降火雨 · 焚尽群魔', color: '#fb923c' },
  bloodmoon: { label: '🌑 血月当空 · 敌速暴涨，经验 +25%', color: '#e11d48' },
  treasure: { label: '💎 宝物妖现身 · 击杀获海量基因', color: '#fde047' },
  eliteHunt: { label: '👑 精英猎杀 · 强敌降临', color: '#fbbf24' },
};

export type EventKind = keyof typeof EVENT_LABELS;

export function triggerEvent(world: World, kind: EventKind): void {
  const def = EVENT_LABELS[kind];
  world.events.onEvent?.(def.label, def.color);

  switch (kind) {
    case 'horde': {
      const dir = Math.random() * Math.PI * 2;
      const dist = Math.max(world.view.w, world.view.h) * 0.6;
      for (let i = 0; i < BALANCE.eventHordeCount; i++) {
        const spread = (Math.random() - 0.5) * 1.1;
        const a = dir + spread;
        const e = world.pools.enemy.acquire();
        initEnemy(world, e, Math.floor(Math.random() * WILD_TYPES.length),
          world.player.x + Math.cos(a) * dist, world.player.y + Math.sin(a) * dist,
          1 + world.time * BALANCE.scaleTimeFactor, {});
      }
      break;
    }
    case 'meteor': {
      for (let i = 0; i < BALANCE.eventMeteorCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 340;
        spawnMeteorStrike(world, world.player.x + Math.cos(a) * d, world.player.y + Math.sin(a) * d, 72, '#fb923c', BALANCE.eventMeteorDmg, false);
      }
      break;
    }
    case 'bloodmoon': {
      world.director.bloodMoonTimer = BALANCE.bloodMoonDuration;
      break;
    }
    case 'treasure': {
      spawnTreasureMonster(world);
      break;
    }
    case 'eliteHunt': {
      spawnElites(world, 2);
      break;
    }
  }
}

/** 推进导演：段切换、事件计时、血月增益 */
export function updateDirector(world: World, dt: number): EncounterPhase {
  const d = world.director;

  d.segmentElapsed += dt;
  let seg = d.plan[d.index];
  // 段结束：推进（剧本用尽则再随机生成一批，支持无尽）
  while (seg && d.segmentElapsed >= seg.duration) {
    d.segmentElapsed -= seg.duration;
    d.index++;
    seg = d.plan[d.index];
    if (!seg) {
      d.plan = generateRunPlan();
      d.index = 0;
      seg = d.plan[0];
      break;
    }
    // 进入"精英"段：立即增援精英
    if (seg.phase === 'elite') {
      spawnElites(world, 2, 480);
    }
  }

  // 随机事件
  d.eventTimer -= dt;
  if (d.eventTimer <= 0) {
    d.eventTimer = BALANCE.eventInterval[0] + Math.random() * (BALANCE.eventInterval[1] - BALANCE.eventInterval[0]);
    const kinds: EventKind[] = ['horde', 'meteor', 'bloodmoon', 'treasure', 'eliteHunt'];
    triggerEvent(world, kinds[Math.floor(Math.random() * kinds.length)]);
  }

  // 血月增益（先扣时再判定，保证大 dt 下也能当帧恢复）
  if (d.bloodMoonTimer > 0) d.bloodMoonTimer -= dt;
  if (d.bloodMoonTimer > 0) {
    world.enemySpeedMult = BALANCE.bloodMoonSpeedMult;
    world.enemyExpMult = BALANCE.bloodMoonExpMult;
  } else {
    world.enemySpeedMult = 1;
    world.enemyExpMult = 1;
  }

  return seg?.phase ?? 'calm';
}

// ---------------------------------------------------------------- 主刷怪

export function spawnEnemies(world: World, dt: number): void {
  const phase = updateDirector(world, dt);
  let spawnMult = 1;
  let countMult = 1;
  switch (phase) {
    case 'horde': spawnMult = BALANCE.hordeSpawnMult; countMult = 2; break;
    case 'elite': spawnMult = 0.6; break;
    case 'breather': spawnMult = 0; break;
    default: break;
  }
  if (world.director.bloodMoonTimer > 0) spawnMult *= BALANCE.bloodMoonSpawnMult;

  world.spawnTimer -= dt;
  if (spawnMult > 0 && world.spawnTimer <= 0 && world.enemies.length < BALANCE.enemyCap) {
    const base = Math.max(BALANCE.spawnIntervalMin, BALANCE.spawnIntervalBase - world.time * 0.002);
    world.spawnTimer = base / spawnMult;
    const count = Math.round((1 + Math.floor(world.time / BALANCE.spawnCountPerSeconds)) * countMult);
    const scaleMult = (1 + world.time * BALANCE.scaleTimeFactor + Math.pow(world.player.level, 1.22) * BALANCE.scaleLevelFactor) * difficultyHpMult(world);
    const eliteChance = BALANCE.eliteChanceBase + (world.time / 60) * BALANCE.eliteChancePerMinute;

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.max(world.view.w, world.view.h) * 0.56 + BALANCE.spawnRingMargin;
      const e = world.pools.enemy.acquire();
      const elite = Math.random() < eliteChance;
      initEnemy(world, e, Math.floor(Math.random() * WILD_TYPES.length),
        world.player.x + Math.cos(ang) * dist, world.player.y + Math.sin(ang) * dist,
        scaleMult, elite ? { elite: true, eliteAffix: pickAffix() } : {});
    }
  }

  if (world.time >= world.nextBossTime) {
    world.nextBossTime += BALANCE.bossInterval;
    spawnBoss(world);
  }
}

/** 试炼台压测：一次性投放大量怪物，验证"超多单位同屏"性能 */
export function spawnStressEnemies(world: World, count: number): void {
  const scaleMult = (1 + world.time * BALANCE.scaleTimeFactor + Math.pow(world.player.level, 1.22) * BALANCE.scaleLevelFactor) * difficultyHpMult(world);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 150 + Math.random() * 1250;
    const e = world.pools.enemy.acquire();
    initEnemy(world, e, Math.floor(Math.random() * WILD_TYPES.length),
      world.player.x + Math.cos(ang) * dist, world.player.y + Math.sin(ang) * dist, scaleMult, {});
  }
}
