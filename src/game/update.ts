// 主模拟循环（原 updateGame 全量移植）。
// 每步顺序与原 demo 保持一致：武器 → 环绕体 → 流星 → 龙卷 → 法阵 → 投射物 →
// 刷怪 → 敌人（移动/接触/死亡）→ 群体分离 → 经验球 → 特效衰减。
//
// 空间哈希使用说明：步进开始时构建一次（此时数组自上一帧结束以来未被增删），
// 供本步全部查询使用；敌人循环内的死亡删除发生在所有网格查询之后。

import { BALANCE } from '../config/balance';
import { decayAndCompact } from '../core/pool';
import { updateOrbitingSpikes, updateWeapons } from '../combat/weapons';
import { hitCircle, spawnGroundZone } from '../combat/effects';
import { dealDamage } from '../combat/damage';
import { getPassiveLevel } from '../progression/genes';
import { gainExp } from '../progression/leveling';
import { spawnEnemies } from './spawn';
import type { World } from './types';

export function updateWorld(world: World, dt: number, move: { x: number; y: number }): void {
  world.time += dt;
  const player = world.player;

  // 魔神心脏回血
  const heartLv = getPassiveLevel(player, 'heart');
  if (heartLv > 0) player.hp = Math.min(player.maxHp, player.hp + heartLv * 2.5 * dt);

  // 移动
  const moveLen = Math.hypot(move.x, move.y);
  if (moveLen > 0) {
    const mx = move.x / moveLen;
    const my = move.y / moveLen;
    player.x += mx * player.speed * 60 * dt;
    player.y += my * player.speed * 60 * dt;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * 3.8;
  } else {
    player.walkPhase += dt * 1.4;
  }

  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 35);

  // 本步查询用的空间哈希（位置为上一帧结束状态，与原 demo 语义一致）
  world.grid.build(world.enemies);

  updateWeapons(world, dt);
  updateOrbitingSpikes(world);

  // ---- 天火流星 ----
  for (let i = world.meteors.length - 1; i >= 0; i--) {
    const m = world.meteors[i];
    m.progress += m.speed * dt;
    if (m.progress >= 1) {
      world.shake = Math.max(world.shake, m.isEvolved ? 7 : 3);
      spawnGroundZone(world, m.targetX, m.targetY, m.radius, m.color, m.dmg * 0.35, 1.6, 'magma_crater', Math.random() * Math.PI, 0.3);
      hitCircle(world, m.targetX, m.targetY, m.radius, m.dmg, m.color, 8);
      world.meteors.splice(i, 1);
      world.pools.meteor.release(m);
    }
  }

  // ---- 螺旋龙卷飓风 ----
  for (let i = world.tornadoes.length - 1; i >= 0; i--) {
    const tor = world.tornadoes[i];
    tor.x += tor.vx * 60 * dt;
    tor.y += tor.vy * 60 * dt;
    tor.life -= dt;
    tor.phase += dt * 10;
    tor.tickTimer -= dt;
    if (tor.tickTimer <= 0) {
      tor.tickTimer = 0.3;
      hitCircle(world, tor.x, tor.y, tor.r + 15, tor.dmg, tor.color, -6);
    }
    if (tor.life <= 0) {
      world.tornadoes.splice(i, 1);
      world.pools.tornado.release(tor);
    }
  }

  // ---- 地面法阵 ----
  for (let i = world.zones.length - 1; i >= 0; i--) {
    const z = world.zones[i];
    z.life -= dt;
    z.tickTimer -= dt;
    if (z.tickTimer <= 0 && z.dmg > 0) {
      z.tickTimer = 0.45;
      hitCircle(world, z.x, z.y, z.r + 12, z.dmg, z.color, z.type === 'blackhole' ? -12 : 1);
    }
    if (z.life <= 0) {
      world.zones.splice(i, 1);
      world.pools.zone.release(z);
    }
  }

  // ---- 投射物（冰剑 / 风轮 / 鬼火） ----
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    if (p.homing) {
      const target = world.grid.nearest(p.x, p.y, 340);
      if (target) {
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        const speed = Math.hypot(p.vx, p.vy);
        p.vx = p.vx * 0.9 + Math.cos(desired) * speed * 0.1;
        p.vy = p.vy * 0.9 + Math.sin(desired) * speed * 0.1;
      }
    }
    p.x += p.vx * 60 * dt;
    p.y += p.vy * 60 * dt;
    p.rot += dt * 12;
    p.life -= dt;

    if (p.hasTrail) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();
    }

    const idx = world.grid.queryCircle(p.x, p.y, p.r + 48);
    for (let k = 0; k < idx.length; k++) {
      const e = world.enemies[idx[k]];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const hitR = e.radius + p.r;
      if (dx * dx + dy * dy < hitR * hitR) {
        dealDamage(world, e, p.dmg, p.color, 4);
        p.pierce--;
        if (p.pierce <= 0) {
          p.life = 0;
          break;
        }
      }
    }
    if (p.life <= 0) {
      world.projectiles.splice(i, 1);
      world.pools.projectile.release(p);
    }
  }

  // ---- 刷怪 ----
  spawnEnemies(world, dt);

  // ---- 敌人：死亡结算 / 追击 / 接触伤害 ----
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hurtTimer > 0) e.hurtTimer -= dt;

    if (e.hp <= 0) {
      world.kills++;
      if (player.form.id === 'taotie_fiend') player.taotieStacks++;
      if (world.gems.length < BALANCE.gemCap) {
        const g = world.pools.gem.acquire();
        g.x = e.x;
        g.y = e.y;
        g.val = e.isBoss ? 55 : 4 + Math.floor(world.time / 40);
        g.color = e.isBoss ? '#fde047' : e.accent;
        g.r = e.isBoss ? 11 : 5.5;
        g.beingPulled = false;
        world.gems.push(g);
      } else if (world.gems.length > 0) {
        world.gems[0].val += BALANCE.gemMergeValue; // 合并防止掉落物无限增长
      }
      world.enemies.splice(i, 1);
      world.pools.enemy.release(e);
      continue;
    }

    const ang = Math.atan2(player.y - e.y, player.x - e.x);
    e.angle = ang;
    e.walkPhase += dt * 3;
    e.x += Math.cos(ang) * e.speed * 60 * dt;
    e.y += Math.sin(ang) * e.speed * 60 * dt;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const hitR = player.radius + e.radius - 4;
    if (dx * dx + dy * dy < hitR * hitR) {
      if (player.hurtTimer <= 0) {
        const rawDmg = e.isBoss ? BALANCE.bossContactDmg : 10 + Math.floor(world.time / 25);
        const taken = Math.max(2, rawDmg - player.armor);
        player.hp -= taken;
        player.hurtTimer = 0.35;
        world.shake = 7;
        if (player.hp <= 0) {
          world.events.onGameOver?.();
          return;
        }
      }
    }
  }

  // ---- 群体分离（重建网格使用移动后的位置；纯位置微调，不产生伤害） ----
  if (BALANCE.separation) {
    world.grid.build(world.enemies);
    separateEnemies(world);
  }

  // ---- 吞噬基因球吸附与升级 ----
  const pullRange = (115 + getPassiveLevel(player, 'stomach') * 42) * (player.form.id === 'chaos_cub' ? 1.25 : 1);
  const pullRangeSq = pullRange * pullRange;
  for (let i = world.gems.length - 1; i >= 0; i--) {
    const g = world.gems[i];
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < pullRangeSq) {
      const dist = Math.sqrt(dSq) || 1;
      const pullSpd = 10 + (pullRange - dist) * 0.06;
      g.x += (dx / dist) * pullSpd * 60 * dt;
      g.y += (dy / dist) * pullSpd * 60 * dt;
      g.beingPulled = true;

      if (dist < player.radius + 12) {
        world.gems.splice(i, 1);
        const expGain = Math.round(g.val * (1 + getPassiveLevel(player, 'stomach') * 0.12));
        world.pools.gem.release(g);
        if (gainExp(world, expGain)) break;
      }
    } else {
      g.beingPulled = false;
    }
  }

  // ---- 特效生命周期衰减 ----
  decayAndCompact(world.slashes, dt, world.pools.slash);
  decayAndCompact(world.bolts, dt, world.pools.bolt);
  decayAndCompact(world.beams, dt, world.pools.beam);
  decayAndCompact(world.tentacles, dt, world.pools.tentacle);

  // 粒子：位移 + 衰减
  {
    const arr = world.particles;
    let w = 0;
    for (let r = 0; r < arr.length; r++) {
      const p = arr[r];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      if (p.life > 0) arr[w++] = p;
      else world.pools.particle.release(p);
    }
    arr.length = w;
  }

  // 伤害飘字：上浮 + 衰减
  {
    const arr = world.texts;
    let w = 0;
    for (let r = 0; r < arr.length; r++) {
      const t = arr[r];
      t.y -= 28 * dt;
      t.life -= dt;
      if (t.life > 0) arr[w++] = t;
      else world.pools.text.release(t);
    }
    arr.length = w;
  }
}

/** 轻量群体分离：避免高密度下单位完全重叠（对 Boss 不生效） */
function separateEnemies(world: World): void {
  const enemies = world.enemies;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.isBoss) continue;
    const idx = world.grid.queryCircle(e.x, e.y, e.radius * 1.8);
    let px = 0;
    let py = 0;
    let n = 0;
    for (let k = 0; k < idx.length && n < 6; k++) {
      const o = enemies[idx[k]];
      if (o === e || o.isBoss) continue;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const minD = e.radius + o.radius;
      const dSq = dx * dx + dy * dy;
      if (dSq > 1e-6 && dSq < minD * minD) {
        const d = Math.sqrt(dSq);
        const push = ((minD - d) / d) * 0.25;
        px += dx * push;
        py += dy * push;
        n++;
      }
    }
    const mag = Math.hypot(px, py);
    if (mag > 2) {
      px = (px / mag) * 2;
      py = (py / mag) * 2;
    }
    e.x += px;
    e.y += py;
  }
}
