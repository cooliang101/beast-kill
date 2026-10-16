// 游戏编排：持有世界、渲染场景、HUD、输入、主循环、局外存档，并完成事件与按钮接线。

import { BALANCE } from '../config/balance';
import { FixedLoop } from '../core/loop';
import { Input } from '../core/input';
import { createWorld, resetWorld } from './world';
import { updateWorld } from './update';
import { recalculateStatsAndGenes } from '../progression/genes';
import { loadMeta, metaBonuses, settleRun } from '../meta/save';
import type { MetaSave, RunStats } from '../meta/save';
import { GameScene } from '../render/scene';
import { Hud } from '../ui/hud';
import { startPreviewLoop } from '../ui/previews';
import {
  closeCodex,
  isCodexOpen,
  isPauseMenuOpen,
  openCodex,
  openEvolutionModal,
  openPauseMenu,
  openUpgradeModal,
  resumeFromPause,
  showHint,
  switchCodexTab,
  wirePauseMenu,
  wireSandbox,
} from '../ui/modals';
import { closeMetaModal, openMetaModal, openRunPrep, openSettlement, showEventBanner } from '../ui/meta';
import { sfx } from '../audio/sfx';
import type { GeneId } from '../config/types';
import type { GameState, World } from './types';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 DOM 节点 #${id}`);
  return el;
}

export class Game {
  readonly world: World = createWorld();
  /** 局外存档（精华/解锁/图鉴点亮），由 UI 层直接读写并持久化 */
  readonly meta: MetaSave = loadMeta();
  private readonly scene = new GameScene();
  private input!: Input;
  private hud!: Hud;
  private loop!: FixedLoop;
  private state: GameState = 'START';
  /** 每局只结算一次（胜利后继续无尽不再重复入账） */
  private runSettled = false;
  private lastSettlement: { victory: boolean; gained: number; unlockedTier: number | null } | null = null;

  async init(host: HTMLElement): Promise<void> {
    // 字体最多等 3 秒：字体服务异常时不应阻塞整局启动（退化用兜底字形烘焙）
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3000))]);
    await this.scene.init(host);

    this.input = new Input(this.scene.canvasElement);

    // ESC 最先注册：后面任何接线失败都不该让暂停失效
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      this.togglePause();
    });

    this.hud = new Hud(this.world);

    // 接线容错：单个 DOM 节点缺失只影响对应功能并留下明确日志，不中断启动
    const steps: Array<[string, () => void]> = [
      ['世界事件', () => this.wireWorldEvents()],
      ['基础按钮', () => this.wireButtons()],
      ['试炼台', () => wireSandbox(this)],
      ['暂停菜单', () => wirePauseMenu(this)],
    ];
    for (const [name, run] of steps) {
      try {
        run();
      } catch (err) {
        console.error(`[接线失败] ${name}：`, err);
      }
    }

    this.loop = new FixedLoop(
      (dt) => {
        if (this.state === 'PLAYING') {
          updateWorld(this.world, dt, this.input.moveVector());
        }
      },
      () => {
        this.scene.render(this.world, this.state, this.input);
        if (this.state !== 'START') this.hud.updateNumbers();
      },
    );
    this.loop.start();
    startPreviewLoop(() => this.state === 'START');
  }

  getState(): GameState {
    return this.state;
  }

  setState(state: GameState): void {
    this.state = state;
    this.input.enabled = state === 'PLAYING';
  }

  /** ESC 的统一切换逻辑（升级/进化等强制选择弹窗下不跳过，仅提示） */
  togglePause(): void {
    if (this.state === 'PLAYING') {
      openPauseMenu(this);
      return;
    }
    if (this.state !== 'PAUSED') return;
    if (isCodexOpen()) {
      closeCodex(this);
      return;
    }
    if (isPauseMenuOpen()) {
      resumeFromPause(this);
      return;
    }
    showHint('需先完成本次选择');
  }

  /** 开局。opts 省略时沿用上一局的起始器官/血脉（重开本局/再来一局） */
  startNewGame(opts?: { organId?: string; bloodline?: GeneId | null }): void {
    sfx.init();
    if (opts?.organId) this.world.startOrganId = opts.organId;
    if (opts && 'bloodline' in opts) this.world.bloodline = opts.bloodline ?? null;
    this.world.difficulty = Math.min(this.meta.difficulty, BALANCE.maxDifficulty);

    resetWorld(this.world);
    this.world.player.meta = metaBonuses(this.meta); // 局外属性节点生效
    recalculateStatsAndGenes(this.world);
    this.world.player.hp = this.world.player.maxHp;

    this.runSettled = false;
    this.lastSettlement = null;
    this.hud.refreshStats();

    this.hideAllModals();
    byId('startModal').classList.add('hidden');
    this.hud.show();
    this.setState('PLAYING');
  }

  /** 返回封面：重置本局并回到主菜单 */
  backToTitle(): void {
    resetWorld(this.world);
    this.hideAllModals();
    byId('startModal').classList.remove('hidden');
    this.hud.hide();
    this.setState('START');
  }

  /** 胜利后选择继续（无尽模式）：不再结算，敌人持续增强 */
  resumeEndless(): void {
    this.world.endless = true;
    byId('gameOverModal').classList.add('hidden');
    this.setState('PLAYING');
  }

  private hideAllModals(): void {
    for (const id of [
      'startModal', 'gameOverModal', 'upgradeModal', 'evolutionModal',
      'codexModal', 'pauseModal', 'metaModal', 'runPrepModal',
    ]) {
      byId(id).classList.add('hidden');
    }
  }

  /** 胜负统一出口：结算精华（每局仅一次）并展示结算弹窗 */
  private handleRunEnd(victory: boolean): void {
    let gained = 0;
    let unlockedTier: number | null = null;
    if (!this.runSettled) {
      this.runSettled = true;
      const stats: RunStats = {
        kills: this.world.kills,
        time: this.world.time,
        bossesKilled: this.world.bossesKilled,
        victory,
        difficulty: this.world.difficulty,
      };
      const result = settleRun(this.meta, stats);
      gained = result.gained;
      unlockedTier = result.unlockedTier;
    }
    this.lastSettlement = { victory, gained, unlockedTier };
    this.setState('OVER');
    openSettlement(this, victory, gained, unlockedTier);
  }

  /** 从祭坛返回时重新展示上一次结算 */
  private reopenSettlement(): void {
    const s = this.lastSettlement;
    if (s) openSettlement(this, s.victory, s.gained, s.unlockedTier);
  }

  private wireWorldEvents(): void {
    this.world.events = {
      onLevelUp: () => openUpgradeModal(this),
      onStageEvolution: (stage) => openEvolutionModal(this, stage),
      onStatsChanged: () => this.hud.refreshStats(),
      onBossSpawn: (name) => this.hud.showBossBanner(name),
      onGameOver: () => this.handleRunEnd(false),
      onVictory: () => this.handleRunEnd(true),
      onEvent: (label, color) => showEventBanner(label, color),
    };
  }

  private wireButtons(): void {
    // 逐个绑定并各自容错：单个节点缺失不影响其余按钮
    const bindings: Array<[string, () => void]> = [
      // 封面开局 → 先进入"择器降世"准备弹窗
      ['btnStartGame', () => openRunPrep(this, (organId, bloodline) => this.startNewGame({ organId, bloodline }))],
      // 重开本局 / 再来一局：沿用上一局的起始器官与血脉
      ['btnRestart', () => this.startNewGame()],
      // 封面进入 → 默认看 37 种真身图鉴；局内进入 → 默认看本局构筑
      ['btnOpenCodexStart', () => openCodex(this, 'forms')],
      ['btnOpenCodexHud', () => openCodex(this, 'build')],
      ['btnCloseCodex', () => closeCodex(this)],
      ['tabBtnBuild', () => switchCodexTab('build')],
      ['tabBtnForms', () => switchCodexTab('forms')],
      ['tabBtnSynergies', () => switchCodexTab('synergies')],
      // 吞噬祭坛（局外成长）
      ['btnOpenMeta', () => openMetaModal(this)],
      ['btnCloseMeta', () => closeMetaModal()],
      ['btnSettleMeta', () => openMetaModal(this, () => this.reopenSettlement())],
      ['btnEndless', () => this.resumeEndless()],
      ['btnSettleTitle', () => this.backToTitle()],
    ];
    for (const [id, handler] of bindings) {
      const el = document.getElementById(id);
      if (el) el.onclick = handler;
      else console.warn(`[UI] 缺少 DOM 节点 #${id}（若浏览器缓存了旧页面，请 Ctrl+Shift+R 强制刷新）`);
    }
  }
}
