// 统一伤害结算：暴击（通灵妖魂）、生命汲取（嗜血獠牙）、击退（Boss 抗性）、
// 伤害飘字与受击火花。飘字/粒子数量有硬上限，防止高密度战斗下的渲染与 GC 压力。

import { BALANCE } from '../config/balance';
import { sfx } from '../audio/sfx';
import { getPassiveLevel } from '../progression/genes';
import type { Enemy, World } from '../game/types';

export function dealDamage(
  world: World,
  enemy: Enemy,
  amount: number,
  color = '#fef08a',
  knockback = 3,
): void {
  const player = world.player;
  const spiritLv = getPassiveLevel(player, 'spirit');
  const isCrit = Math.random() < 0.08 + spiritLv * 0.08 + player.meta.critAdd;
  let finalDmg = Math.round(amount * player.dmgMult * (isCrit ? 1.85 : 1));
  // 重甲/护盾：伤害减免（击退亦免疫）
  if (enemy.kbImmune && !enemy.isBoss) finalDmg = Math.round(finalDmg * BALANCE.armoredDamageMult);
  enemy.hp -= finalDmg;
  enemy.hurtTimer = 0.12;

  const fangLv = getPassiveLevel(player, 'fang');
  if (fangLv > 0 && Math.random() < 0.2) {
    player.hp = Math.min(player.maxHp, player.hp + fangLv * 0.7);
  }

  if (knockback !== 0) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const kb = knockback * (enemy.isBoss ? 0.15 : enemy.kbImmune ? 0 : 1);
    enemy.x += (dx / len) * kb;
    enemy.y += (dy / len) * kb;
  }

  sfx.playHit();

  if (world.texts.length < BALANCE.floatingTextCap && (isCrit || Math.random() < 0.45)) {
    const t = world.pools.text.acquire();
    t.x = enemy.x + (Math.random() - 0.5) * 14;
    t.y = enemy.y - enemy.radius;
    t.text = isCrit ? `💥${finalDmg}` : `${finalDmg}`;
    t.color = isCrit ? '#fde047' : color;
    t.size = isCrit ? 16 : 12;
    t.life = 0.45;
    world.texts.push(t);
  }

  if (world.particles.length < BALANCE.particleCap) {
    for (let i = 0; i < 2; i++) {
      const pa = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 3.5;
      const p = world.pools.particle.acquire();
      p.x = enemy.x;
      p.y = enemy.y;
      p.vx = Math.cos(pa) * spd;
      p.vy = Math.sin(pa) * spd;
      p.r = 2 + Math.random() * 2.5;
      p.color = color;
      p.life = 0.28;
      p.maxLife = 0.28;
      world.particles.push(p);
    }
  }
}
