// 美术审查截图：把各形态放大截出来，便于逐帧评估像素风效果。
// 用法：node tools/shots.mjs   （输出到 tools/screenshots/art-*.png）
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('缺少 playwright（仅测试用，非项目依赖）：请先 npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const PORT = 5191;
const BASE = process.env.SMOKE_URL || `http://127.0.0.1:${PORT}`;
const EXTERNAL = !!process.env.SMOKE_URL;
const DEBUG_URL = `${BASE}${BASE.includes('?') ? '&' : '?'}debug=1`;
const OUT = 'tools/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = EXTERNAL ? null : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' });
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return true; } catch { /* retry */ }
    await sleep(500);
  }
  return false;
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') { try { spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' }); } catch { /* ignore */ } }
  else { try { process.kill(-pid); } catch { /* ignore */ } }
}

let browser;
try {
  if (!(await waitForServer())) throw new Error('dev server 未就绪');
  mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));

  await page.goto(DEBUG_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#game-root canvas');
  await sleep(1200);

  // 1) 封面：五阶异兽预览
  await page.screenshot({ path: `${OUT}/art-1-start.png` });
  const hero = await page.locator('#heroPreviewCanvas').boundingBox();
  if (hero) await page.screenshot({ path: `${OUT}/art-1b-hero.png`, clip: hero });

  // 2) 图鉴：37 种真身缩略图（像素兽全景）
  await page.click('#btnOpenCodexStart');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/art-2-codex.png` });
  const codexBody = await page.locator('#codexContentForms').boundingBox();
  if (codexBody) await page.screenshot({ path: `${OUT}/art-2b-codex-scroll.png`, clip: codexBody });
  await page.click('#tabBtnSynergies');
  await sleep(400);
  await page.screenshot({ path: `${OUT}/art-3-synergy.png` });
  await page.click('#btnCloseCodex');
  await sleep(400);

  // 3) 开局 + 跃迁到五阶真身，看进化卡大图
  await page.click('#btnStartGame');
  await sleep(700);
  if (!(await page.locator('#sandboxPanel').isVisible())) { await page.click('#btnSandboxToggle'); await sleep(250); }
  await page.click('#btnCheatNextStage');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/art-4-evolution.png` });
  const evo = await page.locator('#evoCardsContainer').boundingBox();
  if (evo) await page.screenshot({ path: `${OUT}/art-4b-evolution-cards.png`, clip: evo });
  await page.locator('#evoCardsContainer .evo-card').first().click();
  await sleep(500);

  // 4) 满配超武 + 压测：看攻击特效与大量单位
  await page.click('#btnCheatUnlockSynergy');
  await sleep(300);
  await page.click('#btnCheatAllSynergy');
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/art-5-combat-fx.png` });
  await page.click('#btnCheatStress');
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/art-6-horde.png` });

  // 5) 暂停菜单 + 本局构筑
  await page.keyboard.press('Escape');
  await sleep(500);
  await page.screenshot({ path: `${OUT}/art-7-pause.png` });
  await page.click('#btnPauseBuild');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/art-8-build.png` });

  console.log('截图完成 →', OUT);
} catch (err) {
  console.log('失败：', String((err && err.message) || err));
} finally {
  if (browser) await browser.close();
  if (server) killTree(server.pid);
}
