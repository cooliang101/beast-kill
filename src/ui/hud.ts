// 顶部 HUD 与左下角器官槽（原 updateHudUI / updateHudNumbers 的移植）。
// 刷新策略：结构类（基因徽章/槽位）由 onStatsChanged 事件驱动；
// 数值类每帧调用但带变更守卫，避免无谓的 DOM 写入。

import { ACTIVE_ORGANS } from '../config/organs';
import { PASSIVE_GENES } from '../config/passives';
import { GENE_TAGS } from '../config/genes';
import { getOrganSvg } from './icons';
import type { World } from '../game/types';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 DOM 节点 #${id}`);
  return el;
}

export class Hud {
  private readonly hud = byId('hud');
  private readonly stageBadge = byId('hudStageBadge');
  private readonly formName = byId('hudFormName');
  private readonly levelText = byId('hudLevel');
  private readonly geneBar = byId('geneAffinityBar');
  private readonly activeSlots = byId('activeSlots');
  private readonly passiveSlots = byId('passiveSlots');
  private readonly hpBar = byId('hpBar');
  private readonly hpText = byId('hpText');
  private readonly expBar = byId('expBar');
  private readonly expText = byId('expText');
  private readonly timerText = byId('hudTimer');
  private readonly killsText = byId('hudKills');
  private readonly bossWarning = byId('bossWarning');
  private readonly bossNameText = byId('bossNameText');

  private lastHpPct = -1;
  private lastHpText = '';
  private lastExpPct = -1;
  private lastExpText = '';
  private lastTimer = '';
  private lastKills = -1;

  constructor(private readonly world: World) {}

  show(): void {
    this.hud.classList.remove('hidden');
  }

  hide(): void {
    this.hud.classList.add('hidden');
  }

  /** 结构刷新：形态/等级徽章、基因亲和徽章、器官与被动槽位 */
  refreshStats(): void {
    const player = this.world.player;
    const stageLabels: Record<number, string> = { 1: '一阶幼兽', 2: '二阶凶兽', 3: '三阶灵兽', 4: '四阶神兽', 5: '五阶创世' };
    this.stageBadge.textContent = stageLabels[player.stage];
    this.formName.textContent = player.form.name;
    this.levelText.textContent = `Lv.${player.level}`;

    this.geneBar.innerHTML = `<span class="text-[11px] text-amber-300/80 mr-1 font-bold badge-nowrap">基因亲和:</span>`;
    Object.values(GENE_TAGS).forEach((gt) => {
      const val = player.geneCounts[gt.id] || 0;
      const badge = document.createElement('span');
      badge.className = 'badge-nowrap px-1.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-0.5';
      badge.style.background = val > 0 ? gt.bg : 'rgba(30,41,59,0.5)';
      badge.style.color = val > 0 ? gt.color : '#64748b';
      badge.style.border = `1px solid ${val > 0 ? gt.color + '66' : 'rgba(100,116,139,0.2)'}`;
      badge.innerHTML = `${gt.name}<b>${val}</b>`;
      this.geneBar.appendChild(badge);
    });

    this.activeSlots.innerHTML = '';
    player.organs.forEach((o) => {
      const def = ACTIVE_ORGANS.find((a) => a.id === o.id);
      if (!def) return;
      const div = document.createElement('div');
      div.className = `w-8 h-8 rounded bg-slate-950 p-1 relative border ${o.evolved ? 'border-amber-400 shadow-[0_0_8px_#fbbf24]' : 'border-amber-500/40'}`;
      div.title = `${o.evolved ? def.synergyName : def.name} (Lv.${o.level})`;
      div.innerHTML = `${getOrganSvg(def.id, def.color)}<span class="absolute -bottom-1 -right-1 text-[9px] bg-slate-900 px-1 rounded font-bold text-amber-300">${o.evolved ? '★' : o.level}</span>`;
      this.activeSlots.appendChild(div);
    });

    this.passiveSlots.innerHTML = '';
    player.passives.forEach((p) => {
      const def = PASSIVE_GENES.find((g) => g.id === p.id);
      if (!def) return;
      const div = document.createElement('div');
      div.className = 'w-8 h-8 rounded bg-slate-950 p-1 relative border border-cyan-500/40';
      div.title = `${def.name} (Lv.${p.level})`;
      div.innerHTML = `${getOrganSvg(def.id, def.color)}<span class="absolute -bottom-1 -right-1 text-[9px] bg-slate-900 px-1 rounded font-bold text-cyan-300">${p.level}</span>`;
      this.passiveSlots.appendChild(div);
    });
  }

  /** 数值刷新：气血/经验/计时/击杀（带变更守卫） */
  updateNumbers(): void {
    const player = this.world.player;

    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpRounded = Math.round(hpPct * 10) / 10;
    if (hpRounded !== this.lastHpPct) {
      this.lastHpPct = hpRounded;
      this.hpBar.style.width = `${hpPct}%`;
    }
    const hpText = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    if (hpText !== this.lastHpText) {
      this.lastHpText = hpText;
      this.hpText.textContent = hpText;
    }

    const expPct = Math.max(0, Math.min(100, (player.exp / player.expNext) * 100));
    const expRounded = Math.round(expPct * 10) / 10;
    if (expRounded !== this.lastExpPct) {
      this.lastExpPct = expRounded;
      this.expBar.style.width = `${expPct}%`;
    }
    const nextEvoLv = player.level < 5 ? 5 : player.level < 10 ? 10 : player.level < 15 ? 15 : player.level < 20 ? 20 : '已登顶';
    const expText = `吞噬基因：${player.exp} / ${player.expNext} (下一阶真身蜕变: Lv.${nextEvoLv})`;
    if (expText !== this.lastExpText) {
      this.lastExpText = expText;
      this.expText.textContent = expText;
    }

    const mins = String(Math.floor(this.world.time / 60)).padStart(2, '0');
    const secs = String(Math.floor(this.world.time % 60)).padStart(2, '0');
    const timer = `${mins}:${secs}`;
    if (timer !== this.lastTimer) {
      this.lastTimer = timer;
      this.timerText.textContent = timer;
    }

    if (this.world.kills !== this.lastKills) {
      this.lastKills = this.world.kills;
      this.killsText.textContent = String(this.world.kills);
    }
  }

  showBossBanner(name: string): void {
    this.bossNameText.textContent = name;
    this.bossWarning.classList.remove('hidden');
    setTimeout(() => this.bossWarning.classList.add('hidden'), 4000);
  }
}
