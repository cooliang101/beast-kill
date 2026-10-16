// 本命神通：按当前真身标签触发（原 demo 原样移植）。

import { spawnAbyssTentacles, spawnClawSlash, spawnLightningChain, spawnMeteorStrike, spawnProjectile } from './effects';
import type { World } from '../game/types';

export function triggerFormInnateSkill(world: World, areaMult: number): void {
  const player = world.player;
  const f = player.form;
  const stageDmg = 22 * Math.pow(1.65, player.stage - 1);
  const nearest = world.grid.nearest(player.x, player.y, 900);
  const aim = nearest ? Math.atan2(nearest.y - player.y, nearest.x - player.x) : player.angle;

  if (f.tags.includes('thunder')) {
    spawnLightningChain(world, player.x, player.y, 2 + player.stage * 2, stageDmg, f.secondary, player.stage >= 4);
  }
  if (f.tags.includes('wind') || f.tags.includes('blood')) {
    spawnClawSlash(world, player.x, player.y, aim, (85 + player.stage * 22) * areaMult, f.secondary, stageDmg, player.stage >= 4);
  }
  if (f.tags.includes('fire')) {
    const tx = nearest ? nearest.x : player.x + Math.cos(aim) * 120;
    const ty = nearest ? nearest.y : player.y + Math.sin(aim) * 120;
    spawnMeteorStrike(world, tx, ty, (65 + player.stage * 16) * areaMult, f.secondary, stageDmg, player.stage >= 4);
  }
  if (f.tags.includes('dark') || f.tags.includes('poison')) {
    const tx = nearest ? nearest.x : player.x;
    const ty = nearest ? nearest.y : player.y;
    spawnAbyssTentacles(world, tx, ty, 3 + player.stage, (65 + player.stage * 15) * areaMult, f.secondary, stageDmg * 0.8, f.tags.includes('dark'));
  }
  if (f.tags.includes('ice') || f.tags.includes('phantom') || f.tags.includes('rock')) {
    const num = 3 + player.stage * 2;
    for (let i = 0; i < num; i++) {
      const a = (i * Math.PI * 2) / num + world.time;
      spawnProjectile(world, {
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * 7.5,
        vy: Math.sin(a) * 7.5,
        r: 9 + player.stage,
        color: f.secondary,
        dmg: stageDmg * 0.85,
        pierce: 2,
        style: f.tags.includes('ice') ? 'ice_sword' : 'wind_shuriken',
        homing: f.tags.includes('phantom'),
        rot: a,
        life: 1.8,
      });
    }
  }
}
