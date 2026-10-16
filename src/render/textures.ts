// 启动时贴图烘焙管线（像素风版）。
//
// 统一换算规则：每张贴图都声明自己的"艺术像素半径"(texelR)，
// 运行时 sprite.scale = 目标世界半径 / texelR。
// 艺术半径的取值都刻意贴近 世界半径/3，使全屏所有单位的像素颗粒大小一致（≈3 世界像素/像素）。
//
// 法阵类（蛛网/冰晶/岩刺/音波/黑洞/熔岩）不烘焙，仍用 Graphics 画：
// 它们的半径跨度极大（50~500），烘焙会破坏颗粒一致性，Graphics + 坐标量化更稳。

import { Texture } from 'pixi.js';
import { WILD_TYPES, BOSS_TEXTURE_INDEX } from '../game/spawn';
import { drawWildMonsterBody } from './painter';
import { pxDitherEllipse, pxEllipse, pxLine, pxRect, pxTri, texelRadius } from './pixel';

const WALK_FRAMES = 8;
const PAD = 3; // 四周留出的艺术像素边距

export interface WildTextures {
  frames: Texture[];
  white: Texture;
  /** 贴图的艺术像素半径；运行时 sprite.scale = 世界半径 / texelR */
  texelR: number;
}

export interface BakedTextures {
  wild: WildTextures[];
  bossRing: Texture;
  eliteRing: Texture;
  enemyOrb: Texture;
  particle: Texture;
  gem: Texture;
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
}

/** 烘焙一张"艺术像素分辨率"贴图并强制最近邻采样 */
function bake(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 2D 上下文');
  draw(ctx);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

function bakeWildSet(primary: string, secondary: string, accent: string, worldRadius: number): WildTextures {
  const rT = texelRadius(worldRadius);
  const size = rT * 2 + PAD * 2;
  const c = size / 2;
  const frames: Texture[] = [];
  for (let f = 0; f < WALK_FRAMES; f++) {
    const phase = (f / WALK_FRAMES) * Math.PI * 2;
    frames.push(bake(size, size, (ctx) => {
      drawWildMonsterBody(ctx, c, c, 0, phase, rT, primary, secondary, accent);
    }));
  }
  const white = bake(size, size, (ctx) => {
    drawWildMonsterBody(ctx, c, c, 0, 0, rT, primary, secondary, accent, true);
  });
  return { frames, white, texelR: rT };
}

export function bakeTextures(): BakedTextures {
  // ---- 野生小怪 + Boss 配色 ----
  // 小怪世界半径 15~21 → 艺术半径 5~7；Boss 世界半径 44 → 艺术半径 15。
  // 都取 texelRadius(世界半径)，运行时缩放约等于 TEXEL，颗粒一致。
  const wild = WILD_TYPES.map((t) => bakeWildSet(t.primary, t.secondary, t.accent, t.r));
  wild[BOSS_TEXTURE_INDEX] = bakeWildSet('#881337', '#f43f5e', '#fde047', 44);

  // ---- Boss 警示环（艺术半径 18，对应世界 55 ≈ 44×1.25） ----
  const BOSS_RING_TEXEL_R = 18;
  const bossRingSize = BOSS_RING_TEXEL_R * 2 + PAD * 2;
  const bc = bossRingSize / 2;
  const bossRing = bake(bossRingSize, bossRingSize, (ctx) => {
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const rr = BOSS_RING_TEXEL_R;
      pxLine(
        ctx,
        bc + Math.cos(a) * rr, bc + Math.sin(a) * rr,
        bc + Math.cos(a + 0.22) * rr, bc + Math.sin(a + 0.22) * rr,
        '#ef4444', 1,
      );
    }
  });

  // ---- 精英词缀环（白底 tint，艺术半径 18） ----
  const ELITE_RING_TEXEL_R = 18;
  const eliteRingSize = ELITE_RING_TEXEL_R * 2 + PAD * 2;
  const erc = eliteRingSize / 2;
  const eliteRing = bake(eliteRingSize, eliteRingSize, (ctx) => {
    for (let a = 0; a < Math.PI * 2; a += 0.34) {
      pxLine(
        ctx,
        erc + Math.cos(a) * ELITE_RING_TEXEL_R, erc + Math.sin(a) * ELITE_RING_TEXEL_R,
        erc + Math.cos(a + 0.2) * ELITE_RING_TEXEL_R, erc + Math.sin(a + 0.2) * ELITE_RING_TEXEL_R,
        '#ffffff', 1,
      );
    }
  });

  // ---- 敌方弹幕法球（白底 tint，艺术半径 4） ----
  const orbSize = 10;
  const oc = orbSize / 2;
  const enemyOrb = bake(orbSize, orbSize, (ctx) => {
    pxDitherEllipse(ctx, oc, oc, 4, 4, '#ffffff', 0.45);
    pxEllipse(ctx, oc, oc, 2, 2, '#ffffff');
  });

  // ---- 粒子火花（艺术半径 2，运行时恒定缩放） ----
  const particle = bake(8, 8, (ctx) => {
    pxRect(ctx, 3, 1, 2, 6, '#ffffff');
    pxRect(ctx, 1, 3, 6, 2, '#ffffff');
    pxRect(ctx, 3, 3, 2, 2, '#ffffff');
  });

  // ---- 经验球（艺术半径 3） ----
  const GEM_TEXEL_R = 3;
  const gemSize = GEM_TEXEL_R * 2 + 2;
  const gc = gemSize / 2;
  const gem = bake(gemSize, gemSize, (ctx) => {
    pxTri(ctx, gc, 1, gemSize - 1, gc, gc, gemSize - 1, '#ffffff');
    pxTri(ctx, gc, 1, 1, gc, gc, gemSize - 1, '#ffffff');
  });

  // ---- 地形网格（60 艺术像素 = 180 世界像素，配合 tileScale = TEXEL） ----
  const gridCell = bake(60, 60, (ctx) => {
    pxRect(ctx, 0, 0, 1, 60, 'rgba(212, 175, 55, 0.11)');
    pxRect(ctx, 0, 0, 60, 1, 'rgba(212, 175, 55, 0.11)');
    // 交点处的像素亮点，强化网格的像素感
    pxRect(ctx, 0, 0, 2, 2, 'rgba(212, 175, 55, 0.22)');
  });

  // ---- 地图装饰环（艺术半径 9，白色底图供 tint） ----
  const MAP_RING_TEXEL_R = 9;
  const ringSize = MAP_RING_TEXEL_R * 2 + 6;
  const rc = ringSize / 2;
  const mapRing = bake(ringSize, ringSize, (ctx) => {
    pxDitherEllipse(ctx, rc, rc, MAP_RING_TEXEL_R, MAP_RING_TEXEL_R, '#ffffff', 0.3);
    for (let a = 0; a < Math.PI * 2; a += 0.16) {
      pxRect(ctx, Math.round(rc + Math.cos(a) * MAP_RING_TEXEL_R), Math.round(rc + Math.sin(a) * MAP_RING_TEXEL_R), 1, 1, '#ffffff');
    }
  });

  // ---- 投射物：冰剑 / 四叶风刃（艺术外延 6）/ 鬼火（艺术半径 3） ----
  const extent = 6;
  const projSize = (extent + PAD) * 2;
  const pc = projSize / 2;

  const iceSword = bake(projSize, projSize, (ctx) => {
    pxTri(ctx, pc + extent, pc, pc - 3, pc - 3, pc - 3, pc + 3, '#38bdf8');
    pxTri(ctx, pc + extent - 1, pc, pc - 2, pc - 2, pc - 2, pc + 2, '#e0f2fe');
    pxRect(ctx, pc - 5, pc - 1, 3, 3, '#38bdf8');
  });

  const shuriken = bake(projSize, projSize, (ctx) => {
    // 四叶风刃（白色底图，运行时 tint）
    pxTri(ctx, pc, pc, pc + extent, pc - 3, pc + 2, pc + 2, '#ffffff');
    pxTri(ctx, pc, pc, pc + 3, pc + extent, pc - 2, pc + 2, '#ffffff');
    pxTri(ctx, pc, pc, pc - extent, pc + 3, pc - 2, pc - 2, '#ffffff');
    pxTri(ctx, pc, pc, pc - 3, pc - extent, pc + 2, pc - 2, '#ffffff');
  });

  const wispSize = 12;
  const wc = wispSize / 2;
  const wispOuter = bake(wispSize, wispSize, (ctx) => {
    pxEllipse(ctx, wc, wc, 3, 3, '#ffffff');
    pxEllipse(ctx, wc, wc, 2, 2, '#ffffff');
  });
  const wispCore = bake(wispSize, wispSize, (ctx) => {
    pxEllipse(ctx, wc, wc, 1, 1, '#ffffff');
  });

  // ---- 爪击月牙（艺术半径 40 → 常规 100 世界半径的挥砍约 2.5 倍缩放） ----
  const arcR = 40;
  const arcCanvas = (arcR + PAD) * 2;
  const ac = arcCanvas / 2;
  const crescent = (ctx: CanvasRenderingContext2D, radius: number, yOff: number, thick: number): void => {
    for (let a = -0.95; a <= 0.95; a += 0.05) {
      const xo = Math.round(ac + Math.cos(a) * radius);
      const yo = Math.round(ac + Math.sin(a) * radius + yOff);
      const xi = Math.round(ac + Math.cos(a) * (radius - thick * 3));
      const yi = Math.round(ac + Math.sin(a) * (radius - thick * 3) + yOff);
      pxLine(ctx, xi, yi, xo, yo, '#ffffff', thick);
    }
  };

  const slashArc = bake(arcCanvas, arcCanvas, (ctx) => {
    crescent(ctx, arcR, 0, 3);
    crescent(ctx, arcR - 8, 6, 2);
    crescent(ctx, arcR - 16, 12, 2);
  });

  const slashCore = bake(arcCanvas, arcCanvas, (ctx) => {
    crescent(ctx, arcR - 2, 0, 1);
  });

  // ---- 环绕骨剑（艺术外延 8，普通 / 超武觉醒） ----
  const spikeExtent = 8;
  const spikeSize = (spikeExtent + PAD) * 2;
  const sc = spikeSize / 2;
  const spikeNormal = bake(spikeSize, spikeSize, (ctx) => {
    pxTri(ctx, sc + spikeExtent, sc, sc - 4, sc - 4, sc - 4, sc + 4, '#38bdf8');
    pxTri(ctx, sc + spikeExtent - 1, sc, sc - 3, sc - 2, sc - 3, sc + 2, '#f5f5f4');
    pxRect(ctx, sc - 6, sc - 1, 4, 3, '#38bdf8');
  });
  const spikeEvolved = bake(spikeSize, spikeSize, (ctx) => {
    pxTri(ctx, sc + spikeExtent, sc, sc - 4, sc - 4, sc - 4, sc + 4, '#f43f5e');
    pxTri(ctx, sc + spikeExtent - 1, sc, sc - 3, sc - 2, sc - 3, sc + 2, '#fde047');
    pxRect(ctx, sc - 6, sc - 1, 4, 3, '#f43f5e');
  });

  return {
    wild,
    bossRing,
    eliteRing,
    enemyOrb,
    particle,
    gem,
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
  };
}

// ---------------------------------------------------------------- 尺度换算表
// 运行时 sprite.scale = 世界半径 / 下列"艺术半径"

/** Boss 警示环：艺术半径 18 ↔ 世界半径 55（44 × 1.25） */
export const BOSS_RING_TEXEL_R = 18;
export const BOSS_RING_WORLD_R = 55;
/** 精英词缀环：艺术半径 18（运行时 scale = 精英世界半径×1.15 / 该值） */
export const ELITE_RING_TEXEL_R = 18;
/** 敌方弹幕法球：艺术半径 4 */
export const ENEMY_ORB_TEXEL_R = 4;
/** 月牙：艺术半径 40 */
export const SLASH_ARC_TEXEL_R = 40;
/** 冰剑 / 风刃：贴图外延 6 艺术像素；原始比例分别为 1.9×p.r 与 1.6×p.r */
export const PROJ_TEXEL_EXTENT = 6;
export const ICE_SWORD_K = 1.9;
export const SHURIKEN_K = 1.6;
/** 鬼火：艺术半径 3 */
export const WISP_TEXEL_R = 3;
/** 环绕骨剑：艺术外延 8 ↔ 原世界尺寸 22 */
export const SPIKE_TEXEL_EXTENT = 8;
export const SPIKE_WORLD_EXTENT = 22;
/** 经验球：艺术半径 3 */
export const GEM_TEXEL_R = 3;
/** 地图装饰环：艺术半径 9 */
export const MAP_RING_TEXEL_R = 9;
/** 粒子火花：固定缩放（约 3 世界像素/像素） */
export const PARTICLE_SCALE = 3;
