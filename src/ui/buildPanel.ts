// 本局基因器官图鉴面板：渲染"当前真身 / 派生属性 / 九大基因亲和 / 12 器官（含超武觉醒状态）/ 12 被动"。
// 纯渲染层——所有数值来自 progression/summary.ts。

import { GENE_TAGS } from '../config/genes';
import { getOrganSvg } from './icons';
import { drawBuildFormPreview } from './previews';
import { summarizeBuild, SYNERGY_STATUS_TEXT } from '../progression/summary';
import type { BuildOrganEntry, BuildPassiveEntry, SynergyStatus } from '../progression/summary';
import type { World } from '../game/types';

function byIdOpt(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  if (!el) console.warn(`[UI] 缺少 DOM 节点 #${id}（若浏览器缓存了旧页面，请 Ctrl+Shift+R 强制刷新）`);
  return el;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function tagBadges(tags: string[]): string {
  return tags
    .map((t) => {
      const gt = GENE_TAGS[t as keyof typeof GENE_TAGS];
      if (!gt) return '';
      return `<span class="badge-nowrap px-1.5 py-0.5 rounded-none text-[10px] font-bold" style="background:${gt.bg};color:${gt.color};border:1px solid ${gt.color}66">[${gt.name}]</span>`;
    })
    .join('');
}

const STATUS_CLASS: Record<SynergyStatus, string> = {
  awakened: 'bg-amber-400 text-slate-950',
  ready: 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50',
  needsPassive: 'bg-slate-700/50 text-slate-300 border border-slate-500/40',
  leveling: 'bg-slate-700/50 text-slate-300 border border-slate-500/40',
  locked: 'bg-slate-800/60 text-slate-500 border border-slate-600/30',
};

function organCard(entry: BuildOrganEntry): string {
  const { def, owned, level, evolved, passiveDef, passiveOwned, passiveLevel, status } = entry;
  const displayName = evolved ? def.synergyName : def.name;
  const desc = evolved ? def.synergyDesc : def.desc;
  const dim = owned ? '' : 'opacity-50';
  const border = evolved ? 'border-amber-400' : owned ? 'border-amber-500/35' : 'border-slate-700/40';
  const nameCls = evolved ? 'text-amber-300' : 'text-amber-100';

  return `
    <div class="bg-slate-900/90 border ${border} rounded-none p-3 flex flex-col ${dim}">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-10 h-10 rounded-none bg-slate-950 border ${owned ? 'border-amber-500/40' : 'border-slate-700/50'} p-1.5 shrink-0">
          ${getOrganSvg(def.id, def.color)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="font-bold truncate ${nameCls}">${displayName}</span>
            ${owned
              ? `<span class="badge-nowrap text-[10px] px-1.5 py-0.5 rounded-none bg-slate-950 text-amber-300 border border-amber-500/30">Lv.${level}${evolved ? ' ★' : ''}</span>`
              : `<span class="badge-nowrap text-[10px] px-1.5 py-0.5 rounded-none bg-slate-950 text-slate-500 border border-slate-700/50">未获得</span>`}
          </div>
          <div class="text-[10px] text-slate-400 truncate">${evolved ? `超武觉醒 · 源自【${def.name}】` : '主动攻击器官'}</div>
        </div>
        <span class="badge-nowrap text-[10px] px-1.5 py-0.5 rounded-none font-bold ${STATUS_CLASS[status]}">${SYNERGY_STATUS_TEXT[status]}</span>
      </div>
      <div class="flex gap-1 flex-wrap mb-1.5">${tagBadges(def.tags)}</div>
      <p class="text-[11px] text-slate-300 leading-snug flex-1">${desc}</p>
      <div class="mt-2 pt-1.5 border-t border-amber-500/15 text-[10px] ${passiveOwned ? 'text-emerald-300' : 'text-slate-500'}">
        配对被动机因：${passiveDef ? passiveDef.name : '—'} ${passiveOwned ? `✓ Lv.${passiveLevel}` : '✗ 未获得'}
      </div>
    </div>
  `;
}

function passiveCard(entry: BuildPassiveEntry): string {
  const { def, owned, level } = entry;
  return `
    <div class="bg-slate-900/90 border ${owned ? 'border-cyan-500/35' : 'border-slate-700/40'} rounded-none p-3 flex flex-col ${owned ? '' : 'opacity-50'}">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-10 h-10 rounded-none bg-slate-950 border ${owned ? 'border-cyan-500/40' : 'border-slate-700/50'} p-1.5 shrink-0">
          ${getOrganSvg(def.id, def.color)}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="font-bold truncate text-cyan-100">${def.name}</span>
            ${owned
              ? `<span class="badge-nowrap text-[10px] px-1.5 py-0.5 rounded-none bg-slate-950 text-cyan-300 border border-cyan-500/30">Lv.${level}</span>`
              : `<span class="badge-nowrap text-[10px] px-1.5 py-0.5 rounded-none bg-slate-950 text-slate-500 border border-slate-700/50">未获得</span>`}
          </div>
          <div class="text-[10px] text-slate-400">突变基因</div>
        </div>
      </div>
      <div class="flex gap-1 flex-wrap mb-1.5">${tagBadges(def.tags)}</div>
      <p class="text-[11px] text-slate-300 leading-snug">${def.desc}</p>
    </div>
  `;
}

function statCell(label: string, value: string, tone = 'text-amber-200'): string {
  return `
    <div class="bg-slate-950/70 rounded-none px-2 py-1.5 border border-amber-500/15">
      <div class="text-[10px] text-slate-400">${label}</div>
      <div class="text-sm font-bold ${tone}">${value}</div>
    </div>
  `;
}

export function renderBuildPanel(world: World): void {
  const host = byIdOpt('codexContentBuild');
  if (!host) return;

  const player = world.player;
  const s = summarizeBuild(player);
  const d = s.derived;
  const form = player.form;

  const mins = String(Math.floor(world.time / 60)).padStart(2, '0');
  const secs = String(Math.floor(world.time % 60)).padStart(2, '0');

  const maxGene = Math.max(1, ...Object.values(player.geneCounts));
  const geneRows = Object.values(GENE_TAGS)
    .map((gt) => {
      const val = player.geneCounts[gt.id] || 0;
      const w = Math.round((val / maxGene) * 100);
      return `
        <div class="flex items-center gap-2">
          <span class="badge-nowrap text-[11px] font-bold w-10 shrink-0" style="color:${gt.color}">${gt.name}</span>
          <div class="flex-1 h-2.5 bg-slate-950 rounded-none overflow-hidden border border-slate-700/40">
            <div class="h-full rounded-none" style="width:${w}%;background:${gt.color}"></div>
          </div>
          <span class="badge-nowrap text-[11px] font-mono font-bold text-slate-300 w-7 text-right shrink-0">${val}</span>
        </div>
      `;
    })
    .join('');

  const html = `
    <div class="space-y-5">

      <!-- 当前真身 / 本局统计 / 派生属性 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div class="lg:col-span-4 bg-slate-900/90 border border-amber-500/30 rounded-none p-4 flex gap-4">
          <canvas id="buildFormPreview" width="120" height="120" class="w-28 h-28 rounded-none bg-slate-950 border border-amber-500/20 shrink-0"></canvas>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] text-amber-400/80">${form.title}</div>
            <div class="text-xl font-calligraphy text-amber-200 mb-1">${form.name}</div>
            <div class="flex gap-1 flex-wrap mb-1.5">${tagBadges(form.tags)}</div>
            <div class="text-[11px] text-slate-300 leading-snug">
              <b class="text-emerald-300">${form.skillName}</b>：${form.skillDesc}
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 bg-slate-900/90 border border-amber-500/30 rounded-none p-4">
          <div class="text-xs font-bold text-amber-400 mb-2">📊 本局统计</div>
          <div class="grid grid-cols-2 gap-1.5">
            ${statCell('阶级', `${player.stage} 阶`)}
            ${statCell('等级', `Lv.${player.level}`, 'text-emerald-300')}
            ${statCell('存活', `${mins}:${secs}`, 'text-amber-100')}
            ${statCell('吞噬', `${world.kills}`, 'text-rose-300')}
            ${statCell('已觉醒超武', `${s.awakenedCount} / 12`, 'text-yellow-300')}
            ${statCell('可觉醒', `${s.readyCount}`, 'text-emerald-300')}
          </div>
        </div>

        <div class="lg:col-span-5 bg-slate-900/90 border border-amber-500/30 rounded-none p-4">
          <div class="text-xs font-bold text-amber-400 mb-2">⚡ 派生属性（来自被动基因与器官）</div>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            ${statCell('气血上限', `${player.maxHp}`, 'text-rose-300')}
            ${statCell('攻击倍率', `×${player.dmgMult.toFixed(2)}`, 'text-amber-300')}
            ${statCell('护甲', `${player.armor}`, 'text-cyan-300')}
            ${statCell('移速', `${player.speed.toFixed(1)}`, 'text-emerald-300')}
            ${statCell('暴击率', pct(d.critChance), 'text-yellow-300')}
            ${statCell('冷却缩减', pct(d.cdrReduction), 'text-teal-300')}
            ${statCell('技能范围', `×${d.areaMult.toFixed(2)}`, 'text-orange-300')}
            ${statCell('每秒回血', d.regenPerSec > 0 ? `${d.regenPerSec}/s` : '—', 'text-rose-300')}
            ${statCell('生命汲取', d.lifestealChance > 0 ? `${pct(d.lifestealChance)} +${d.lifestealAmount}` : '—', 'text-rose-300')}
            ${statCell('吞噬引力', `${Math.round(d.pullRange)}`, 'text-purple-300')}
            ${statCell('经验加成', `+${pct(d.expBonusPct)}`, 'text-emerald-300')}
            ${statCell('弹射穿透', `+${d.pierceBonus}`, 'text-sky-300')}
            ${statCell('气血加成', `+${pct(d.hpBonusPct)}`, 'text-rose-300')}
            ${statCell('攻击加成', `+${pct(d.dmgBonusPct)}`, 'text-amber-300')}
            ${statCell('移速加成', `+${pct(d.speedBonusPct)}`, 'text-emerald-300')}
            ${statCell('体型加成', `+${pct(d.radiusBonusPct)}`, 'text-slate-300')}
          </div>
        </div>
      </div>

      <!-- 九大基因亲和度 -->
      <div class="bg-slate-900/90 border border-amber-500/25 rounded-none p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-bold text-amber-400">🧬 九大基因亲和度（决定下次进化 9 选 3 的匹配权重）</div>
          <div class="text-[11px] text-slate-400">总权重 ${s.geneTotal}</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-2">${geneRows}</div>
      </div>

      <!-- 攻击器官 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-amber-300 border-l-4 border-amber-400 pl-3">
            ⚔️ 攻击器官（${s.ownedOrganCount} / 6）
          </h3>
          <span class="text-[11px] text-slate-400">器官满级 Lv.5 + 配对被动 → 可觉醒超武共鸣</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${s.organs.map(organCard).join('')}
        </div>
      </div>

      <!-- 突变基因 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-bold text-cyan-300 border-l-4 border-cyan-400 pl-3">
            🧪 突变基因（${s.ownedPassiveCount} / 6）
          </h3>
          <span class="text-[11px] text-slate-400">每个器官都有唯一配对被动，二者齐备即可觉醒</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          ${s.passives.map(passiveCard).join('')}
        </div>
      </div>

    </div>
  `;

  host.innerHTML = html;
  drawBuildFormPreview(form);
}
