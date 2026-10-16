// 本局构筑汇总（纯函数，可在 Node 中单测）。
// 把玩家当前形态/器官/被动换算成：派生属性数值 + 每个器官的超武觉醒状态。
// UI（buildPanel）只负责渲染，不做任何数值推导。

import { ACTIVE_ORGANS } from '../config/organs';
import { PASSIVE_GENES } from '../config/passives';
import type { OrganDef, PassiveDef } from '../config/types';
import type { PlayerState } from '../game/types';
import { getPassiveLevel } from './genes';

/** 超武状态机：未获得 → 升级中 → 缺被动/可觉醒 → 已觉醒 */
export type SynergyStatus = 'locked' | 'leveling' | 'needsPassive' | 'ready' | 'awakened';

export interface BuildOrganEntry {
  def: OrganDef;
  owned: boolean;
  level: number;
  evolved: boolean;
  passiveDef: PassiveDef | undefined;
  passiveOwned: boolean;
  passiveLevel: number;
  status: SynergyStatus;
}

export interface BuildPassiveEntry {
  def: PassiveDef;
  owned: boolean;
  level: number;
}

export interface DerivedStats {
  critChance: number;
  lifestealChance: number;
  lifestealAmount: number;
  cdrReduction: number;
  areaMult: number;
  regenPerSec: number;
  pullRange: number;
  expBonusPct: number;
  hpBonusPct: number;
  dmgBonusPct: number;
  speedBonusPct: number;
  armorBonus: number;
  radiusBonusPct: number;
  pierceBonus: number;
}

export interface BuildSummary {
  organs: BuildOrganEntry[];
  passives: BuildPassiveEntry[];
  ownedOrganCount: number;
  ownedPassiveCount: number;
  awakenedCount: number;
  readyCount: number;
  derived: DerivedStats;
  geneTotal: number;
}

function organStatus(owned: boolean, level: number, evolved: boolean, passiveOwned: boolean): SynergyStatus {
  if (!owned) return 'locked';
  if (evolved) return 'awakened';
  if (level < 5) return 'leveling';
  return passiveOwned ? 'ready' : 'needsPassive';
}

export function summarizeBuild(player: PlayerState): BuildSummary {
  const organs: BuildOrganEntry[] = ACTIVE_ORGANS.map((def) => {
    const slot = player.organs.find((o) => o.id === def.id);
    const passiveDef = PASSIVE_GENES.find((p) => p.id === def.pairPassive);
    const passiveSlot = player.passives.find((p) => p.id === def.pairPassive);
    const owned = !!slot;
    const level = slot?.level ?? 0;
    const evolved = slot?.evolved ?? false;
    const passiveOwned = !!passiveSlot;
    return {
      def,
      owned,
      level,
      evolved,
      passiveDef,
      passiveOwned,
      passiveLevel: passiveSlot?.level ?? 0,
      status: organStatus(owned, level, evolved, passiveOwned),
    };
  });

  const passives: BuildPassiveEntry[] = PASSIVE_GENES.map((def) => {
    const slot = player.passives.find((p) => p.id === def.id);
    return { def, owned: !!slot, level: slot?.level ?? 0 };
  });

  const carapaceLv = getPassiveLevel(player, 'carapace');
  const heartLv = getPassiveLevel(player, 'heart');
  const fangLv = getPassiveLevel(player, 'fang');
  const featherLv = getPassiveLevel(player, 'feather');
  const muscleLv = getPassiveLevel(player, 'muscle');
  const spiritLv = getPassiveLevel(player, 'spirit');
  const nerveLv = getPassiveLevel(player, 'nerve');
  const coreLv = getPassiveLevel(player, 'core');
  const bloodSLv = getPassiveLevel(player, 'blood_s');
  const crystalLv = getPassiveLevel(player, 'crystal');
  const stomachLv = getPassiveLevel(player, 'stomach');

  const derived: DerivedStats = {
    critChance: 0.08 + spiritLv * 0.08,
    lifestealChance: fangLv > 0 ? 0.2 : 0,
    lifestealAmount: fangLv * 0.7,
    // 与 updateWeapons 的 cdr 公式一致：冷却系数下限 0.35
    cdrReduction: 1 - Math.max(0.35, 1 - nerveLv * 0.1),
    areaMult: 1 + coreLv * 0.18 + bloodSLv * 0.15,
    regenPerSec: heartLv * 2.5,
    pullRange: (115 + stomachLv * 42) * (player.form.id === 'chaos_cub' ? 1.25 : 1),
    expBonusPct: stomachLv * 0.12,
    hpBonusPct: carapaceLv * 0.15 + heartLv * 0.2 + player.taotieStacks * 0.005,
    dmgBonusPct: fangLv * 0.15 + player.taotieStacks * 0.004,
    speedBonusPct: featherLv * 0.1,
    armorBonus: carapaceLv * 5,
    radiusBonusPct: muscleLv * 0.06,
    pierceBonus: crystalLv,
  };

  return {
    organs,
    passives,
    ownedOrganCount: organs.filter((o) => o.owned).length,
    ownedPassiveCount: passives.filter((p) => p.owned).length,
    awakenedCount: organs.filter((o) => o.status === 'awakened').length,
    readyCount: organs.filter((o) => o.status === 'ready').length,
    derived,
    geneTotal: Object.values(player.geneCounts).reduce((a, b) => a + b, 0),
  };
}

export const SYNERGY_STATUS_TEXT: Record<SynergyStatus, string> = {
  locked: '未获得',
  leveling: '需满级 Lv.5',
  needsPassive: '缺配对被动',
  ready: '可觉醒',
  awakened: '已觉醒',
};
