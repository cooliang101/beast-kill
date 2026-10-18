// 局外成长存档（P2）。
//
// - 纯逻辑 + localStorage 持久化；localStorage 不可用（Node 测试 / 隐私模式）时
//   自动降级为内存存储，保证模块可在任何环境导入。
// - 精华（essence）在结算时按 击杀/时长/Boss/通关 与难度倍率换算。
// - 解锁内容：起始器官、血脉祝福（开局给对应基因亲和加成）、属性节点、难度层级。

import { BALANCE } from '../config/balance';
import type { GeneId } from '../config/types';
import { ACTIVE_ORGANS } from '../config/organs';
import { GENE_TAGS } from '../config/genes';

const STORAGE_KEY = 'beast-kill.save.v1';
const SAVE_VERSION = 1;

export interface MetaSave {
  version: number;
  essence: number;
  totalEarned: number;
  bestTime: number;
  clears: number;
  /** 已解锁的最高难度层级（1..4） */
  difficulty: number;
  /** 当前选择的难度层级（开局使用；解锁新难度不会自动切换） */
  selectedDifficulty: number;
  clearedTiers: number[];
  /** 已解锁的起始器官 id（默认为 claw） */
  unlockedOrgans: string[];
  unlockedBloodlines: GeneId[];
  /** 属性节点等级 */
  nodes: Record<string, number>;
  /** 图鉴点亮：形态被选用次数 */
  codexForms: Record<string, number>;
  /** 图鉴点亮：超武觉醒次数（按器官 id） */
  codexSynergies: Record<string, number>;
}

// ---------------------------------------------------------------- 属性节点

export interface NodeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  baseCost: number;
}

export const STAT_NODES: NodeDef[] = [
  { id: 'hp', name: '血肉滋养', desc: '每级 气血上限 +3%', max: 5, baseCost: 120 },
  { id: 'speed', name: '疾风之足', desc: '每级 移速 +2%', max: 5, baseCost: 120 },
  { id: 'dmg', name: '凶性激发', desc: '每级 伤害 +2%', max: 5, baseCost: 150 },
  { id: 'crit', name: '猎杀直觉', desc: '每级 暴击率 +1%', max: 5, baseCost: 150 },
  { id: 'armor', name: '玄鳞护体', desc: '每级 护甲 +1', max: 5, baseCost: 140 },
];

export function nodeCost(def: NodeDef, level: number): number {
  return def.baseCost + level * 90;
}

export const ORGAN_UNLOCK_COST = 240;
export const BLOODLINE_UNLOCK_COST = 300;
/** 可解锁为起始器官的列表（claw 默认拥有） */
export const UNLOCKABLE_ORGANS = ['venom', 'horn', 'spikes', 'frost_b', 'firesac'];

export function organName(id: string): string {
  return ACTIVE_ORGANS.find((o) => o.id === id)?.name ?? id;
}

export function bloodlineName(tag: GeneId): string {
  return GENE_TAGS[tag]?.name ?? tag;
}

/** 节点加成（在 recalculateStatsAndGenes 里叠加到派生属性上） */
export interface MetaBonuses {
  hpPct: number;
  speedPct: number;
  dmgPct: number;
  critAdd: number;
  armorAdd: number;
}

export function metaBonuses(save: MetaSave): MetaBonuses {
  const lv = (id: string): number => save.nodes[id] ?? 0;
  return {
    hpPct: lv('hp') * 0.03,
    speedPct: lv('speed') * 0.02,
    dmgPct: lv('dmg') * 0.02,
    critAdd: lv('crit') * 0.01,
    armorAdd: lv('armor'),
  };
}

// ---------------------------------------------------------------- 存读档

export function defaultSave(): MetaSave {
  return {
    version: SAVE_VERSION,
    essence: 0,
    totalEarned: 0,
    bestTime: 0,
    clears: 0,
    difficulty: 1,
    selectedDifficulty: 1,
    clearedTiers: [],
    unlockedOrgans: ['claw'],
    unlockedBloodlines: [],
    nodes: {},
    codexForms: {},
    codexSynergies: {},
  };
}

/** 内存兜底：Node / 隐私模式下 localStorage 不可用时使用 */
let memoryStore: string | null = null;

function readRaw(): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(STORAGE_KEY);
  } catch {
    /* 隐私模式等：降级为内存 */
  }
  return memoryStore;
}

function writeRaw(value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
      return;
    }
  } catch {
    /* 降级 */
  }
  memoryStore = value;
}

/** 兼容旧档：缺字段补默认值 */
function normalize(raw: Partial<MetaSave>): MetaSave {
  const d = defaultSave();
  const unlocked = Math.max(1, Math.min(BALANCE.maxDifficulty, raw.difficulty ?? d.difficulty));
  // 关键：解锁新难度不自动提高当前选择（旧档没有该字段时统一回到 1 档）
  const selected = Math.max(1, Math.min(unlocked, raw.selectedDifficulty ?? 1));
  return {
    ...d,
    ...raw,
    version: SAVE_VERSION,
    difficulty: unlocked,
    selectedDifficulty: selected,
    unlockedOrgans: Array.isArray(raw.unlockedOrgans) && raw.unlockedOrgans.length > 0 ? raw.unlockedOrgans : d.unlockedOrgans,
    unlockedBloodlines: Array.isArray(raw.unlockedBloodlines) ? raw.unlockedBloodlines : [],
    clearedTiers: Array.isArray(raw.clearedTiers) ? raw.clearedTiers : [],
    nodes: raw.nodes && typeof raw.nodes === 'object' ? raw.nodes : {},
    codexForms: raw.codexForms && typeof raw.codexForms === 'object' ? raw.codexForms : {},
    codexSynergies: raw.codexSynergies && typeof raw.codexSynergies === 'object' ? raw.codexSynergies : {},
  };
}

export function loadMeta(): MetaSave {
  const raw = readRaw();
  if (!raw) return defaultSave();
  try {
    return normalize(JSON.parse(raw) as Partial<MetaSave>);
  } catch {
    return defaultSave();
  }
}

export function persistMeta(save: MetaSave): void {
  writeRaw(JSON.stringify(save));
}

/** 仅测试用：清空内存兜底 */
export function resetMemoryStore(): void {
  memoryStore = null;
}

// ---------------------------------------------------------------- 精华结算

export interface RunStats {
  kills: number;
  time: number;
  bossesKilled: number;
  victory: boolean;
  difficulty: number;
}

export function computeEssence(stats: RunStats): number {
  const base =
    stats.kills * BALANCE.essencePerKill +
    Math.floor(stats.time) * BALANCE.essencePerSecond +
    stats.bossesKilled * BALANCE.essencePerBoss +
    (stats.victory ? BALANCE.essenceVictoryBonus : 0);
  const mult = BALANCE.difficultyEssenceMult[Math.min(stats.difficulty, BALANCE.maxDifficulty) - 1] ?? 1;
  return Math.round(base * mult);
}

export function difficultyName(tier: number): string {
  return BALANCE.difficultyNames[Math.min(tier, BALANCE.maxDifficulty) - 1] ?? `难度${tier}`;
}

/** 结算入账：精华、最佳时长、通关与难度解锁 */
export function settleRun(save: MetaSave, stats: RunStats): { gained: number; unlockedTier: number | null } {
  const gained = computeEssence(stats);
  save.essence += gained;
  save.totalEarned += gained;
  save.bestTime = Math.max(save.bestTime, Math.floor(stats.time));

  let unlockedTier: number | null = null;
  if (stats.victory) {
    save.clears++;
    if (!save.clearedTiers.includes(stats.difficulty)) save.clearedTiers.push(stats.difficulty);
    const next = stats.difficulty + 1;
    if (next <= BALANCE.maxDifficulty && next > save.difficulty) {
      save.difficulty = next;
      unlockedTier = next;
    }
  }
  persistMeta(save);
  return { gained, unlockedTier };
}

// ---------------------------------------------------------------- 图鉴点亮

export function recordFormUse(save: MetaSave, formId: string): void {
  save.codexForms[formId] = (save.codexForms[formId] ?? 0) + 1;
  persistMeta(save);
}

export function recordSynergy(save: MetaSave, organId: string): void {
  save.codexSynergies[organId] = (save.codexSynergies[organId] ?? 0) + 1;
  persistMeta(save);
}
