// 升级三选一与"9 选 3"形态匹配（原 demo 公式原样移植）。

import { ALL_FORMS } from '../config/forms';
import { ACTIVE_ORGANS } from '../config/organs';
import { PASSIVE_GENES } from '../config/passives';
import { BALANCE } from '../config/balance';
import type { BeastForm, GeneId, OrganDef, PassiveDef, StageKey } from '../config/types';
import type { World } from '../game/types';
import { getPassiveLevel } from './genes';

export interface HealDef {
  id: string;
  name: string;
  tags: GeneId[];
  desc: string;
  color: string;
}

export const HEAL_CHOICE: HealDef = {
  id: 'blood',
  name: '太古祖血精华',
  tags: ['blood'],
  desc: '立即恢复 60% 气血，且永久提升 12% 攻击伤害。',
  color: '#f43f5e',
};

export type UpgradeChoice =
  | { type: 'synergy'; organId: string; def: OrganDef }
  | { type: 'active'; def: OrganDef; nextLv: number }
  | { type: 'passive'; def: PassiveDef; nextLv: number }
  | { type: 'heal'; def: HealDef };

/**
 * 生成升级三选一：
 * 1) 已有器官满级（Lv.5）且配对被动机因已拥有 → 优先提供超武共鸣；
 * 2) 否则从器官/被动池（各上限 6 种、等级上限 5）随机补足 3 项；
 * 3) 不足 3 项时用太古祖血（回血+成长）兜底。
 */
export function generateUpgradeChoices(world: World): UpgradeChoice[] {
  const player = world.player;
  const choices: UpgradeChoice[] = [];

  player.organs.forEach((org) => {
    if (org.level >= BALANCE.maxCardLevel && !org.evolved) {
      const def = ACTIVE_ORGANS.find((a) => a.id === org.id);
      if (def && getPassiveLevel(player, def.pairPassive) >= 1) {
        choices.push({ type: 'synergy', organId: org.id, def });
      }
    }
  });

  const normalPool: UpgradeChoice[] = [];
  ACTIVE_ORGANS.forEach((def) => {
    const owned = player.organs.find((o) => o.id === def.id);
    if (owned) {
      if (owned.level < BALANCE.maxCardLevel) normalPool.push({ type: 'active', def, nextLv: owned.level + 1 });
    } else if (player.organs.length < BALANCE.maxOrgans) {
      normalPool.push({ type: 'active', def, nextLv: 1 });
    }
  });

  PASSIVE_GENES.forEach((def) => {
    const owned = player.passives.find((p) => p.id === def.id);
    if (owned) {
      if (owned.level < BALANCE.maxCardLevel) normalPool.push({ type: 'passive', def, nextLv: owned.level + 1 });
    } else if (player.passives.length < BALANCE.maxPassives) {
      normalPool.push({ type: 'passive', def, nextLv: 1 });
    }
  });

  normalPool.sort(() => Math.random() - 0.5);
  for (const item of normalPool) {
    if (choices.length >= 3) break;
    choices.push(item);
  }

  while (choices.length < 3) {
    choices.push({ type: 'heal', def: HEAL_CHOICE });
  }
  return choices.slice(0, 3);
}

export interface FormMatch {
  form: BeastForm;
  score: number;
  matchPct: number;
}

/** 按九大基因亲和度权重，从本阶 9 种真身中评分取前 3（含少量随机扰动） */
export function matchTop3FormsForStage(world: World, stageNum: number): FormMatch[] {
  const player = world.player;
  const pool = ALL_FORMS[`stage${stageNum}` as StageKey] ?? [];
  const totalGenes = Object.values(player.geneCounts).reduce((a, b) => a + b, 1);

  const scored = pool.map((form) => {
    let rawScore = 0;
    form.tags.forEach((tag) => {
      rawScore += (player.geneCounts[tag] || 0) * 18;
    });
    const matchPct = Math.min(
      99,
      Math.max(45, Math.round(52 + (rawScore / Math.max(8, totalGenes * 10)) * 45 + Math.random() * 6)),
    );
    return { form, score: rawScore + Math.random() * 2, matchPct };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}
