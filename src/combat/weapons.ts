// 12 种主动器官武器 + 超武觉醒变体。数值与原 demo 一一对应。
// 冷却受"暴虐神经"被动影响（cdr），范围受"熔火核心/腐蚀毒血"影响（areaMult）。

import { getPassiveLevel } from '../progression/genes';
import { dealDamage } from './damage';
import {
  spawnAbyssTentacles,
  spawnClawSlash,
  spawnGroundZone,
  spawnLaserBeam,
  spawnLightningChain,
  spawnMeteorStrike,
  spawnProjectile,
} from './effects';
import { triggerFormInnateSkill } from './skills';
import type { World } from '../game/types';

export function updateWeapons(world: World, dt: number): void {
  const player = world.player;
  const cdr = Math.max(0.35, 1 - getPassiveLevel(player, 'nerve') * 0.1);
  const areaMult = 1 + getPassiveLevel(player, 'core') * 0.18 + getPassiveLevel(player, 'blood_s') * 0.15;

  player.formSkillTimer -= dt;
  if (player.formSkillTimer <= 0) {
    player.formSkillTimer = 2.3 * cdr;
    triggerFormInnateSkill(world, areaMult);
  }

  for (const org of player.organs) {
    if (org.id === 'spikes') continue; // 环绕骨刺为常驻环绕体，见 updateOrbitingSpikes
    org.timer -= dt;
    if (org.timer > 0) continue;

    const lv = org.level;
    const evo = org.evolved;
    const nearest = world.grid.nearest(player.x, player.y, 900);
    const aimAngle = nearest ? Math.atan2(nearest.y - player.y, nearest.x - player.x) : player.angle;

    switch (org.id) {
      case 'claw':
        org.timer = (evo ? 0.75 : 1.1) * cdr;
        spawnClawSlash(
          world,
          player.x + Math.cos(aimAngle) * 32,
          player.y + Math.sin(aimAngle) * 32,
          aimAngle,
          (evo ? 170 : 88 + lv * 12) * areaMult,
          evo ? '#f43f5e' : '#34d399',
          evo ? 72 : 24 + lv * 8,
          evo,
        );
        if (evo) player.hp = Math.min(player.maxHp, player.hp + 3.5);
        break;

      case 'venom':
        org.timer = (evo ? 1.45 : 2.0) * cdr;
        for (let i = 0; i < (evo ? 3 : 1 + Math.floor(lv / 3)); i++) {
          const a = aimAngle + (i - 1) * 0.6;
          const dist = 80 + Math.random() * 100;
          spawnGroundZone(
            world,
            player.x + Math.cos(a) * dist,
            player.y + Math.sin(a) * dist,
            (evo ? 96 : 54 + lv * 6) * areaMult,
            evo ? '#84cc16' : '#a3e635',
            evo ? 30 : 12 + lv * 4,
            evo ? 3.6 : 2.6,
            'poison_web',
            Math.random() * Math.PI,
          );
        }
        break;

      case 'horn':
        org.timer = (evo ? 1.05 : 1.65) * cdr;
        spawnLightningChain(world, player.x, player.y, evo ? 8 : 2 + lv, evo ? 68 : 25 + lv * 7, evo ? '#fde047' : '#facc15', evo);
        break;

      case 'firesac': {
        org.timer = (evo ? 1.15 : 1.6) * cdr;
        const mCount = evo ? 3 : 1;
        for (let i = 0; i < mCount; i++) {
          const tx = (nearest ? nearest.x : player.x + Math.cos(aimAngle) * 140) + (Math.random() - 0.5) * (evo ? 160 : 50);
          const ty = (nearest ? nearest.y : player.y + Math.sin(aimAngle) * 140) + (Math.random() - 0.5) * (evo ? 160 : 50);
          spawnMeteorStrike(world, tx, ty, (evo ? 105 : 62 + lv * 7) * areaMult, evo ? '#fde047' : '#fb923c', evo ? 78 : 28 + lv * 9, evo);
        }
        break;
      }

      case 'frost_b': {
        org.timer = (evo ? 1.25 : 1.5) * cdr;
        const count = evo ? 8 : 2 + Math.floor(lv / 2);
        for (let i = 0; i < count; i++) {
          const a = evo ? (i * Math.PI * 2) / count : aimAngle + (i - (count - 1) / 2) * 0.22;
          spawnProjectile(world, {
            x: player.x,
            y: player.y,
            vx: Math.cos(a) * 8.5,
            vy: Math.sin(a) * 8.5,
            r: evo ? 12 : 9,
            color: '#38bdf8',
            dmg: evo ? 52 : 19 + lv * 6,
            pierce: 2 + getPassiveLevel(player, 'crystal'),
            style: 'ice_sword',
            evo,
            life: 1.7,
          });
        }
        if (evo) {
          spawnGroundZone(world, player.x, player.y, 135 * areaMult, '#38bdf8', 35, 1.8, 'ice_sigil', world.time);
        }
        break;
      }

      case 'eye':
        org.timer = (evo ? 1.2 : 1.75) * cdr;
        spawnLaserBeam(world, player.x, player.y, aimAngle, evo ? 550 : 360, evo ? 16 : 8, evo ? '#f43f5e' : '#f472b6', evo ? 75 : 26 + lv * 8, evo);
        break;

      case 'tentacle': {
        org.timer = (evo ? 1.3 : 1.85) * cdr;
        const tTargetX = nearest ? nearest.x : player.x;
        const tTargetY = nearest ? nearest.y : player.y;
        if (evo) {
          spawnGroundZone(world, tTargetX, tTargetY, 120 * areaMult, '#c084fc', 28, 2.2, 'blackhole', 0);
        }
        spawnAbyssTentacles(world, tTargetX, tTargetY, evo ? 8 : 4 + Math.floor(lv / 2), (evo ? 125 : 78 + lv * 6) * areaMult, '#c084fc', evo ? 66 : 24 + lv * 7, evo);
        break;
      }

      case 'wing_b':
        org.timer = (evo ? 1.4 : 1.45) * cdr;
        if (evo) {
          for (let i = 0; i < 2; i++) {
            const a = aimAngle + (i - 0.5) * 0.7;
            const tor = world.pools.tornado.acquire();
            tor.x = player.x;
            tor.y = player.y;
            tor.vx = Math.cos(a) * 3.8;
            tor.vy = Math.sin(a) * 3.8;
            tor.r = 68 * areaMult;
            tor.color = '#34d399';
            tor.dmg = 34;
            tor.life = 3.0;
            tor.tickTimer = 0;
            tor.phase = Math.random() * 6;
            world.tornadoes.push(tor);
          }
        } else {
          const shots = 1 + Math.floor(lv / 2);
          for (let i = 0; i < shots; i++) {
            const a = aimAngle + (i - (shots - 1) / 2) * 0.3;
            spawnProjectile(world, {
              x: player.x,
              y: player.y,
              vx: Math.cos(a) * 7.2,
              vy: Math.sin(a) * 7.2,
              r: 13,
              color: '#2dd4bf',
              dmg: 20 + lv * 6,
              pierce: 3,
              style: 'wind_shuriken',
              life: 2.0,
            });
          }
        }
        break;

      case 'tail_h': {
        org.timer = (evo ? 1.35 : 1.9) * cdr;
        const rockR = (evo ? 185 : 105 + lv * 12) * areaMult;
        spawnGroundZone(world, player.x, player.y, rockR, '#fbbf24', 0, 0.55, 'rock_spikes', Math.random() * Math.PI, 99);
        const idx = world.grid.queryCircle(player.x, player.y, rockR + 48);
        for (let k = 0; k < idx.length; k++) {
          const e = world.enemies[idx[k]];
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const eff = rockR + e.radius;
          if (dx * dx + dy * dy <= eff * eff) {
            dealDamage(world, e, evo ? 70 : 25 + lv * 8, '#fbbf24', 14);
          }
        }
        break;
      }

      case 'sonic': {
        org.timer = (evo ? 1.3 : 1.85) * cdr;
        const sonicR = (evo ? 195 : 110 + lv * 12) * areaMult;
        spawnGroundZone(world, player.x, player.y, sonicR, '#f43f5e', 0, 0.45, 'sonic_bagua', world.time, 99);
        const idx = world.grid.queryCircle(player.x, player.y, sonicR + 48);
        for (let k = 0; k < idx.length; k++) {
          const e = world.enemies[idx[k]];
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          const eff = sonicR + e.radius;
          if (dx * dx + dy * dy <= eff * eff) {
            dealDamage(world, e, evo ? 65 : 23 + lv * 7, '#f43f5e', 8);
          }
        }
        break;
      }

      case 'spore':
      default: {
        org.timer = (evo ? 0.95 : 1.4) * cdr;
        const sCount = evo ? 5 : 1 + Math.floor(lv / 2);
        for (let i = 0; i < sCount; i++) {
          const a = aimAngle + (i - (sCount - 1) / 2) * 0.35;
          spawnProjectile(world, {
            x: player.x,
            y: player.y,
            vx: Math.cos(a) * 6.5,
            vy: Math.sin(a) * 6.5,
            r: evo ? 12 : 9,
            color: evo ? '#a3e635' : '#84cc16',
            dmg: evo ? 48 : 18 + lv * 6,
            pierce: evo ? 3 : 1,
            style: 'soul_wisp',
            homing: true,
            hasTrail: true,
            life: 2.3,
          });
        }
        break;
      }
    }
  }
}

/** 环绕骨刺：常驻环绕，拖尾残影，命中间隔受 hurtTimer 门控 */
export function updateOrbitingSpikes(world: World): void {
  const player = world.player;
  const spikeOrgan = player.organs.find((o) => o.id === 'spikes');
  if (!spikeOrgan) {
    for (const s of world.spikes) world.pools.spike.release(s);
    world.spikes.length = 0;
    return;
  }

  const count = spikeOrgan.evolved ? 8 : 2 + spikeOrgan.level;
  const orbitR = player.radius + (spikeOrgan.evolved ? 76 : 50);
  if (world.spikes.length !== count) {
    for (const s of world.spikes) world.pools.spike.release(s);
    world.spikes.length = 0;
    for (let i = 0; i < count; i++) {
      const s = world.pools.spike.acquire();
      s.x = player.x;
      s.y = player.y;
      s.angle = 0;
      s.evolved = spikeOrgan.evolved;
      s.trail.length = 0;
      world.spikes.push(s);
    }
  }

  for (let i = 0; i < count; i++) {
    const a = world.time * (spikeOrgan.evolved ? 5.2 : 3.4) + (i * Math.PI * 2) / count;
    const sx = player.x + Math.cos(a) * orbitR;
    const sy = player.y + Math.sin(a) * orbitR;
    const sp = world.spikes[i];
    sp.x = sx;
    sp.y = sy;
    sp.angle = a + Math.PI / 2;
    sp.evolved = spikeOrgan.evolved;
    sp.trail.push({ x: sx, y: sy });
    if (sp.trail.length > 7) sp.trail.shift();

    const idx = world.grid.queryCircle(sx, sy, 64);
    for (let k = 0; k < idx.length; k++) {
      const e = world.enemies[idx[k]];
      if (e.hurtTimer <= 0) {
        const dx = e.x - sx;
        const dy = e.y - sy;
        const hitR = e.radius + 16;
        if (dx * dx + dy * dy < hitR * hitR) {
          dealDamage(world, e, spikeOrgan.evolved ? 45 : 16 + spikeOrgan.level * 5, '#fde047', 4);
        }
      }
    }
  }
}
