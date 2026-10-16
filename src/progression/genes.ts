// 基因亲和度与属性重算（原 demo 公式原样移植）。

import { ACTIVE_ORGANS } from '../config/organs';
import { PASSIVE_GENES } from '../config/passives';
import { BALANCE } from '../config/balance';
import type { GeneId } from '../config/types';
import type { PlayerState, World } from '../game/types';

export function getPassiveLevel(player: PlayerState, id: string): number {
  const found = player.passives.find((p) => p.id === id);
  return found ? found.level : 0;
}

/**
 * 重算九大基因亲和度与派生属性。
 * 权重规则：本命真身标签 ×2；主动器官 = 等级 +（超武觉醒 ? 3 : 0）；
 * 被动突变基因 = 等级 ×2。亲和度决定每阶进化时 9 选 3 的匹配结果。
 */
export function recalculateStatsAndGenes(world: World): void {
  const player = world.player;
  const counts: Record<GeneId, number> = {
    wind: 0, fire: 0, thunder: 0, poison: 0, blood: 0, ice: 0, rock: 0, dark: 0, phantom: 0,
  };
  player.form.tags.forEach((t) => { if (counts[t] !== undefined) counts[t] += 2; });
  player.organs.forEach((o) => {
    const def = ACTIVE_ORGANS.find((a) => a.id === o.id);
    if (def) def.tags.forEach((t) => { counts[t] += o.level + (o.evolved ? 3 : 0); });
  });
  player.passives.forEach((p) => {
    const def = PASSIVE_GENES.find((g) => g.id === p.id);
    if (def) def.tags.forEach((t) => { counts[t] += p.level * 2; });
  });
  // 血脉祝福（局外解锁）：开局给对应基因亲和加成，引导进化走向
  if (world.bloodline) counts[world.bloodline] += BALANCE.bloodlineBonus;
  player.geneCounts = counts;

  const base = player.form.stats;
  const carapaceLv = getPassiveLevel(player, 'carapace');
  const heartLv = getPassiveLevel(player, 'heart');
  const fangLv = getPassiveLevel(player, 'fang');
  const featherLv = getPassiveLevel(player, 'feather');
  const muscleLv = getPassiveLevel(player, 'muscle');
  const meta = player.meta;

  const hpMult = (1 + carapaceLv * 0.15 + heartLv * 0.2 + player.taotieStacks * 0.005) * (1 + meta.hpPct);
  const oldMax = player.maxHp;
  player.maxHp = Math.round(base.hp * hpMult);
  if (player.maxHp > oldMax) player.hp += player.maxHp - oldMax;

  player.speed = base.speed * (1 + featherLv * 0.1) * (1 + meta.speedPct);
  player.dmgMult = base.dmgMult * (1 + fangLv * 0.15 + player.taotieStacks * 0.004) * (1 + meta.dmgPct);
  player.armor = base.armor + carapaceLv * 5 + meta.armorAdd;
  player.radius = (22 + player.stage * 4) * (1 + muscleLv * 0.06);

  world.events.onStatsChanged?.();
}
