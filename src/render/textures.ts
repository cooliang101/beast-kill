// 启动时贴图烘焙管线：把矢量绘制一次性烘焙成 GPU 贴图，
// 运行时只渲染精灵（这是从"每帧上百次 path 调用"到"1 个 sprite"的关键一步）。
// 需要烘焙的着色差异用"白色底图 + 运行时 tint"解决。

import { Texture } from 'pixi.js';
import { WILD_TYPES, BOSS_TEXTURE_INDEX } from '../game/spawn';
import { drawWildMonsterBody } from './painter';

const WALK_FRAMES = 8;
const WILD_CANVAS = 64;

export interface WildTextures {
  frames: Texture[];
  white: Texture;
  radius: number;
}

export interface BakedTextures {
  wild: WildTextures[];
  bossRing: Texture;
  softDot: Texture;
  gridCell: Texture;
  mapRing: Texture;
  iceSword: Texture;
  shuriken: Texture;
  wispOuter: Texture;
  wispCore: Texture;
  slashArc: Texture;
  slashCore: Texture;
  spikeNormal: Texture;
  spikeEvolved: Texture;
  poisonWeb: Texture;
  iceSigil: Texture;
}

function makeCanvas(w: number, h = w): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 2D 上下文');
  return { canvas, ctx };
}

function bake(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h = w): Texture {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  return Texture.from(canvas);
}

function bakeWildSet(primary: string, secondary: string, accent: string, radius: number, lineScale: number): WildTextures {
  const frames: Texture[] = [];
  for (let f = 0; f < WALK_FRAMES; f++) {
    const phase = (f / WALK_FRAMES) * Math.PI * 2;
    frames.push(
      bake((ctx) => {
        drawWildMonsterBody(ctx, WILD_CANVAS / 2, WILD_CANVAS / 2, 0, phase, radius, primary, secondary, accent, false, lineScale);
      }, WILD_CANVAS),
    );
  }
  const white = bake((ctx) => {
    drawWildMonsterBody(ctx, WILD_CANVAS / 2, WILD_CANVAS / 2, 0, 0, radius, primary, secondary, accent, true, lineScale);
  }, WILD_CANVAS);
  return { frames, white, radius };
}

export function bakeTextures(): BakedTextures {
  // ---- 野生小怪 + Boss 配色 ----
  const wild = WILD_TYPES.map((t) => bakeWildSet(t.primary, t.secondary, t.accent, t.r, 1));
  // Boss：描边加粗（原 demo isBoss 线宽 2.5 / 1.5）
  wild[BOSS_TEXTURE_INDEX] = bakeWildSet('#881337', '#f43f5e', '#fde047', 44, 2.5 / 1.5);

  // ---- Boss 红色警示环 ----
  const bossRing = bake((ctx) => {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 55, 0, Math.PI * 2);
    ctx.stroke();
  }, 128);

  // ---- 粒子/通用实心圆点（运行时 tint + alpha） ----
  const softDot = bake((ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }, 16);

  // ---- 地形网格单元（180px，与原 demo gridSize 一致） ----
  const gridCell = bake((ctx) => {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, 180);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(180, 0.5);
    ctx.stroke();
  }, 180);

  // ---- 地图装饰辉光环（白色底图，运行时 tint；基准半径 28） ----
  const mapRing = bake((ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
  }, 64);

  // ---- 投射物：冰剑（固定配色）/ 风刃手里剑（白底 tint）/ 鬼火（白底 tint + 白芯） ----
  const R = 10;
  const iceSword = bake((ctx) => {
    ctx.translate(24, 24);
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R * 1.9, 0);
    ctx.lineTo(0, -R * 0.65);
    ctx.lineTo(-R * 1.4, 0);
    ctx.lineTo(0, R * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, 48);

  const shuriken = bake((ctx) => {
    ctx.translate(24, 24);
    ctx.fillStyle = '#ffffff';
    for (let b = 0; b < 4; b++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(R * 0.8, -R * 0.6, R * 1.6, 0);
      ctx.quadraticCurveTo(R * 0.6, R * 0.3, 0, 0);
      ctx.fill();
    }
  }, 48);

  const wispOuter = bake((ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(12, 12, 12, 0, Math.PI * 2);
    ctx.fill();
  }, 24);

  const wispCore = bake((ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }, 16);

  // ---- 爪击月牙（基准半径 100，白底 tint + 白色高光芯） ----
  const ARC_R = 100;
  const slashOffsets = [-0.28, 0, 0.28];
  const slashArc = bake((ctx) => {
    ctx.translate(120, 120);
    ctx.fillStyle = '#ffffff';
    slashOffsets.forEach((off, idx) => {
      const r = ARC_R * (0.72 + idx * 0.14);
      ctx.beginPath();
      ctx.arc(0, off * 28, r, -0.95, 0.95, false);
      ctx.arc(-10, off * 28, r * 0.86, 0.95, -0.95, true);
      ctx.closePath();
      ctx.fill();
    });
  }, 240);

  const slashCore = bake((ctx) => {
    ctx.translate(120, 120);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    slashOffsets.forEach((off, idx) => {
      const r = ARC_R * (0.72 + idx * 0.14);
      ctx.beginPath();
      ctx.arc(-4, off * 28, r * 0.93, -0.7, 0.7);
      ctx.stroke();
    });
  }, 240);

  // ---- 环绕骨剑（普通 / 超武觉醒） ----
  const spikeNormal = bake((ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#f5f5f4';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, 64);

  const spikeEvolved = bake((ctx) => {
    ctx.translate(32, 32);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, 64);

  // ---- 法阵：剧毒蛛网（白底 tint，基准半径 100） ----
  const poisonWeb = bake((ctx) => {
    ctx.translate(128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let w = 0; w < 8; w++) {
      const a = (w * Math.PI) / 4;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 100, Math.sin(a) * 100);
    }
    for (let ring = 0.35; ring <= 1; ring += 0.32) {
      ctx.moveTo(100 * ring, 0);
      for (let w = 1; w <= 8; w++) {
        const a = (w * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * 100 * ring, Math.sin(a) * 100 * ring);
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.133)';
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, Math.PI * 2);
    ctx.fill();
  }, 256);

  // ---- 法阵：六角雪花冰晶（固定配色，基准半径 100） ----
  const iceSigil = bake((ctx) => {
    ctx.translate(128, 128);
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const ex = Math.cos(a) * 100;
      const ey = Math.sin(a) * 100;
      ctx.moveTo(0, 0);
      ctx.lineTo(ex, ey);
      const mx = Math.cos(a) * 100 * 0.65;
      const my = Math.sin(a) * 100 * 0.65;
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a + 0.6) * 100 * 0.25, my + Math.sin(a + 0.6) * 100 * 0.25);
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(a - 0.6) * 100 * 0.25, my + Math.sin(a - 0.6) * 100 * 0.25);
    }
    ctx.stroke();
  }, 256);

  return {
    wild,
    bossRing,
    softDot,
    gridCell,
    mapRing,
    iceSword,
    shuriken,
    wispOuter,
    wispCore,
    slashArc,
    slashCore,
    spikeNormal,
    spikeEvolved,
    poisonWeb,
    iceSigil,
  };
}

/** 月牙贴图基准半径，运行时缩放 = s.radius / SLASH_ARC_BASE_R */
export const SLASH_ARC_BASE_R = 100;
/** 法阵贴图基准半径 */
export const ZONE_TEX_BASE_R = 100;
/** 投射物贴图基准半径 */
export const PROJECTILE_TEX_BASE_R = 10;
