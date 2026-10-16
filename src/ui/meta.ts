// 局外成长 UI（P2）：吞噬祭坛（解锁树）、开局准备（择器降世 + 血脉祝福）、
// 胜负统一结算、随机事件横幅。
//
// 数值与存档规则全在 src/meta/save.ts；本文件只做渲染与交互。

import { BALANCE } from '../config/balance';
import { GENE_TAGS } from '../config/genes';
import { ACTIVE_ORGANS } from '../config/organs';
import { getOrganSvg } from './icons';
import { showHint } from './modals';
import { drawEndPreview } from './previews';
import {
  BLOODLINE_UNLOCK_COST,
  ORGAN_UNLOCK_COST,
  STAT_NODES,
  UNLOCKABLE_ORGANS,
  difficultyName,
  nodeCost,
  persistMeta,
} from '../meta/save';
import type { Game } from '../game/game';
import type { GeneId } from '../config/types';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 DOM 节点 #${id}`);
  return el;
}

function byIdOpt(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) console.warn(`[UI] 缺少 DOM 节点 #${id}（若浏览器缓存了旧页面，请 Ctrl+Shift+R 强制刷新）`);
  return el;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- 事件横幅

let eventTimer = 0;

/** 随机事件 / 精英播报横幅（自动消失） */
export function showEventBanner(label: string, color: string): void {
  const el = byIdOpt('eventBanner');
  if (!el) return;
  el.textContent = label;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.remove('hidden');
  window.clearTimeout(eventTimer);
  eventTimer = window.setTimeout(() => el.classList.add('hidden'), 2800);
}

// ---------------------------------------------------------------- 吞噬祭坛

let metaReturn: (() => void) | null = null;

export function openMetaModal(game: Game, returnTo?: () => void): void {
  metaReturn = returnTo ?? null;
  renderMetaModal(game);
  byIdOrNull('metaModal')?.classList.remove('hidden');
}

function byIdOrNull(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function closeMetaModal(): void {
  byIdOrNull('metaModal')?.classList.add('hidden');
  const ret = metaReturn;
  metaReturn = null;
  ret?.();
}

function renderMetaModal(game: Game): void {
  const host = byIdOpt('metaContent');
  if (!host) return;
  const m = game.meta;

  byId('metaEssence').textContent = `💠 ${m.essence.toLocaleString()}`;
  byId('metaSummary').textContent =
    `累计精华 ${m.totalEarned.toLocaleString()} · 通关 ${m.clears} 次 · 最长存活 ${fmtTime(m.bestTime)} · 当前难度：${difficultyName(m.difficulty)}`;

  // ---- 难度层级（通关自动解锁，无需购买） ----
  const diffCards = BALANCE.difficultyNames
    .map((name, i) => {
      const tier = i + 1;
      const unlocked = tier <= m.difficulty;
      const cleared = m.clearedTiers.includes(tier);
      const cls = cleared
        ? 'border-emerald-400/60 bg-emerald-950/40 text-emerald-200'
        : unlocked
          ? 'border-amber-400/50 bg-slate-900/90 text-amber-200'
          : 'border-slate-700/50 bg-slate-950/60 text-slate-500';
      return `
        <div class="rounded-none border ${cls} p-3">
          <div class="font-bold mb-1">${cleared ? '✅' : unlocked ? '⚔️' : '🔒'} ${name}</div>
          <div class="text-[11px] text-slate-400">敌人强度 ×${BALANCE.difficultyEnemyHpMult[i]} · 精华收益 ×${BALANCE.difficultyEssenceMult[i]}</div>
          <div class="text-[11px] mt-1">${cleared ? '已通关' : unlocked ? '可挑战' : `通关「${difficultyName(tier - 1)}」后解锁`}</div>
        </div>`;
    })
    .join('');

  // ---- 血脉祝福 ----
  const bloodlineCards = Object.values(GENE_TAGS)
    .map((gt) => {
      const owned = m.unlockedBloodlines.includes(gt.id);
      const cls = owned ? 'border-purple-400/60 bg-purple-950/50 text-purple-100' : 'border-slate-700/50 bg-slate-900/80 text-slate-300 hover:border-purple-400/50';
      return `
        <button data-buy-bloodline="${gt.id}" class="rounded-none border ${cls} px-3 py-2 text-sm font-bold cursor-pointer transition">
          ${gt.name} 血脉
          <span class="block text-[10px] font-normal ${owned ? 'text-purple-300' : 'text-amber-300'}">${owned ? '已解锁 · 开局可选' : `💠 ${BLOODLINE_UNLOCK_COST}`}</span>
        </button>`;
    })
    .join('');

  // ---- 起始器官 ----
  const organIds = ['claw', ...UNLOCKABLE_ORGANS];
  const organCards = organIds
    .map((id) => {
      const def = ACTIVE_ORGANS.find((o) => o.id === id);
      if (!def) return '';
      const owned = m.unlockedOrgans.includes(id);
      const cls = owned ? 'border-amber-400/60 bg-slate-900/90' : 'border-slate-700/50 bg-slate-950/60 opacity-80 hover:border-amber-400/50';
      return `
        <button data-buy-organ="${id}" class="rounded-none border ${cls} p-3 flex items-center gap-2.5 text-left cursor-pointer transition">
          <span class="w-9 h-9 rounded-none bg-slate-950 border border-amber-500/30 p-1.5 shrink-0">${getOrganSvg(def.id, def.color)}</span>
          <span class="min-w-0">
            <span class="block text-sm font-bold text-amber-100 truncate">${def.name}</span>
            <span class="block text-[10px] ${owned ? 'text-emerald-300' : 'text-amber-300'}">${owned ? '已解锁' : `💠 ${ORGAN_UNLOCK_COST} 解锁为起始器官`}</span>
          </span>
        </button>`;
    })
    .join('');

  // ---- 属性节点 ----
  const nodeCards = STAT_NODES.map((def) => {
    const lv = m.nodes[def.id] ?? 0;
    const maxed = lv >= def.max;
    const cost = nodeCost(def, lv);
    const dots = Array.from({ length: def.max }, (_, i) => (i < lv ? '●' : '○')).join('');
    const btn = maxed
      ? `<span class="text-[11px] text-emerald-300 font-bold">已满级</span>`
      : `<button data-buy-node="${def.id}" class="text-[11px] font-bold px-2 py-1 rounded-none border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/30 cursor-pointer">升级 💠 ${cost}</button>`;
    return `
      <div class="rounded-none border border-slate-700/50 bg-slate-900/90 p-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-bold text-slate-100">${def.name} <span class="text-amber-300 text-[11px] tracking-widest">${dots}</span></div>
          <div class="text-[11px] text-slate-400">${def.desc}</div>
        </div>
        ${btn}
      </div>`;
  }).join('');

  host.innerHTML = `
    <div>
      <div class="text-xs font-bold text-amber-300 mb-2">🏔 难度层级（通关上一层即解锁，精华收益随难度提高）</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">${diffCards}</div>
    </div>

    <div>
      <div class="text-xs font-bold text-purple-300 mb-2">🩸 血脉祝福（开局给对应基因亲和 +${BALANCE.bloodlineBonus}，引导 9 选 3 的进化方向）</div>
      <div class="grid grid-cols-3 md:grid-cols-5 gap-2">${bloodlineCards}</div>
    </div>

    <div>
      <div class="text-xs font-bold text-amber-300 mb-2">⚔️ 起始器官（开局即拥有的主动器官，改变整局构筑起点）</div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5">${organCards}</div>
    </div>

    <div>
      <div class="text-xs font-bold text-emerald-300 mb-2">🌱 属性节点（小幅、有上限的永久强化）</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">${nodeCards}</div>
    </div>
  `;

  // 购买交互
  host.querySelectorAll<HTMLElement>('[data-buy-node]').forEach((el) => {
    el.onclick = () => buyNode(game, el.dataset.buyNode ?? '');
  });
  host.querySelectorAll<HTMLElement>('[data-buy-organ]').forEach((el) => {
    el.onclick = () => buyOrgan(game, el.dataset.buyOrgan ?? '');
  });
  host.querySelectorAll<HTMLElement>('[data-buy-bloodline]').forEach((el) => {
    el.onclick = () => buyBloodline(game, el.dataset.buyBloodline as GeneId);
  });
}

function spend(game: Game, cost: number): boolean {
  if (game.meta.essence < cost) {
    showHint('精华不足 · 多吞噬几局再来');
    return false;
  }
  game.meta.essence -= cost;
  return true;
}

function buyNode(game: Game, id: string): void {
  const def = STAT_NODES.find((n) => n.id === id);
  if (!def) return;
  const lv = game.meta.nodes[id] ?? 0;
  if (lv >= def.max) return;
  if (!spend(game, nodeCost(def, lv))) return;
  game.meta.nodes[id] = lv + 1;
  persistMeta(game.meta);
  renderMetaModal(game);
}

function buyOrgan(game: Game, id: string): void {
  if (game.meta.unlockedOrgans.includes(id)) return;
  if (!UNLOCKABLE_ORGANS.includes(id)) return;
  if (!spend(game, ORGAN_UNLOCK_COST)) return;
  game.meta.unlockedOrgans.push(id);
  persistMeta(game.meta);
  renderMetaModal(game);
}

function buyBloodline(game: Game, tag: GeneId): void {
  if (game.meta.unlockedBloodlines.includes(tag)) return;
  if (!spend(game, BLOODLINE_UNLOCK_COST)) return;
  game.meta.unlockedBloodlines.push(tag);
  persistMeta(game.meta);
  renderMetaModal(game);
}

// ---------------------------------------------------------------- 开局准备

let prepOrgan = 'claw';
let prepBloodline: GeneId | null = null;

export function openRunPrep(game: Game, onConfirm: (organId: string, bloodline: GeneId | null) => void): void {
  const unlocked = game.meta.unlockedOrgans;
  prepOrgan = unlocked.includes(prepOrgan) ? prepOrgan : (unlocked[0] ?? 'claw');
  if (prepBloodline && !game.meta.unlockedBloodlines.includes(prepBloodline)) prepBloodline = null;
  renderRunPrep(game, onConfirm);
  byIdOrNull('runPrepModal')?.classList.remove('hidden');
}

export function closeRunPrep(): void {
  byIdOrNull('runPrepModal')?.classList.add('hidden');
}

function renderRunPrep(game: Game, onConfirm: (organId: string, bloodline: GeneId | null) => void): void {
  const m = game.meta;
  const organHost = byIdOpt('prepOrgans');
  const bloodHost = byIdOpt('prepBloodlines');
  const summary = byIdOpt('prepSummary');
  if (!organHost || !bloodHost || !summary) return;

  summary.innerHTML =
    `难度：<b class="text-amber-300">${difficultyName(m.difficulty)}</b>（精华收益 ×${BALANCE.difficultyEssenceMult[Math.min(m.difficulty, BALANCE.maxDifficulty) - 1]}） · ` +
    `局外加成已生效（气血/移速/伤害/暴击/护甲节点） · 通关目标：击败 <b>${BALANCE.victoryBosses}</b> 个洪荒霸主 或存活 ${Math.round(BALANCE.victoryTime / 60)} 分钟`;

  organHost.innerHTML = m.unlockedOrgans
    .map((id) => {
      const def = ACTIVE_ORGANS.find((o) => o.id === id);
      if (!def) return '';
      const active = id === prepOrgan;
      return `
        <button data-prep-organ="${id}" class="rounded-none border ${active ? 'border-amber-400 bg-amber-500/15' : 'border-slate-700/50 bg-slate-900/80 hover:border-amber-400/60'} p-3 flex items-center gap-2.5 text-left cursor-pointer transition">
          <span class="w-9 h-9 rounded-none bg-slate-950 border border-amber-500/30 p-1.5 shrink-0">${getOrganSvg(def.id, def.color)}</span>
          <span class="min-w-0">
            <span class="block text-sm font-bold text-amber-100 truncate">${def.name}</span>
            <span class="block text-[10px] text-slate-400 leading-snug">${def.desc.slice(0, 18)}…</span>
          </span>
          ${active ? '<span class="badge-nowrap text-[10px] font-bold text-amber-300">✓ 已选</span>' : ''}
        </button>`;
    })
    .join('');

  const noBlood = `
    <button data-prep-blood="none" class="rounded-none border ${prepBloodline === null ? 'border-slate-400 bg-slate-700/40 text-slate-100' : 'border-slate-700/50 bg-slate-900/80 text-slate-400 hover:border-slate-400/60'} px-3 py-2 text-sm font-bold cursor-pointer transition">
      无血脉祝福
    </button>`;
  bloodHost.innerHTML =
    noBlood +
    m.unlockedBloodlines
      .map((tag) => {
        const gt = GENE_TAGS[tag];
        const active = prepBloodline === tag;
        return `
          <button data-prep-blood="${tag}" class="rounded-none border px-3 py-2 text-sm font-bold cursor-pointer transition"
            style="background:${active ? gt.bg : 'rgba(15,23,42,0.8)'};color:${gt.color};border-color:${active ? gt.color : gt.color + '55'}">
            ${gt.name} 血脉 ${active ? '✓' : `+${BALANCE.bloodlineBonus}`}
          </button>`;
      })
      .join('');

  organHost.querySelectorAll<HTMLElement>('[data-prep-organ]').forEach((el) => {
    el.onclick = () => {
      prepOrgan = el.dataset.prepOrgan ?? 'claw';
      renderRunPrep(game, onConfirm);
    };
  });
  bloodHost.querySelectorAll<HTMLElement>('[data-prep-blood]').forEach((el) => {
    el.onclick = () => {
      const v = el.dataset.prepBlood ?? 'none';
      prepBloodline = v === 'none' ? null : (v as GeneId);
      renderRunPrep(game, onConfirm);
    };
  });

  byId('btnPrepStart').onclick = () => {
    closeRunPrep();
    onConfirm(prepOrgan, prepBloodline);
  };
  byId('btnPrepCancel').onclick = () => closeRunPrep();
}

// ---------------------------------------------------------------- 结算

/** 胜负统一结算弹窗 */
export function openSettlement(game: Game, victory: boolean, gained: number, unlockedTier: number | null): void {
  const world = game.world;
  const modal = byId('gameOverModal');
  byId('endTitle').textContent = victory ? '洪荒证道 · 通关！' : '洪荒陨落 · 身死道消';
  byId('endSubtitle').textContent = victory
    ? '你已踏破洪荒之巅，万兽俯首、山海低鸣'
    : '你的血肉重归山海大地，等待下一次轮回破壳';

  drawEndPreview(world.player.form);

  byId('endStats').innerHTML = `
    <div class="flex justify-between"><span>最终山海真身：</span><b class="text-amber-300">${world.player.form.name} (${world.player.stage}阶 · Lv.${world.player.level})</b></div>
    <div class="flex justify-between"><span>存活洪荒纪元：</span><b class="text-emerald-300">${fmtTime(world.time)}</b></div>
    <div class="flex justify-between"><span>吞噬荒兽总数：</span><b class="text-rose-300">${world.kills} 只</b></div>
    <div class="flex justify-between"><span>击败洪荒霸主：</span><b class="text-yellow-300">${world.bossesKilled} / ${BALANCE.victoryBosses}</b></div>
    <div class="flex justify-between"><span>难度层级：</span><b class="text-purple-300">${difficultyName(world.difficulty)}</b></div>
  `;

  const diffMult = BALANCE.difficultyEssenceMult[Math.min(world.difficulty, BALANCE.maxDifficulty) - 1];
  byId('endEssence').innerHTML = `
    <div class="flex justify-between"><span>本局获得精华：</span><b class="text-purple-200">💠 ${gained.toLocaleString()}（难度 ×${diffMult}）</b></div>
    <div class="flex justify-between"><span>累计精华：</span><b class="text-purple-200">💠 ${game.meta.essence.toLocaleString()}</b></div>
    ${unlockedTier ? `<div class="text-center text-amber-300 font-bold">🔓 解锁新难度：${difficultyName(unlockedTier)}</div>` : ''}
  `;

  byId('btnEndless').classList.toggle('hidden', !victory);
  modal.classList.remove('hidden');
}
