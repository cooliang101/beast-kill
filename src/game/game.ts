// 游戏编排：持有世界、渲染场景、HUD、输入与主循环，并完成事件与按钮接线。

import { FixedLoop } from '../core/loop';
import { Input } from '../core/input';
import { createWorld, resetWorld } from './world';
import { updateWorld } from './update';
import { recalculateStatsAndGenes } from '../progression/genes';
import { GameScene } from '../render/scene';
import { Hud } from '../ui/hud';
import { startPreviewLoop } from '../ui/previews';
import {
  closeCodex,
  isCodexOpen,
  isPauseMenuOpen,
  openCodex,
  openEvolutionModal,
  openGameOverModal,
  openPauseMenu,
  openUpgradeModal,
  resumeFromPause,
  showHint,
  switchCodexTab,
  wirePauseMenu,
  wireSandbox,
} from '../ui/modals';
import { sfx } from '../audio/sfx';
import type { GameState, World } from './types';

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`缺少 DOM 节点 #${id}`);
  return el;
}

export class Game {
  readonly world: World = createWorld();
  private readonly scene = new GameScene();
  private input!: Input;
  private hud!: Hud;
  private loop!: FixedLoop;
  private state: GameState = 'START';

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

  startNewGame(): void {
    sfx.init();
    resetWorld(this.world);
    recalculateStatsAndGenes(this.world);
    this.world.player.hp = this.world.player.maxHp;
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

  private hideAllModals(): void {
    for (const id of ['startModal', 'gameOverModal', 'upgradeModal', 'evolutionModal', 'codexModal', 'pauseModal']) {
      byId(id).classList.add('hidden');
    }
  }

  private wireWorldEvents(): void {
    this.world.events = {
      onLevelUp: () => openUpgradeModal(this),
      onStageEvolution: (stage) => openEvolutionModal(this, stage),
      onStatsChanged: () => this.hud.refreshStats(),
      onBossSpawn: (name) => this.hud.showBossBanner(name),
      onGameOver: () => {
        this.setState('OVER');
        openGameOverModal(this);
      },
    };
  }

  private wireButtons(): void {
    // 逐个绑定并各自容错：单个节点缺失不影响其余按钮
    const bindings: Array<[string, () => void]> = [
      ['btnStartGame', () => this.startNewGame()],
      ['btnRestart', () => this.startNewGame()],
      // 封面进入 → 默认看 37 种真身图鉴；局内进入 → 默认看本局构筑
      ['btnOpenCodexStart', () => openCodex(this, 'forms')],
      ['btnOpenCodexHud', () => openCodex(this, 'build')],
      ['btnCloseCodex', () => closeCodex(this)],
      ['tabBtnBuild', () => switchCodexTab('build')],
      ['tabBtnForms', () => switchCodexTab('forms')],
      ['tabBtnSynergies', () => switchCodexTab('synergies')],
    ];
    for (const [id, handler] of bindings) {
      const el = document.getElementById(id);
      if (el) el.onclick = handler;
      else console.warn(`[UI] 缺少 DOM 节点 #${id}（若浏览器缓存了旧页面，请 Ctrl+Shift+R 强制刷新）`);
    }
  }
}
