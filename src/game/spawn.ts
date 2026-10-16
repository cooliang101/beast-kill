// 怪物刷新与 Boss 战（原 demo 数值原样移植）。

import { BALANCE } from '../config/balance';
import type { World } from '../game/types';

export interface WildType {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  hp: number;
  speed: number;
  r: number;
}

export const WILD_TYPES: WildType[] = [
  { name: '荒原骨狼', primary: '#475569', secondary: '#94a3b8', accent: '#38bdf8', hp: 28, speed: 2.1, r: 15 },
  { name: '赤炎火蜥', primary: '#991b1b', secondary: '#f87171', accent: '#fde047', hp: 42, speed: 1.8, r: 17 },
  { name: '腐骨毒蝎', primary: '#365314', secondary: '#a3e635', accent: '#c084fc', hp: 36, speed: 2.2, r: 16 },
  { name: '玄冥鬼蝠', primary: '#4c1d95', secondary: '#c084fc', accent: '#f43f5e', hp: 32, speed: 2.6, r: 15 },
  { name: '雷泽狂牛', primary: '#78350f', secondary: '#fbbf24', accent: '#38bdf8', hp: 68, speed: 1.7, r: 21 },
];

const BOSS_NAMES = ['太古凶兽·浑沌魔尊', '北冥霸主·深渊狂鲲', '南荒妖帝·九婴鬼车', '不周凶神·刑天魔躯'];

/** 渲染层贴图帧约定：0-4 为野生类型，5 为 Boss 配色 */
export const BOSS_TEXTURE_INDEX = 5;

function spawnOne(world: World, x: number, y: number, typeIndex: number, scaleMult: number): void {
  const t = WILD_TYPES[typeIndex];
  const e = world.pools.enemy.acquire();
  e.x = x;
  e.y = y;
  e.primary = t.primary;
  e.secondary = t.secondary;
  e.accent = t.accent;
  e.maxHp = Math.round(t.hp * scaleMult);
  e.hp = e.maxHp;
  e.speed = t.speed * (0.9 + Math.random() * 0.25);
  e.radius = t.r;
  e.angle = 0;
  e.walkPhase = Math.random() * 10;
  e.hurtTimer = 0;
  e.isBoss = false;
  e.name = '';
  e.typeIndex = typeIndex;
  world.enemies.push(e);
}

export function spawnEnemies(world: World, dt: number): void {
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.enemies.length < BALANCE.enemyCap) {
    world.spawnTimer = Math.max(BALANCE.spawnIntervalMin, BALANCE.spawnIntervalBase - world.time * 0.002);
    const count = 1 + Math.floor(world.time / BALANCE.spawnCountPerSeconds);
    const scaleMult = 1 + world.time * BALANCE.scaleTimeFactor + Math.pow(world.player.level, 1.22) * BALANCE.scaleLevelFactor;

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.max(world.view.w, world.view.h) * 0.56 + BALANCE.spawnRingMargin;
      spawnOne(
        world,
        world.player.x + Math.cos(ang) * dist,
        world.player.y + Math.sin(ang) * dist,
        Math.floor(Math.random() * WILD_TYPES.length),
        scaleMult,
      );
    }
  }

  if (world.time >= world.nextBossTime) {
    world.nextBossTime += BALANCE.bossInterval;
    const ang = Math.random() * Math.PI * 2;
    const dist = 500;
    const bName = BOSS_NAMES[Math.floor(Math.random() * BOSS_NAMES.length)];
    const hp = Math.round(BALANCE.bossHpBase * (1 + world.time * BALANCE.bossHpTimeFactor));

    const e = world.pools.enemy.acquire();
    e.x = world.player.x + Math.cos(ang) * dist;
    e.y = world.player.y + Math.sin(ang) * dist;
    e.name = bName;
    e.primary = '#881337';
    e.secondary = '#f43f5e';
    e.accent = '#fde047';
    e.maxHp = hp;
    e.hp = hp;
    e.speed = BALANCE.bossSpeed;
    e.radius = BALANCE.bossRadius;
    e.angle = 0;
    e.walkPhase = 0;
    e.hurtTimer = 0;
    e.isBoss = true;
    e.typeIndex = BOSS_TEXTURE_INDEX;
    world.enemies.push(e);

    world.shake = 14;
    world.events.onBossSpawn?.(bName);
  }
}

/** 试炼台压测：一次性投放大量怪物，验证"超多单位同屏"性能 */
export function spawnStressEnemies(world: World, count: number): void {
  const scaleMult = 1 + world.time * BALANCE.scaleTimeFactor + Math.pow(world.player.level, 1.22) * BALANCE.scaleLevelFactor;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 150 + Math.random() * 1250;
    spawnOne(
      world,
      world.player.x + Math.cos(ang) * dist,
      world.player.y + Math.sin(ang) * dist,
      Math.floor(Math.random() * WILD_TYPES.length),
      scaleMult,
    );
  }
}
