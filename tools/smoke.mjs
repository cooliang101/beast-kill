// 真实浏览器冒烟测试：无头 Chromium 跑一遍关键流程并截图。
// 覆盖：初始化 → 开始游戏 → ESC 暂停/恢复 → HUD 本局图鉴 → 暂停菜单↔图鉴流转 → 压测帧率。
// 用法：node tools/smoke.mjs   （截图输出到 tools/screenshots/）
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

// playwright 只是测试工具，不是项目依赖：缺了就给出一条可复制的安装命令
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    '缺少 playwright（它仅用于测试，不属于项目依赖）。请先安装：\n' +
    '  npm i -D playwright && npx playwright install chromium\n' +
    '（用完可 npm remove playwright，项目本身不需要它）',
  );
  process.exit(1);
}

const PORT = 5188;
/** 传入 SMOKE_URL 可复用已在运行的服务（例如验证用户正打开的那个实例 / 生产构建产物） */
const EXTERNAL_BASE = process.env.SMOKE_URL;
const BASE = EXTERNAL_BASE || `http://127.0.0.1:${PORT}`;
/** 生产构建默认不暴露 __game，加 ?debug=1 打开（与 src/main.ts 的开关对应） */
const DEBUG_URL = `${BASE}${BASE.includes('?') ? '&' : '?'}debug=1`;
const SHOT_DIR = 'tools/screenshots';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }); } catch { /* ignore */ }
  } else {
    try { process.kill(-pid); } catch { /* ignore */ }
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* 未就绪 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const server = EXTERNAL_BASE ? null : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' });
let serverLog = '';
if (server) {
  server.stdout.on('data', (d) => { serverLog += d.toString(); });
  server.stderr.on('data', (d) => { serverLog += d.toString(); });
}

let browser;
try {
  if (!EXTERNAL_BASE && !(await waitForServer(BASE))) throw new Error(`dev server 未就绪:\n${serverLog}`);
  if (EXTERNAL_BASE) console.log(`复用已有服务: ${BASE}`);
  mkdirSync(SHOT_DIR, { recursive: true });

  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message}`));
  // 字体自托管回归守卫：任何外部字体 CDN 请求都应视为失败
  const externalFontRequests = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) externalFontRequests.push(u);
  });

  const getState = () => page.evaluate(() => window.__game?.getState() ?? null);
  const visible = (sel) => page.locator(sel).isVisible();
  /** 若被升级/进化弹窗暂停，直接选第一张卡继续（避免测试被随机升级打断） */
  async function ensurePlaying() {
    if ((await getState()) === 'PAUSED' && !(await visible('#pauseModal'))) {
      const card = page.locator('#upgradeCardsContainer .evo-card, #evoCardsContainer .evo-card').first();
      if (await card.count()) {
        await card.click();
        await page.waitForTimeout(300);
      }
    }
  }

  /** 试炼台面板可能在前面的步骤里已展开，按可见性收敛到"已展开" */
  async function ensureSandboxOpen() {
    if (!(await visible('#sandboxPanel'))) {
      await page.click('#btnSandboxToggle');
      await page.waitForTimeout(250);
    }
  }

  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#game-root canvas', { timeout: 30000 });
  await page.waitForTimeout(500);

  check('初始化：Pixi 画布已挂载', (await page.locator('#game-root canvas').count()) > 0);
  check('封面：开始按钮可见', await visible('#btnStartGame'));

  // ---- 字体自托管 ----
  await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(
    () =>
      document.fonts.check('16px "Ma Shan Zheng"', '山海吞噬录') &&
      document.fonts.check('900 16px "Noto Serif SC"', '万兽基因谱'),
  );
  check('自托管字体已加载（书法体 + 宋体 900）', fontsOk);
  check('无外部字体 CDN 请求', externalFontRequests.length === 0, externalFontRequests.slice(0, 2).join(' '));
  await page.screenshot({ path: `${SHOT_DIR}/01-start.png` });

  // ---- 开始游戏 ----
  await page.click('#btnStartGame');
  await page.waitForTimeout(800);
  check('点击开始 → 状态 PLAYING', (await getState()) === 'PLAYING', `实际: ${await getState()}`);
  check('HUD 已显示', await visible('#hud'));
  await page.screenshot({ path: `${SHOT_DIR}/02-playing.png` });
  await ensurePlaying();

  // ---- HUD 暂停按钮（用户反馈"点不了"的路径，必须有覆盖） ----
  await page.click('#btnPause');
  await page.waitForTimeout(300);
  check('点击 HUD「⏸ 暂停」→ 暂停菜单弹出', (await visible('#pauseModal')) && (await getState()) === 'PAUSED');
  await page.click('#btnResume');
  await page.waitForTimeout(300);
  check('点击「▶ 继续吞噬」→ 恢复游戏', !(await visible('#pauseModal')) && (await getState()) === 'PLAYING');
  await ensurePlaying();

  // ---- ESC 暂停 / 恢复 ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('按 ESC → 暂停菜单弹出', (await visible('#pauseModal')) && (await getState()) === 'PAUSED', `state=${await getState()}`);
  await page.screenshot({ path: `${SHOT_DIR}/03-pause.png` });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('再按 ESC → 恢复游戏', !(await visible('#pauseModal')) && (await getState()) === 'PLAYING');

  // ---- HUD 本局图鉴 ----
  await page.waitForTimeout(2500); // 让世界跑出一些怪物与经验
  await ensurePlaying();
  await page.click('#btnOpenCodexHud');
  await page.waitForTimeout(600);
  check('HUD 点击「本局图鉴」→ 弹窗打开', await visible('#codexModal'));
  check('本局构筑页签默认展示', await visible('#codexContentBuild'));
  const organSection = await page.locator('#codexContentBuild h3', { hasText: '攻击器官' }).count();
  const organCards = await page.locator('#codexContentBuild >> text=配对被动机因').count();
  check('构筑面板渲染出器官卡片', organSection === 1 && organCards === 12, `器官卡片=${organCards}`);
  await page.screenshot({ path: `${SHOT_DIR}/04-build.png` });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('ESC 关闭图鉴并继续游戏', !(await visible('#codexModal')) && (await getState()) === 'PLAYING');

  // ---- 暂停菜单 ↔ 图鉴流转 ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await page.click('#btnPauseBuild');
  await page.waitForTimeout(500);
  check('暂停菜单 → 本局图鉴打开', (await visible('#codexModal')) && !(await visible('#pauseModal')));
  await page.screenshot({ path: `${SHOT_DIR}/05-codex-from-pause.png` });
  await page.click('#btnCloseCodex');
  await page.waitForTimeout(350);
  check('关闭图鉴 → 回到暂停菜单（而非直接继续）', (await visible('#pauseModal')) && (await getState()) === 'PAUSED');

  // ---- 重开本局 ----
  await page.click('#btnPauseRestart');
  await page.waitForTimeout(600);
  check('暂停菜单「重开本局」→ 恢复游戏且计数归零', (await getState()) === 'PLAYING' && (await page.evaluate(() => window.__game?.world.kills)) === 0);

  // ---- 强制选择弹窗：ESC 不跳过，但给出提示（确定性触发：试炼台立即升 1 级） ----
  await ensureSandboxOpen();
  await page.click('#btnCheatLvUp');
  await page.waitForTimeout(400);
  check('试炼台升级 → 升级弹窗出现且暂停', (await visible('#upgradeModal')) && (await getState()) === 'PAUSED');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('升级弹窗下 ESC 不跳过（符合设计）', await visible('#upgradeModal'), `state=${await getState()}`);
  check('ESC 被拦截时给出提示浮层', await visible('#hintToast'), `文案: ${await page.locator('#hintToast').textContent()}`);
  await page.waitForTimeout(2400);
  check('提示浮层 1.8s 后自动消失', !(await visible('#hintToast')));

  await page.locator('#upgradeCardsContainer .evo-card').first().click();
  await page.waitForTimeout(300);
  check('完成选择后恢复 PLAYING', (await getState()) === 'PLAYING');

  // ---- 暂停 → 返回封面 ----
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('ESC 进入暂停菜单', await visible('#pauseModal'));
  await page.click('#btnPauseTitle');
  await page.waitForTimeout(400);
  check('返回封面 → 主菜单可见且状态 START', (await visible('#startModal')) && (await getState()) === 'START');

  // ---- 压测帧率（放最后，避免玩家阵亡/升级干扰后续断言） ----
  await page.click('#btnStartGame');
  await page.waitForTimeout(600);
  check('新局开始：提示浮层未残留', !(await visible('#hintToast')));
  await ensureSandboxOpen();
  await page.click('#btnCheatStress');
  await page.waitForTimeout(1200);
  const enemies = await page.evaluate(() => window.__game?.world.enemies.length ?? -1);
  check('压测：同屏怪物数量达标', enemies > 1000, `同屏 ${enemies} 只`);
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          const el = performance.now() - t0;
          if (el < 3000) requestAnimationFrame(tick);
          else resolve(Math.round(frames / (el / 1000)));
        };
        requestAnimationFrame(tick);
      }),
  );
  check('压测帧率可测（软件渲染仅供参考）', fps > 0, `${fps} fps @ ${enemies} 单位`);
  await page.screenshot({ path: `${SHOT_DIR}/06-stress.png` });

  check('运行期无控制台报错', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' ｜ '));
  await page.close();

  // ---- 窄窗口布局：HUD 按钮必须仍在视口内可点击（"点不了"的常见真实原因） ----
  const narrow = await browser.newPage({ viewport: { width: 900, height: 620 } });
  await narrow.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' });
  await narrow.waitForSelector('#game-root canvas');
  await narrow.click('#btnStartGame');
  await narrow.waitForTimeout(800);
  const box = await narrow.locator('#btnPause').boundingBox();
  const inViewport = !!box && box.x >= 0 && box.x + box.width <= 900 && box.y >= 0;
  check('900px 窄窗口：HUD 暂停按钮在视口内', inViewport, box ? `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)}` : '不可见');
  let narrowClickOk = false;
  try {
    await narrow.click('#btnPause', { timeout: 5000 });
    await narrow.waitForTimeout(300);
    narrowClickOk = await narrow.locator('#pauseModal').isVisible();
  } catch { narrowClickOk = false; }
  check('900px 窄窗口：暂停按钮可点击', narrowClickOk);
  await narrow.screenshot({ path: `${SHOT_DIR}/07-narrow.png` });
  await narrow.close();
} catch (err) {
  check('冒烟测试执行', false, String((err && err.message) || err));
} finally {
  if (browser) await browser.close();
  if (server) killTree(server.pid);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
