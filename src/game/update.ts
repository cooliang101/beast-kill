// 主模拟循环（原 updateGame 全量移植 + P1 遭遇系统）。
// 每步顺序：武器 → 环绕体 → 流星 → 龙卷 → 法阵 → 投射物 → 刷怪（含波次导演）→
// 敌人（行为/接触/死亡）→ 敌方弹幕 → 网格重建 → 治疗光环 → 群体分离 → 经验球 → 特效衰减。
//
// 空间哈希使用说明：步进开始时构建一次（此时数组自上一帧结束以来未被增删），
// 供本步全部查询使用；敌人循环内的死亡删除发生在所有"步首查询"之后，
// 而治疗光环/分离使用敌人循环后重建的网格，索引始终有效。

import { BALANCE } from '../config/balance';
import { decayAndCompact } from '../core/pool';
import { updateOrbitingSpikes, updateWeapons } from '../combat/weapons';
import { hitCircle, spawnGroundZone } from '../combat/effects';
import { dealDamage } from '../combat/damage';
import { getPassiveLevel } from '../progression/genes';
import { gainExp } from '../progression/leveling';
import { spawnEnemies, spawnEnemyShot, spawnSplitChildren } from './spawn';
import type { Enemy, World } from './types';

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

  // ---- 刷怪（内部推进波次导演与随机事件） ----
  spawnEnemies(world, dt);

  // 存活时限通关
  checkVictory(world);

  // ---- 敌人：死亡结算 / 行为驱动移动 / 接触伤害 ----
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hurtTimer > 0) e.hurtTimer -= dt;
    if (e.regen > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);

    if (e.hp <= 0) {
      const playerDied = handleEnemyDeath(world, e);
      world.enemies.splice(i, 1);
      world.pools.enemy.release(e);
      if (playerDied) return;
      continue;
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    e.angle = ang;
    e.walkPhase += dt * 3;

    const speed = e.speed * world.enemySpeedMult;
    let mvx = Math.cos(ang);
    let mvy = Math.sin(ang);
    let moved = false;

    switch (e.behavior) {
      case 'ranged': {
        // 保持距离 + 横向游走 + 周期弹幕
        const keep = BALANCE.rangedKeepDist;
        const toward = dist > keep + 40 ? 1 : dist < keep - 40 ? -1 : 0;
        const strafe = Math.sin(world.time * 1.6 + e.walkPhase) * 0.55;
        mvx = Math.cos(ang) * toward + Math.cos(ang + Math.PI / 2) * strafe;
        mvy = Math.sin(ang) * toward + Math.sin(ang + Math.PI / 2) * strafe;
        e.actionTimer -= dt;
        if (e.actionTimer <= 0 && dist < 640) {
          e.actionTimer = BALANCE.rangedFireCd;
          spawnEnemyShot(world, e.x, e.y, ang, BALANCE.rangedShotDmg, e.accent, BALANCE.rangedShotSpeed);
        }
        break;
      }
      case 'charger': {
        if (e.actionState === 0) {
          e.actionTimer -= dt;
          if (e.actionTimer <= 0 && dist < BALANCE.chargerTriggerDist) {
            e.actionState = 1;
            e.actionTimer = BALANCE.chargerWindup;
          }
        } else if (e.actionState === 1) {
          // 蓄力：原地不动（视觉上配合颤抖）
          e.actionTimer -= dt;
          if (e.actionTimer <= 0) {
            e.actionState = 2;
            e.actionTimer = BALANCE.chargerDashTime;
            e.dashVx = Math.cos(ang) * BALANCE.chargerDashSpeed;
            e.dashVy = Math.sin(ang) * BALANCE.chargerDashSpeed;
          }
          moved = true;
        } else if (e.actionState === 2) {
          e.x += e.dashVx * 60 * dt;
          e.y += e.dashVy * 60 * dt;
          e.actionTimer -= dt;
          if (e.actionTimer <= 0) {
            e.actionState = 3;
            e.actionTimer = BALANCE.chargerRecover;
          }
          moved = true;
        } else {
          // 硬直
          e.actionTimer -= dt;
          if (e.actionTimer <= 0) {
            e.actionState = 0;
            e.actionTimer = 0.4;
          }
          moved = true;
        }
        break;
      }
      case 'buffer': {
        mvx = Math.cos(ang) * 0.7;
        mvy = Math.sin(ang) * 0.7;
        break;
      }
      case 'flee': {
        mvx = -Math.cos(ang) + Math.cos(ang + Math.PI / 2) * 0.55;
        mvy = -Math.sin(ang) + Math.sin(ang + Math.PI / 2) * 0.55;
        break;
      }
      default:
        break;
    }

    if (!moved) {
      const len = Math.hypot(mvx, mvy) || 1;
      e.x += (mvx / len) * speed * 60 * dt;
      e.y += (mvy / len) * speed * 60 * dt;
    }

    // ---- 接触伤害 ----
    const cdx = player.x - e.x;
    const cdy = player.y - e.y;
    const hitR = player.radius + e.radius - 4;
    if (cdx * cdx + cdy * cdy < hitR * hitR) {
      const base = (e.isBoss ? BALANCE.bossContactDmg : 10 + Math.floor(world.time / 25)) * e.contactMult;
      if (damagePlayer(world, base * difficultyDmgMult(world))) return;
    }
  }

  // ---- 敌方弹幕 ----
  for (let i = world.enemyShots.length - 1; i >= 0; i--) {
    const s = world.enemyShots[i];
    s.x += s.vx * 60 * dt;
    s.y += s.vy * 60 * dt;
    s.life -= dt;
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const hitR = player.radius + s.r;
    if (dx * dx + dy * dy < hitR * hitR) {
      world.enemyShots.splice(i, 1);
      world.pools.enemyShot.release(s);
      if (damagePlayer(world, s.dmg * difficultyDmgMult(world))) return;
      continue;
    }
    if (s.life <= 0) {
      world.enemyShots.splice(i, 1);
      world.pools.enemyShot.release(s);
    }
  }

  // ---- 网格重建（移动后的位置）：治疗光环与群体分离共用，索引有效 ----
  world.grid.build(world.enemies);
  applyBufferAuras(world, dt);
  if (BALANCE.separation) separateEnemies(world);

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

// ---------------------------------------------------------------- 玩家受伤

function difficultyDmgMult(world: World): number {
  return BALANCE.difficultyEnemyDmgMult[Math.min(world.difficulty, BALANCE.maxDifficulty) - 1] ?? 1;
}

/** 统一的玩家受伤入口（接触伤害 / 敌方弹幕 / 爆裂词缀）。
 *  返回 true 表示玩家死亡（调用方应立即中止本步剩余逻辑）。 */
export function damagePlayer(world: World, rawDmg: number): boolean {
  const player = world.player;
  if (player.hurtTimer > 0) return false;
  const taken = Math.max(2, Math.round(rawDmg) - player.armor);
  player.hp -= taken;
  player.hurtTimer = 0.35;
  world.shake = 7;
  if (player.hp <= 0) {
    world.events.onGameOver?.();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- 击杀结算

/** 返回 true 表示玩家因爆裂词缀死亡 */
function handleEnemyDeath(world: World, e: Enemy): boolean {
  const player = world.player;
  world.kills++;
  if (player.form.id === 'taotie_fiend') player.taotieStacks++;

  // 分裂（行为或词缀）
  if (e.behavior === 'splitter' || e.affix === 'splitting') {
    spawnSplitChildren(world, e, BALANCE.splitterChildren);
  }

  // 爆裂词缀：近身范围伤害（保持距离即可规避）
  let playerDied = false;
  if (e.affix === 'explosive') {
    spawnGroundZone(world, e.x, e.y, BALANCE.explodeRadius, '#fb923c', 0, 0.5, 'magma_crater', Math.random() * Math.PI, 99);
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    if (dx * dx + dy * dy < BALANCE.explodeRadius * BALANCE.explodeRadius) {
      playerDied = damagePlayer(world, BALANCE.explodeDmg * difficultyDmgMult(world));
    }
  }

  // 掉落
  const expMult = world.enemyExpMult * (e.elite ? BALANCE.eliteExpMult : 1);
  if (e.behavior === 'flee') {
    // 宝物妖：宝石簇
    for (let i = 0; i < BALANCE.treasureGemCount; i++) {
      if (world.gems.length >= BALANCE.gemCap + 60) break;
      const a = (i / BALANCE.treasureGemCount) * Math.PI * 2;
      const g = world.pools.gem.acquire();
      g.x = e.x + Math.cos(a) * 34;
      g.y = e.y + Math.sin(a) * 34;
      g.val = Math.round(26 * expMult);
      g.color = '#fde047';
      g.r = 9;
      g.beingPulled = false;
      world.gems.push(g);
    }
  } else if (world.gems.length < BALANCE.gemCap) {
    const g = world.pools.gem.acquire();
    g.x = e.x;
    g.y = e.y;
    g.val = Math.round((e.isBoss ? 55 : 4 + Math.floor(world.time / 40)) * expMult);
    g.color = e.isBoss ? '#fde047' : e.accent;
    g.r = e.isBoss ? 11 : e.elite ? 8 : 5.5;
    g.beingPulled = false;
    world.gems.push(g);
  } else if (world.gems.length > 0) {
    world.gems[0].val += BALANCE.gemMergeValue; // 合并防止掉落物无限增长
  }

  // Boss 计数与胜利判定
  if (e.isBoss) {
    world.bossesKilled++;
    world.shake = Math.max(world.shake, 10);
    checkVictory(world);
  }
  return playerDied;
}

// ---------------------------------------------------------------- 治疗光环

/** 治疗光环：为周围敌人回血并留下法阵视觉（在网格重建后调用，索引有效） */
function applyBufferAuras(world: World, dt: number): void {
  for (const e of world.enemies) {
    if (e.behavior !== 'buffer' || e.hp <= 0) continue;
    e.actionTimer -= dt;
    if (e.actionTimer > 0) continue;
    e.actionTimer = BALANCE.bufferPeriod;
    const r = BALANCE.bufferRadius;
    const idx = world.grid.queryCircle(e.x, e.y, r);
    for (let k = 0; k < idx.length; k++) {
      const o = world.enemies[idx[k]];
      if (!o || o === e || o.hp <= 0) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy > r * r) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * BALANCE.bufferHealPct);
    }
    spawnGroundZone(world, e.x, e.y, r, '#84cc16', 0, 0.35, 'sonic_bagua', Math.random() * Math.PI, 99);
  }
}

// ---------------------------------------------------------------- 胜利条件

/** 击败指定数量 Boss 或存活到时限即通关（endless 模式下不再触发） */
export function checkVictory(world: World): void {
  if (world.victory || world.endless) return;
  if (world.bossesKilled >= BALANCE.victoryBosses || world.time >= BALANCE.victoryTime) {
    world.victory = true;
    world.events.onVictory?.();
  }
}

// ---------------------------------------------------------------- 群体分离

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
      if (!o || o === e || o.isBoss) continue;
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
