// 战斗特效生成器。所有 AOE 命中判定改为空间哈希圆查询 + 距离精筛，
// 语义与原 demo 的全遍历一致（含各自的判定半径规则）。

import { dealDamage } from './damage';
import type { Enemy, ProjectileStyle, Vec2, World } from '../game/types';

interface HitOpts {
  /** true 时判定半径为 r + 敌人半径（原 demo 中部分技能如此） */
  addEnemyRadius?: boolean;
  /** 扇形判定中心角（如爪击）；不传则全圆 */
  angleCenter?: number;
  angleHalf?: number;
}

/** 圆形 AOE 命中：网格粗筛 + 精确判定 */
export function hitCircle(
  world: World,
  x: number,
  y: number,
  r: number,
  dmg: number,
  color: string,
  knockback: number,
  opts: HitOpts = {},
): void {
  const qr = r + (opts.addEnemyRadius ? 48 : 0);
  const idx = world.grid.queryCircle(x, y, qr);
  const enemies = world.enemies;
  for (let k = 0; k < idx.length; k++) {
    const e = enemies[idx[k]];
    const dx = e.x - x;
    const dy = e.y - y;
    const eff = opts.addEnemyRadius ? r + e.radius : r;
    if (dx * dx + dy * dy > eff * eff) continue;
    if (opts.angleCenter !== undefined) {
      const a = Math.atan2(dy, dx);
      const diff = Math.atan2(Math.sin(a - opts.angleCenter), Math.cos(a - opts.angleCenter));
      if (Math.abs(diff) >= (opts.angleHalf ?? 1.35)) continue;
    }
    dealDamage(world, e, dmg, color, knockback);
  }
}

// ---------------------------------------------------------------- 爪击

export function spawnClawSlash(
  world: World,
  x: number,
  y: number,
  angle: number,
  radius: number,
  color: string,
  dmg: number,
  isGiant = false,
): void {
  const s = world.pools.slash.acquire();
  s.x = x;
  s.y = y;
  s.angle = angle;
  s.radius = radius;
  s.color = color;
  s.life = 0.26;
  s.maxLife = 0.26;
  s.isGiant = isGiant;
  world.slashes.push(s);

  hitCircle(world, x, y, radius + 25, dmg, color, isGiant ? 10 : 5,
    isGiant ? {} : { angleCenter: angle, angleHalf: 1.35 });
}

// ---------------------------------------------------------------- 分形天雷

function fillBoltSegments(out: Vec2[], x1: number, y1: number, x2: number, y2: number, displace: number): void {
  out.length = 0;
  out.push({ x: x1, y: y1 });
  const steps = 6;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    out.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * displace,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * displace,
    });
  }
  out.push({ x: x2, y: y2 });
}

export function spawnLightningChain(
  world: World,
  startX: number,
  startY: number,
  jumps: number,
  dmg: number,
  color = '#facc15',
  isEvolved = false,
): void {
  let currX = startX;
  let currY = startY;
  const hitSet = new Set<Enemy>();
  for (let i = 0; i < jumps; i++) {
    let best: Enemy | null = null;
    let minDistSq = 360 * 360;
    const idx = world.grid.queryCircle(currX, currY, 360);
    for (let k = 0; k < idx.length; k++) {
      const e = world.enemies[idx[k]];
      if (hitSet.has(e)) continue;
      const dx = e.x - currX;
      const dy = e.y - currY;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        best = e;
      }
    }
    if (!best) break;
    hitSet.add(best);
    dealDamage(world, best, dmg, color, 2);

    const bolt = world.pools.bolt.acquire();
    fillBoltSegments(bolt.pts, currX, currY, best.x, best.y, 34);
    const mid = bolt.pts[Math.floor(bolt.pts.length / 2)];
    fillBoltSegments(
      bolt.branchPts,
      mid.x, mid.y,
      mid.x + (Math.random() - 0.5) * 90,
      mid.y + (Math.random() - 0.5) * 90,
      16,
    );
    bolt.targetX = best.x;
    bolt.targetY = best.y;
    bolt.hasTarget = true;
    bolt.color = color;
    bolt.isEvolved = isEvolved;
    bolt.life = 0.25;
    bolt.maxLife = 0.25;
    world.bolts.push(bolt);

    currX = best.x;
    currY = best.y;
  }
}

// ---------------------------------------------------------------- 妖瞳激光

export function spawnLaserBeam(
  world: World,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  color: string,
  dmg: number,
  isEvolved = false,
): void {
  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;
  const b = world.pools.beam.acquire();
  b.x1 = x;
  b.y1 = y;
  b.x2 = endX;
  b.y2 = endY;
  b.angle = angle;
  b.length = length;
  b.width = width;
  b.color = color;
  b.isEvolved = isEvolved;
  b.life = 0.32;
  b.maxLife = 0.32;
  world.beams.push(b);

  // 线段命中：以起点为圆心、长度半径的圆查询是线段包围盒的超集
  const idx = world.grid.queryCircle(x, y, length);
  const l2 = length * length;
  for (let k = 0; k < idx.length; k++) {
    const e = world.enemies[idx[k]];
    let t = ((e.x - x) * (endX - x) + (e.y - y) * (endY - y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x + t * (endX - x);
    const projY = y + t * (endY - y);
    const dx = e.x - projX;
    const dy = e.y - projY;
    const hitR = e.radius + width * 1.4;
    if (dx * dx + dy * dy <= hitR * hitR) {
      dealDamage(world, e, dmg, color, 3);
    }
  }
}

// ---------------------------------------------------------------- 深渊触须

export function spawnAbyssTentacles(
  world: World,
  x: number,
  y: number,
  count: number,
  maxLen: number,
  color: string,
  dmg: number,
  pullIn = false,
): void {
  for (let i = 0; i < count; i++) {
    const t = world.pools.tentacle.acquire();
    t.x = x;
    t.y = y;
    t.baseAngle = (i * Math.PI * 2) / count + (Math.random() - 0.5) * 0.3;
    t.len = maxLen;
    t.color = color;
    t.phase = Math.random() * 10;
    t.life = 0.55;
    t.maxLife = 0.55;
    world.tentacles.push(t);
  }
  hitCircle(world, x, y, maxLen + 25, dmg, color, pullIn ? -16 : 8);
}

// ---------------------------------------------------------------- 天火流星

export function spawnMeteorStrike(
  world: World,
  targetX: number,
  targetY: number,
  radius: number,
  color: string,
  dmg: number,
  isEvolved = false,
): void {
  const m = world.pools.meteor.acquire();
  m.startX = targetX - 180;
  m.startY = targetY - 320;
  m.targetX = targetX;
  m.targetY = targetY;
  m.radius = radius;
  m.color = color;
  m.dmg = dmg;
  m.isEvolved = isEvolved;
  m.progress = 0;
  m.speed = 3.4;
  world.meteors.push(m);
}

// ---------------------------------------------------------------- 地面法阵

export function spawnGroundZone(
  world: World,
  x: number,
  y: number,
  r: number,
  color: string,
  dmg: number,
  life: number,
  type: World['zones'][number]['type'],
  rot: number,
  tickTimer = 0,
): void {
  const z = world.pools.zone.acquire();
  z.x = x;
  z.y = y;
  z.r = r;
  z.color = color;
  z.dmg = dmg;
  z.life = life;
  z.maxLife = life;
  z.tickTimer = tickTimer;
  z.type = type;
  z.rot = rot;
  world.zones.push(z);
}

// ---------------------------------------------------------------- 投射物

export interface ProjectileConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  dmg: number;
  pierce: number;
  style: ProjectileStyle;
  evo?: boolean;
  homing?: boolean;
  hasTrail?: boolean;
  rot?: number;
  life: number;
}

export function spawnProjectile(world: World, cfg: ProjectileConfig): void {
  const p = world.pools.projectile.acquire();
  p.x = cfg.x;
  p.y = cfg.y;
  p.vx = cfg.vx;
  p.vy = cfg.vy;
  p.r = cfg.r;
  p.color = cfg.color;
  p.dmg = cfg.dmg;
  p.pierce = cfg.pierce;
  p.style = cfg.style;
  p.evo = cfg.evo ?? false;
  p.homing = cfg.homing ?? false;
  p.hasTrail = cfg.hasTrail ?? false;
  p.rot = cfg.rot ?? 0;
  p.life = cfg.life;
  p.trail.length = 0;
  world.projectiles.push(p);
}
