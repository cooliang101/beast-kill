// 全部弹窗与试炼台交互（原 demo 第 13/14/15 节的 UI 逻辑移植）。
// 打开弹窗即暂停模拟（gameState = PAUSED），选择后恢复 PLAYING。

import { BALANCE } from '../config/balance';
import { GENE_TAGS } from '../config/genes';
import { ALL_FORMS } from '../config/forms';
import { ACTIVE_ORGANS } from '../config/organs';
import { PASSIVE_GENES } from '../config/passives';
import { sfx } from '../audio/sfx';
import { getOrganSvg } from './icons';
import { renderBuildPanel } from './buildPanel';
import { drawCodexPreviews, drawEndPreview, drawEvolutionPreviews } from './previews';
import { generateUpgradeChoices, matchTop3FormsForStage } from '../progression/choices';
import type { UpgradeChoice } from '../progression/choices';
import { handleLevelUp } from '../progression/leveling';
import { recalculateStatsAndGenes } from '../progression/genes';
import { spawnStressEnemies } from '../game/spawn';
import type { Game } from '../game/game';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 DOM 节点 #${id}`);
  return el;
}

/** 容错查找：节点缺失时返回 null 并留下明确日志（HTML 旧缓存混用时不应让整块功能失效） */
function byIdOpt(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) console.warn(`[UI] 缺少 DOM 节点 #${id}（若浏览器缓存了旧页面，请 Ctrl+Shift+R 强制刷新）`);
  return el;
}

/** 绑定点击：节点缺失只告警，不抛错 */
function on(id: string, handler: () => void): void {
  const el = byIdOpt(id);
  if (el) el.onclick = handler;
}

// ---------------------------------------------------------------- 升级三选一

export function openUpgradeModal(game: Game): void {
  game.setState('PAUSED');
  const world = game.world;
  const player = world.player;
  const modal = byId('upgradeModal');
  const container = byId('upgradeCardsContainer');
  container.innerHTML = '';

  const choices = generateUpgradeChoices(world);
  choices.forEach((item) => {
    const isSynergy = item.type === 'synergy';
    const def = item.def;
    const card = document.createElement('div');
    card.className = `evo-card rounded-none p-5 flex flex-col justify-between cursor-pointer ${isSynergy ? 'synergy-card' : ''}`;

    const tagBadges = (def.tags || [])
      .map((t) => {
        const gt = GENE_TAGS[t];
        return `<span class="badge-nowrap px-2.5 py-0.5 rounded-none text-xs font-bold" style="background:${gt.bg};color:${gt.color};border:1px solid ${gt.color}66">[${gt.name}] 基因</span>`;
      })
      .join('');

    const typeLabel = isSynergy
      ? '🔥 超武共鸣'
      : item.type === 'active'
        ? `主动器官 · Lv.${item.nextLv}`
        : item.type === 'passive'
          ? `突变基因 · Lv.${item.nextLv}`
          : '太古精血';

    card.innerHTML = `
      <div>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3.5">
          <span class="badge-nowrap text-xs font-bold px-2.5 py-1 rounded-none ${isSynergy ? 'bg-amber-400 text-slate-950' : item.type === 'active' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}">
            ${typeLabel}
          </span>
          <div class="flex items-center gap-1.5 flex-wrap">${tagBadges}</div>
        </div>
        <div class="flex items-center gap-3.5 mb-3">
          <div class="w-14 h-14 rounded-none bg-slate-950 border border-amber-500/40 p-2.5 shrink-0 shadow-inner">
            ${getOrganSvg(def.id, def.color)}
          </div>
          <div class="min-w-0">
            <h3 class="text-xl font-bold truncate ${isSynergy ? 'text-amber-300' : 'text-amber-100'}">${isSynergy ? (def as { synergyName: string }).synergyName : def.name}</h3>
            ${isSynergy ? `<div class="text-[11px] text-amber-300/90 mt-0.5">由【${def.name} Lv.5】共鸣觉醒</div>` : ''}
          </div>
        </div>
        <p class="text-xs md:text-sm text-slate-300 leading-relaxed">${isSynergy ? (def as { synergyDesc: string }).synergyDesc : def.desc}</p>
      </div>
      <div class="mt-4 pt-2.5 border-t border-amber-500/20 text-center text-xs font-bold text-amber-300">
        点击吞噬融合 ➔
      </div>
    `;

    card.onclick = () => {
      applyUpgradeChoice(game, item);
      recalculateStatsAndGenes(world);
      modal.classList.add('hidden');
      game.setState('PLAYING');
    };
    container.appendChild(card);
  });

  modal.classList.remove('hidden');
}

function applyUpgradeChoice(game: Game, item: UpgradeChoice): void {
  const player = game.world.player;
  if (item.type === 'synergy') {
    const owned = player.organs.find((o) => o.id === item.organId);
    if (owned) owned.evolved = true;
  } else if (item.type === 'active') {
    const owned = player.organs.find((o) => o.id === item.def.id);
    if (owned) owned.level++;
    else player.organs.push({ id: item.def.id, level: 1, evolved: false, timer: 0.1 });
  } else if (item.type === 'passive') {
    const owned = player.passives.find((p) => p.id === item.def.id);
    if (owned) owned.level++;
    else player.passives.push({ id: item.def.id, level: 1 });
  } else {
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.6);
    player.taotieStacks += 25;
  }
}

// ---------------------------------------------------------------- 阶段进化 9 选 3

export function openEvolutionModal(game: Game, targetStage: number): void {
  game.setState('PAUSED');
  const world = game.world;
  const modal = byId('evolutionModal');
  const container = byId('evoCardsContainer');
  container.innerHTML = '';

  const stageNames: Record<number, string> = {
    2: '二阶荒古凶兽 · 血脉觉醒',
    3: '三阶太古灵兽 · 化形蜕变',
    4: '四阶洪荒神兽 · 法相降临',
    5: '五阶神话创世 · 大道真身',
  };
  byId('evoStageTitle').textContent = stageNames[targetStage] ?? '';

  const matched3 = matchTop3FormsForStage(world, targetStage);
  const previewForms = matched3.map((m) => m.form);

  matched3.forEach((entry, idx) => {
    const f = entry.form;
    const card = document.createElement('div');
    card.className = 'evo-card rounded-none p-5 flex flex-col justify-between cursor-pointer border-2 border-amber-500/40';

    const tagBadges = f.tags
      .map((t) => {
        const gt = GENE_TAGS[t];
        return `<span class="badge-nowrap px-2 py-0.5 rounded-none text-xs font-bold" style="background:${gt.bg};color:${gt.color};border:1px solid ${gt.color}66">[${gt.name}]</span>`;
      })
      .join('');

    card.innerHTML = `
      <div>
        <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2.5">
          <span class="badge-nowrap text-xs font-bold px-2.5 py-0.5 rounded-none bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
            基因契合度 ${entry.matchPct}%
          </span>
          <div class="flex gap-1 flex-wrap">${tagBadges}</div>
        </div>
        <div class="w-full h-36 rounded-none bg-slate-950/90 border border-amber-500/30 mb-3 flex items-center justify-center relative overflow-hidden">
          <canvas id="evoPreviewCanvas_${idx}" style="width:132px;height:132px"></canvas>
        </div>
        <div class="text-xs text-amber-400/80 font-bold">${f.title}</div>
        <h3 class="text-2xl font-calligraphy text-amber-200 mb-2">${f.name}</h3>
        <div class="bg-slate-900/90 rounded-none p-2.5 border border-amber-500/20 mb-3 text-xs">
          <div class="text-amber-300 font-bold mb-0.5">✨ 本命神通：【${f.skillName}】</div>
          <div class="text-slate-300 leading-relaxed">${f.skillDesc}</div>
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-[11px] text-center">
          <div class="badge-nowrap bg-slate-900/70 py-1 rounded-none border border-rose-500/20 text-rose-300">气血 ${f.stats.hp}</div>
          <div class="badge-nowrap bg-slate-900/70 py-1 rounded-none border border-amber-500/20 text-amber-300">战力 ×${f.stats.dmgMult}</div>
          <div class="badge-nowrap bg-slate-900/70 py-1 rounded-none border border-cyan-500/20 text-cyan-300">护甲 ${f.stats.armor}</div>
        </div>
      </div>
      <button class="mt-4 w-full py-2.5 rounded-none btn-gold text-slate-950 font-black text-sm tracking-wider cursor-pointer">
        🔥 蜕变进化为【${f.name}】
      </button>
    `;

    card.onclick = () => {
      const player = world.player;
      player.stage = targetStage;
      player.form = f;
      recalculateStatsAndGenes(world);
      player.hp = player.maxHp;
      world.shake = 12;
      sfx.playEvolution();
      modal.classList.add('hidden');
      game.setState('PLAYING');
    };

    container.appendChild(card);
  });

  modal.classList.remove('hidden');
  drawEvolutionPreviews(previewForms);
}

// ---------------------------------------------------------------- 万兽图鉴 / 本局构筑

export type CodexTab = 'build' | 'forms' | 'synergies';

const CODEX_TAB_BTN: Record<CodexTab, string> = {
  build: 'tabBtnBuild',
  forms: 'tabBtnForms',
  synergies: 'tabBtnSynergies',
};
const CODEX_TAB_CONTENT: Record<CodexTab, string> = {
  build: 'codexContentBuild',
  forms: 'codexContentForms',
  synergies: 'codexContentSynergies',
};

let prevStateBeforeCodex: 'START' | 'PLAYING' | 'PAUSED' | 'OVER' = 'START';
/** 图鉴是从暂停菜单进入的：关闭后应回到暂停菜单而不是直接继续游戏 */
let codexReturnToPause = false;

export function openCodex(game: Game, tab: CodexTab = 'forms'): void {
  prevStateBeforeCodex = game.getState();
  codexReturnToPause = false;
  if (game.getState() === 'PLAYING') game.setState('PAUSED');
  renderCodex();
  renderBuildPanel(game.world);
  switchCodexTab(tab);
  byIdOpt('codexModal')?.classList.remove('hidden');
}

/** 暂停菜单 → 图鉴：关闭图鉴后回到暂停菜单 */
export function openCodexFromPause(game: Game, tab: CodexTab): void {
  closePauseMenu();
  openCodex(game, tab);
  codexReturnToPause = true;
}

export function closeCodex(game: Game): void {
  byIdOpt('codexModal')?.classList.add('hidden');
  if (codexReturnToPause) {
    codexReturnToPause = false;
    openPauseMenu(game);
  } else if (prevStateBeforeCodex === 'PLAYING') {
    game.setState('PLAYING');
  }
}

export function isCodexOpen(): boolean {
  const el = byIdOpt('codexModal');
  return !!el && !el.classList.contains('hidden');
}

export function switchCodexTab(tab: CodexTab): void {
  const activeCls = 'badge-nowrap px-4 py-1.5 rounded-none bg-amber-500 text-slate-950 font-bold text-xs md:text-sm cursor-pointer';
  const idleCls = 'badge-nowrap px-4 py-1.5 rounded-none bg-slate-800 text-amber-200 border border-amber-500/40 font-bold text-xs md:text-sm cursor-pointer';
  (Object.keys(CODEX_TAB_BTN) as CodexTab[]).forEach((t) => {
    const isActive = t === tab;
    const btn = byIdOpt(CODEX_TAB_BTN[t]);
    if (btn) btn.className = isActive ? activeCls : idleCls;
    byIdOpt(CODEX_TAB_CONTENT[t])?.classList.toggle('hidden', !isActive);
  });
}

// ---------------------------------------------------------------- 提示浮层

let hintTimer = 0;

/** 轻量操作提示（如"需先完成本次选择"），1.8 秒后自动消失 */
export function showHint(text: string): void {
  const el = byIdOpt('hintToast');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => el.classList.add('hidden'), 1800);
}

// ---------------------------------------------------------------- 暂停菜单

export function openPauseMenu(game: Game): void {
  game.setState('PAUSED');
  byIdOpt('pauseModal')?.classList.remove('hidden');
}

export function closePauseMenu(): void {
  byIdOpt('pauseModal')?.classList.add('hidden');
}

export function resumeFromPause(game: Game): void {
  closePauseMenu();
  game.setState('PLAYING');
}

export function isPauseMenuOpen(): boolean {
  return !!(byIdOpt('pauseModal') && !byIdOpt('pauseModal')!.classList.contains('hidden'));
}

export function wirePauseMenu(game: Game): void {
  on('btnPause', () => {
    if (game.getState() === 'PLAYING') openPauseMenu(game);
  });
  on('btnResume', () => resumeFromPause(game));
  on('btnPauseBuild', () => openCodexFromPause(game, 'build'));
  on('btnPauseCodex', () => openCodexFromPause(game, 'forms'));
  on('btnPauseRestart', () => game.startNewGame());
  on('btnPauseTitle', () => game.backToTitle());
}

function renderCodex(): void {
  const formsContainer = byIdOpt('codexContentForms');
  if (!formsContainer) return;
  formsContainer.innerHTML = '';

  const stageTitles: Record<number, string> = {
    1: '一阶 · 洪荒初始幼兽 (Lv.1)',
    2: '二阶 · 荒古凶兽 (Lv.5 · 根据基因亲和 9 选 3)',
    3: '三阶 · 太古灵兽 (Lv.10 · 根据基因亲和 9 选 3)',
    4: '四阶 · 洪荒神兽 (Lv.15 · 根据基因亲和 9 选 3)',
    5: '五阶 · 神话创世真身 (Lv.20 · 根据基因亲和 9 选 3)',
  };

  const allForms: typeof ALL_FORMS.stage1 = [];
  for (let s = 1; s <= 5; s++) {
    const list = ALL_FORMS[`stage${s}` as keyof typeof ALL_FORMS];
    allForms.push(...list);
    const section = document.createElement('div');
    section.innerHTML = `<h3 class="text-lg font-bold text-amber-300 border-l-4 border-amber-400 pl-3 mb-3">${stageTitles[s]}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

    list.forEach((f) => {
      const tagsHtml = f.tags
        .map((t) => `<span class="badge-nowrap px-1.5 py-0.5 rounded-none text-[10px] font-bold" style="background:${GENE_TAGS[t].bg};color:${GENE_TAGS[t].color}">[${GENE_TAGS[t].name}]</span>`)
        .join('');
      const card = document.createElement('div');
      card.className = 'bg-slate-900/90 border border-amber-500/25 rounded-none p-3 flex items-center gap-3';
      card.innerHTML = `
        <canvas id="codex_cvs_${f.id}" width="92" height="92" class="w-20 h-20 rounded-none bg-slate-950 border border-amber-500/20 shrink-0"></canvas>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="font-bold text-amber-200 text-base truncate">${f.name}</span>
            <div class="flex gap-1 shrink-0">${tagsHtml}</div>
          </div>
          <div class="text-[11px] text-amber-400/80 mb-1">${f.title}</div>
          <div class="text-[11px] text-slate-300 leading-snug"><b class="text-emerald-300">${f.skillName}：</b>${f.skillDesc}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    formsContainer.appendChild(section);
  }

  // 联动超武配方
  const synGrid = byIdOpt('synergyListGrid');
  if (!synGrid) {
    drawCodexPreviews(allForms);
    return;
  }
  synGrid.innerHTML = '';
  ACTIVE_ORGANS.forEach((act) => {
    const pas = PASSIVE_GENES.find((p) => p.id === act.pairPassive);
    const div = document.createElement('div');
    div.className = 'bg-slate-900/90 border border-amber-500/35 rounded-none p-4 flex flex-col justify-between';
    div.innerHTML = `
      <div>
        <div class="text-xs font-bold text-amber-400 mb-2">🔥 基因联动超武配方</div>
        <div class="flex items-center gap-2 mb-3 bg-slate-950/90 p-2.5 rounded-none border border-amber-500/20 flex-wrap">
          <span class="badge-nowrap text-xs font-bold text-amber-200">${act.name} (Lv.5)</span>
          <span class="text-amber-400 font-bold">+</span>
          <span class="badge-nowrap text-xs font-bold text-cyan-300">${pas ? pas.name : ''} (Lv.1+)</span>
        </div>
        <h4 class="text-lg font-bold text-amber-300 mb-1">➔ 【${act.synergyName}】</h4>
        <p class="text-xs text-slate-300 leading-relaxed">${act.synergyDesc}</p>
      </div>
    `;
    synGrid.appendChild(div);
  });

  drawCodexPreviews(allForms);
}

// ---------------------------------------------------------------- 结算

export function openGameOverModal(game: Game): void {
  const world = game.world;
  const modal = byId('gameOverModal');
  modal.classList.remove('hidden');

  drawEndPreview(world.player.form);

  const mins = String(Math.floor(world.time / 60)).padStart(2, '0');
  const secs = String(Math.floor(world.time % 60)).padStart(2, '0');
  byId('endStats').innerHTML = `
    <div class="flex justify-between"><span>最终山海真身：</span><b class="text-amber-300">${world.player.form.name} (${world.player.stage}阶 · Lv.${world.player.level})</b></div>
    <div class="flex justify-between"><span>存活洪荒纪元：</span><b class="text-emerald-300">${mins}分${secs}秒</b></div>
    <div class="flex justify-between"><span>吞噬荒兽总数：</span><b class="text-rose-300">${world.kills} 只</b></div>
  `;
}

// ---------------------------------------------------------------- 试炼台

export function wireSandbox(game: Game): void {
  on('btnSandboxToggle', () => {
    const p = byIdOpt('sandboxPanel');
    if (!p) return;
    if (p.classList.contains('hidden')) {
      p.classList.remove('hidden');
      p.classList.add('flex');
    } else {
      p.classList.add('hidden');
      p.classList.remove('flex');
    }
  });

  on('btnCheatLvUp', () => {
    if (game.getState() !== 'PLAYING') return;
    game.world.player.level++;
    handleLevelUp(game.world);
  });

  on('btnCheatNextStage', () => {
    if (game.getState() !== 'PLAYING') return;
    const player = game.world.player;
    const nextS = Math.min(5, player.stage + 1);
    player.level = Math.max(player.level, (nextS - 1) * 5);
    openEvolutionModal(game, nextS);
  });

  on('btnCheatUnlockSynergy', () => {
    if (game.getState() !== 'PLAYING') return;
    game.world.player.organs.forEach((o) => {
      o.level = 5;
      o.evolved = true;
    });
    recalculateStatsAndGenes(game.world);
  });

  on('btnCheatAllSynergy', () => {
    if (game.getState() !== 'PLAYING') return;
    const player = game.world.player;
    const pick6 = ['claw', 'horn', 'firesac', 'frost_b', 'eye', 'tentacle'];
    player.organs = pick6.map((id) => ({ id, level: 5, evolved: true, timer: 0.1 }));
    player.passives = ['fang', 'nerve', 'core', 'crystal', 'spirit', 'stomach'].map((id) => ({ id, level: 5 }));
    recalculateStatsAndGenes(game.world);
  });

  on('btnCheatStress', () => {
    if (game.getState() !== 'PLAYING') return;
    spawnStressEnemies(game.world, BALANCE.stressSpawnCount);
  });
}
