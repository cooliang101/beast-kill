import './styles.css';
import './assets/fonts.css'; // 自托管字体子集（由 tools/fonts.mjs 生成）
import { Game } from './game/game';

const host = document.getElementById('game-root');
if (!host) throw new Error('缺少 #game-root 容器');

/** 初始化失败时给出可见报错，避免"界面点了没反应"却毫无线索 */
function showFatalError(err: unknown): void {
  console.error('游戏初始化失败', err);
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:9999;max-width:90vw;' +
    'padding:14px 18px;border-radius:12px;background:rgba(60,10,16,.96);border:1px solid #f43f5e;' +
    'color:#fecdd3;font:14px/1.6 "Noto Serif SC",sans-serif;white-space:pre-wrap;';
  panel.textContent = `游戏初始化失败：${err instanceof Error ? err.message : String(err)}\n请把这段信息发给开发者，并按 Ctrl+Shift+R 强制刷新。`;
  document.body.appendChild(panel);
}

// 兜底：任何未捕获的运行期错误都显示出来
window.addEventListener('error', (e) => {
  if (!document.body.querySelector('[data-fatal]')) {
    const panel = document.createElement('div');
    panel.dataset.fatal = '1';
    panel.style.cssText =
      'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:9999;max-width:90vw;' +
      'padding:14px 18px;border-radius:12px;background:rgba(60,10,16,.96);border:1px solid #f43f5e;' +
      'color:#fecdd3;font:14px/1.6 "Noto Serif SC",sans-serif;white-space:pre-wrap;';
    panel.textContent = `运行期错误：${e.message}\n请把这段信息发给开发者，并按 Ctrl+Shift+R 强制刷新。`;
    document.body.appendChild(panel);
  }
});

const game = new Game();
game.init(host).catch(showFatalError);

// 调试句柄：开发环境默认暴露；生产构建加 ?debug=1 也可开启（供自动化冒烟测试与线上排查）
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { __game?: Game }).__game = game;
}
