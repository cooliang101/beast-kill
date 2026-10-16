// 程序化像素异兽/小怪绘制引擎。
//
// 全部绘制在"艺术像素"坐标系里完成（见 pixel.ts），调用方传入的是**整数艺术像素半径**
// （由 texelRadius(worldRadius) 求得）。因为美术是程序化生成的，改图元即可让
// 角色 / 敌人 / 图鉴缩略图 / 进化卡预览 同时获得像素风。
//
// 用途：
//  1) 启动时把野生小怪烘焙为贴图帧（渲染热路径用）；
//  2) 玩家本命真身每帧绘制到小尺寸 Canvas 后上传纹理（保真骨骼动画）；
//  3) 封面 / 进化卡 / 图鉴 / 结算 / 本局构筑弹窗的预览绘制。

import { bodyFill, pxDitherEllipse, pxEllipse, pxLine, pxRect, pxRing, pxTri, shade } from './pixel';
import type { BeastForm } from '../config/types';
import type { Enemy } from '../game/types';

type Ctx = CanvasRenderingContext2D;

/** 描边色：本体压暗后作为 1 像素轮廓 */
function outlineOf(base: string): string {
  return shade(base, -0.58);
}

/** 带描边的填充椭圆（像素画的标准做法：先大一圈描边，再画本体） */
function outlinedEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string): void {
  pxEllipse(ctx, cx, cy, rx + 1, ry + 1, outlineOf(fill));
  pxEllipse(ctx, cx, cy, rx, ry, fill);
}

function outlinedRect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string): void {
  pxRect(ctx, x - 1, y - 1, w + 2, h + 2, outlineOf(fill));
  pxRect(ctx, x, y, w, h, fill);
}

/** 锥形尾巴/触须/飘带：沿曲线分段绘制，逐段变细 */
function taperedTail(
  ctx: Ctx,
  baseX: number,
  baseY: number,
  angle: number,
  length: number,
  thickness: number,
  wave: number,
  color: string,
  outline: boolean,
): void {
  const segs = Math.max(4, Math.round(length / 2));
  let prevX = baseX;
  let prevY = baseY;
  for (let s = 1; s <= segs; s++) {
    const t = s / segs;
    const w = Math.sin(t * Math.PI * 2) * wave;
    const x = baseX + Math.cos(angle) * length * t;
    const y = baseY + Math.sin(angle) * length * t + w;
    const th = Math.max(1, Math.round(thickness * (1 - t * 0.8)));
    if (outline) pxLine(ctx, prevX, prevY + 1, x, y + 1, outlineOf(color), th + 1);
    pxLine(ctx, prevX, prevY, x, y, color, th);
    prevX = x;
    prevY = y;
  }
}

// ============================================================================
// 主入口
// ============================================================================

export function drawMythicalBeast(
  ctx: Ctx,
  form: BeastForm,
  x: number,
  y: number,
  radius: number,
  angle: number,
  walkPhase: number,
  hurtFlash = 0,
): void {
  const rT = Math.max(3, Math.round(radius));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));

  drawBeastAura(ctx, form, rT, walkPhase);

  ctx.rotate(angle);
  // 呼吸/摇摆量化为整数像素：像素画里"动"必须是整像素跳变
  const bob = Math.round(Math.sin(walkPhase * 2) * rT * 0.06);
  ctx.translate(0, bob);

  drawBeastTails(ctx, form, rT, walkPhase);
  if (form.wings && form.wings !== 'none') drawBeastWings(ctx, form, rT, walkPhase);
  drawBeastBody(ctx, form, rT, walkPhase);
  drawBeastHead(ctx, form, rT, walkPhase);

  if (hurtFlash > 0) {
    pxDitherEllipse(ctx, 0, 0, rT * 0.95, rT * 0.8, '#ffffff', Math.min(0.75, hurtFlash * 2.4), 0);
  }

  ctx.restore();
}

// ============================================================================
// 光环（用像素环 + 抖动点替代原矢量径向渐变）
// ============================================================================

function drawBeastAura(ctx: Ctx, form: BeastForm, rT: number, phase: number): void {
  const stage = form.stage || 1;
  ctx.save();

  ctx.globalAlpha = 0.22;
  pxRing(ctx, 0, 0, Math.round(rT * 1.32), Math.round(rT * 1.32), form.secondary, 1);
  if (stage >= 2) {
    ctx.globalAlpha = 0.14;
    pxRing(ctx, 0, 0, Math.round(rT * 1.55), Math.round(rT * 1.55), form.primary, 1);
  }
  if (stage >= 3) {
    // 旋转的像素符文环：45° 步进画短划线
    ctx.globalAlpha = 0.3;
    const rr = rT * 1.72;
    const spin = Math.floor(phase * 0.4) * 0.3;
    for (let i = 0; i < 8; i++) {
      const a0 = spin + (i * Math.PI) / 4;
      const a1 = a0 + 0.32;
      pxLine(
        ctx,
        Math.round(Math.cos(a0) * rr), Math.round(Math.sin(a0) * rr),
        Math.round(Math.cos(a1) * rr), Math.round(Math.sin(a1) * rr),
        form.accent, 1,
      );
    }
  }
  // 环绕光点
  ctx.globalAlpha = 0.5;
  const dots = stage >= 5 ? 7 : stage >= 3 ? 5 : 3;
  for (let i = 0; i < dots; i++) {
    const a = phase * 0.7 + (i * Math.PI * 2) / dots;
    const rr = rT * (1.18 + (i % 2) * 0.18);
    pxRect(ctx, Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr), 1, 1, form.accent);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ============================================================================
// 部件
// ============================================================================

function drawBeastTails(ctx: Ctx, form: BeastForm, rT: number, phase: number): void {
  const count = form.tails || 0;
  if (count <= 0) return;
  const style = form.tailStyle;

  if (style === 'peacock' || style === 'ribbon_fire') {
    // 扇形尾羽：多条锥形飘带 + 亮色端点
    for (let i = 0; i < count; i++) {
      const spread = count === 1 ? 0 : (i / (count - 1) - 0.5) * 1.0;
      const wave = Math.sin(phase * 3.5 + i * 0.9) * rT * 0.16;
      const ang = Math.PI + spread;
      const len = rT * 1.5;
      taperedTail(ctx, -rT * 0.4, 0, ang, len, 3, wave, form.secondary, true);
      pxRect(
        ctx,
        Math.round(-rT * 0.4 + Math.cos(ang) * len),
        Math.round(Math.sin(ang) * len + wave),
        2, 2, form.accent,
      );
    }
    return;
  }

  const fluffy = style === 'fox' || style === 'fluffy';
  const thick = fluffy ? 4 : 2;
  for (let i = 0; i < count; i++) {
    const spread = count === 1 ? 0 : (i / (count - 1) - 0.5) * 1.15;
    const wave = Math.sin(phase * 3.5 + i * 0.9) * rT * (fluffy ? 0.22 : 0.3);
    const ang = Math.PI + spread + (fluffy ? 0.3 : 0);
    const len = rT * (fluffy ? 1.15 : 1.35);
    taperedTail(ctx, -rT * 0.5, 0, ang, len, thick, wave, form.secondary, true);
    if (fluffy) {
      // 蓬松尾尖
      const tipX = Math.round(-rT * 0.5 + Math.cos(ang) * len);
      pxRect(ctx, tipX, Math.round(Math.sin(ang) * len + wave), 2, 2, shade(form.secondary, 0.3));
    }
  }
}

function drawBeastWings(ctx: Ctx, form: BeastForm, rT: number, phase: number): void {
  const flap = Math.round(Math.sin(phase * 4.2) * rT * 0.22);
  const wings = form.wings;
  const fill = form.secondary;
  const ol = outlineOf(fill);

  if (wings === 'halo_rings') {
    // 神环：上方像素弧 + 环绕光珠
    ctx.globalAlpha = 0.85;
    for (const side of [-1, 1]) {
      pxLine(ctx, side * rT * 0.2, -rT * 1.05, side * rT * 0.75, -rT * 0.95, ol, 2);
      pxLine(ctx, side * rT * 0.2, -rT * 1.05, side * rT * 0.75, -rT * 0.95, form.accent, 1);
    }
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.38 + Math.sin(phase * 2) * 0.1;
      pxRect(ctx, Math.round(Math.cos(a + Math.PI) * rT * 1.3), Math.round(Math.sin(a + Math.PI) * rT * 1.3), 2, 2, fill);
    }
    ctx.globalAlpha = 1;
    return;
  }

  const pairs = wings === 'six_wings' ? 3 : 1;
  for (let p = 0; p < pairs; p++) {
    const scaleP = 1 - p * 0.22;
    const yOff = -rT * (0.15 + p * 0.28) + flap * 0.5;
    for (const side of [-1, 1]) {
      const baseY = side * rT * 0.28 + yOff;
      const span = rT * 1.15 * scaleP;
      const drop = rT * 0.95 * scaleP;

      if (wings === 'ribbon' || wings === 'ribbon_fire') {
        taperedTail(ctx, -rT * 0.05, side * rT * 0.25, side > 0 ? 2.1 : -2.1, rT * 1.5, 3, 0, fill, true);
        continue;
      }

      const notched = wings === 'bat_wings';
      // 三段羽片（三角台阶）
      for (let f = 0; f < 3; f++) {
        const t0 = f / 3;
        const t1 = (f + 1) / 3;
        const x0 = -rT * 0.05 - span * t0;
        const x1 = -rT * 0.05 - span * t1;
        const y0 = baseY + side * drop * t0;
        const y1 = baseY + side * drop * t1;
        const notch = notched ? side * rT * 0.18 : 0;
        pxTri(ctx, x0, y0, x1, y1 - notch, x0 - rT * 0.1, y0 + side * rT * 0.34, ol);
        pxTri(ctx, x0, y0, x1, y1 - notch, x0 - rT * 0.1, y0 + side * rT * 0.34, fill);
      }
      // 内层亮羽
      pxTri(ctx, -rT * 0.05, baseY, -rT * 0.05 - span * 0.6, baseY + side * drop * 0.6,
        -rT * 0.35, baseY + side * drop * 0.42, shade(fill, 0.35));
      if (wings === 'cosmic_wings' || wings === 'feathered_large') {
        pxRect(ctx, Math.round(-span * 0.85), Math.round(baseY + side * drop * 0.8), 1, 1, form.accent);
      }
    }
  }
}

function drawBeastBody(ctx: Ctx, form: BeastForm, rT: number, phase: number): void {
  const fill = bodyFill(form.primary);
  const acc = form.accent;

  switch (form.archetype) {
    case 'spider': {
      // 八条两段式腿
      const legLift = Math.round(Math.sin(phase * 6) * rT * 0.14);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const a = side * (0.5 + i * 0.36);
          const kx = Math.round(Math.cos(a) * rT * 0.7);
          const ky = Math.round(Math.sin(a) * rT * 0.7) + legLift * (i % 2 === 0 ? 1 : -1);
          const tx = Math.round(Math.cos(a - side * 0.25) * rT * 1.25);
          const ty = Math.round(Math.sin(a - side * 0.25) * rT * 1.25);
          pxLine(ctx, 0, side * Math.round(rT * 0.2), kx, ky, outlineOf(form.secondary), 2);
          pxLine(ctx, kx, ky, tx, ty, form.secondary, 1);
        }
      }
      outlinedEllipse(ctx, -rT * 0.38, 0, rT * 0.52, rT * 0.44, fill);
      pxEllipse(ctx, -rT * 0.38, rT * 0.1, rT * 0.3, rT * 0.2, shade(fill, 0.18));
      break;
    }

    case 'serpent': {
      const segments = 8;
      for (let i = segments; i >= 1; i--) {
        const t = i / segments;
        const sx = Math.round((0.35 - t * 1.45) * rT);
        const sy = Math.round(Math.sin(phase * 4.5 - i * 0.65) * rT * (0.12 + t * 0.28));
        const sr = Math.max(1, Math.round(rT * (0.48 - t * 0.28)));
        const c = i % 2 === 0 ? fill : form.secondary;
        pxEllipse(ctx, sx, sy, sr + 1, sr + 1, outlineOf(c));
        pxEllipse(ctx, sx, sy, sr, sr, c);
      }
      break;
    }

    case 'bird': {
      pxTri(ctx, rT * 0.7, 0, -rT * 0.75, -rT * 0.5, -rT * 0.75, rT * 0.5, outlineOf(fill));
      pxTri(ctx, rT * 0.7, 0, -rT * 0.68, -rT * 0.44, -rT * 0.68, rT * 0.44, fill);
      pxEllipse(ctx, -rT * 0.1, 0, rT * 0.45, rT * 0.3, shade(fill, 0.2));
      // 尾羽
      for (let i = -1; i <= 1; i++) {
        pxLine(ctx, -rT * 0.6, 0, -rT * 1.15, i * rT * 0.3, form.secondary, 2);
      }
      break;
    }

    case 'turtle': {
      for (const side of [-1, 1]) {
        for (const front of [-1, 1]) {
          outlinedRect(ctx, Math.round(front * rT * 0.4), Math.round(side * rT * 0.6), 2, 2, fill);
        }
      }
      outlinedEllipse(ctx, 0, 0, rT * 0.74, rT * 0.74, fill);
      // 龟甲纹：中心六边形 + 放射线
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        pxLine(ctx, 0, 0, Math.round(Math.cos(a) * rT * 0.62), Math.round(Math.sin(a) * rT * 0.62), acc, 1);
      }
      pxEllipse(ctx, 0, 0, rT * 0.24, rT * 0.24, shade(fill, 0.22));
      break;
    }

    case 'deity': {
      // 上宽下收的法相躯干（三段矩形堆叠出切角感）
      const w = rT * 1.0;
      outlinedRect(ctx, -w / 2, -rT * 0.72, w, rT * 1.44, fill);
      pxRect(ctx, -w / 2 - 1, -rT * 0.72, 2, rT * 0.3, shade(fill, -0.3));
      pxRect(ctx, w / 2 - 1, -rT * 0.72, 2, rT * 0.3, shade(fill, -0.3));
      pxRect(ctx, -w / 2 + 1, rT * 0.3, w - 2, rT * 0.34, shade(fill, -0.25));
      // 悬浮法珠
      for (const side of [-1, 1]) {
        const fx = Math.round(rT * 0.6);
        const fy = Math.round(side * rT * 0.92 + Math.sin(phase * 4 + side) * rT * 0.12);
        pxEllipse(ctx, fx, fy, rT * 0.2 + 1, rT * 0.2 + 1, outlineOf(acc));
        pxEllipse(ctx, fx, fy, rT * 0.2, rT * 0.2, acc);
      }
      break;
    }

    case 'drake': {
      for (const side of [-1, 1]) {
        for (const front of [-1, 1]) {
          const stride = Math.round(Math.sin(phase * 4 + side * front) * rT * 0.16);
          outlinedRect(ctx, Math.round(front * rT * 0.35 + stride), Math.round(side * rT * 0.62), 2, 2, fill);
        }
      }
      outlinedEllipse(ctx, 0, 0, rT * 0.78, rT * 0.66, fill);
      if (form.id === 'taotie_fiend') {
        pxEllipse(ctx, 0, 0, rT * 0.4, rT * 0.32, '#090206');
      } else {
        // 背脊尖刺
        for (let i = -2; i <= 2; i++) {
          pxTri(ctx, i * rT * 0.22 + rT * 0.1, 0,
            i * rT * 0.22 - rT * 0.1, -rT * 0.2,
            i * rT * 0.22 - rT * 0.1, rT * 0.2, acc);
        }
      }
      pxEllipse(ctx, rT * 0.1, rT * 0.22, rT * 0.45, rT * 0.26, shade(fill, 0.16));
      break;
    }

    default: {
      // 四足兽（狼/熊等）
      const legs: Array<[number, number, number]> = [
        [rT * 0.35, -rT * 0.5, 0],
        [rT * 0.35, rT * 0.5, Math.PI],
        [-rT * 0.42, -rT * 0.48, Math.PI],
        [-rT * 0.42, rT * 0.48, 0],
      ];
      for (const [lx, ly, p] of legs) {
        const stride = Math.round(Math.sin(phase * 5 + p) * rT * 0.2);
        outlinedRect(ctx, Math.round(lx + stride), Math.round(ly), 2, Math.max(2, Math.round(rT * 0.3)), shade(fill, -0.18));
      }
      outlinedEllipse(ctx, 0, 0, rT * 0.74, rT * 0.56, fill);
      pxEllipse(ctx, rT * 0.05, rT * 0.16, rT * 0.5, rT * 0.26, shade(fill, 0.2));
      pxLine(ctx, -rT * 0.45, -rT * 0.28, rT * 0.4, -rT * 0.28, acc, 1);
      break;
    }
  }

  // 统一的受光面亮边：给像素躯干一点体积感
  pxEllipse(ctx, -rT * 0.08, -rT * 0.36, rT * 0.4, Math.max(1, rT * 0.15), shade(fill, 0.32));
}

function drawBeastHead(ctx: Ctx, form: BeastForm, rT: number, phase: number): void {
  const fill = bodyFill(form.primary);
  const acc = form.accent;
  const ol = outlineOf(fill);
  const hx = Math.round(rT * 0.6);

  if (form.horns === 'multi_heads') {
    for (let h = -1; h <= 1; h++) {
      const hy = Math.round(h * rT * 0.42 + Math.sin(phase * 3 + h) * rT * 0.1);
      outlinedEllipse(ctx, hx + 2, hy, rT * 0.3, rT * 0.22, fill);
      pxRect(ctx, hx + 3, hy - 1, 1, 1, form.eyeColor);
      pxRect(ctx, hx + 3, hy + 1, 1, 1, form.eyeColor);
    }
    return;
  }

  // 头骨 + 吻部
  outlinedEllipse(ctx, hx, 0, rT * 0.42, rT * 0.34, fill);
  pxTri(ctx, hx + rT * 0.3, 0, hx + rT * 0.62, -rT * 0.18, hx + rT * 0.62, rT * 0.18, shade(fill, -0.12));

  drawHorns(ctx, form, rT, hx, ol, acc);

  // 眼睛：像素点（大个体 2×2，小个体 1×1）
  const eye = rT >= 10 ? 2 : 1;
  const eyeColor = form.eyeColor || '#fef08a';
  const ex = hx + rT * 0.16;
  for (const side of [-1, 1]) {
    pxRect(ctx, Math.round(ex), Math.round(side * rT * 0.16) - (eye > 1 ? 1 : 0), eye, eye, outlineOf(eyeColor));
    pxRect(ctx, Math.round(ex), Math.round(side * rT * 0.16), eye, eye, eyeColor);
  }
}

function drawHorns(ctx: Ctx, form: BeastForm, rT: number, hx: number, ol: string, acc: string): void {
  const hornLen = rT * 0.55;
  const style = form.horns;

  switch (style) {
    case 'antler_dragon':
    case 'crown_god': {
      for (const side of [-1, 1]) {
        pxLine(ctx, hx - rT * 0.1, side * rT * 0.2, hx - rT * 0.5, side * rT * 0.62, ol, 2);
        pxLine(ctx, hx - rT * 0.1, side * rT * 0.2, hx - rT * 0.5, side * rT * 0.62, acc, 1);
        pxLine(ctx, hx - rT * 0.28, side * rT * 0.42, hx - rT * 0.42, side * rT * 0.85, acc, 1);
      }
      break;
    }
    case 'bull_giant':
    case 'ram_giant':
    case 'demon_curved': {
      for (const side of [-1, 1]) {
        pxLine(ctx, hx, side * rT * 0.22, hx + rT * 0.32, side * rT * 0.62, ol, 3);
        pxLine(ctx, hx + rT * 0.32, side * rT * 0.62, hx - rT * 0.18, side * rT * 0.72, ol, 3);
        pxLine(ctx, hx, side * rT * 0.22, hx + rT * 0.32, side * rT * 0.62, acc, 1);
        pxLine(ctx, hx + rT * 0.32, side * rT * 0.62, hx - rT * 0.18, side * rT * 0.72, acc, 1);
      }
      break;
    }
    case 'fox_ears':
    case 'bear_ears':
    case 'bat_ears': {
      for (const side of [-1, 1]) {
        pxTri(ctx, hx - rT * 0.15, side * rT * 0.12, hx - rT * 0.5, side * rT * 0.62, hx + rT * 0.05, side * rT * 0.3, ol);
        pxTri(ctx, hx - rT * 0.14, side * rT * 0.16, hx - rT * 0.44, side * rT * 0.55, hx + rT * 0.02, side * rT * 0.3, acc);
      }
      break;
    }
    case 'lion_mane': {
      for (let i = -3; i <= 3; i++) {
        const a = i * 0.34;
        pxLine(ctx, hx - rT * 0.2, Math.sin(a) * rT * 0.4, hx - rT * 0.62, Math.sin(a) * rT * 0.72, acc, 1);
      }
      break;
    }
    case 'ice_crown':
    case 'crest_gold':
    case 'crest_fire':
    case 'fire_crown':
    case 'crown_spikes': {
      const teeth = 4;
      for (let i = 0; i < teeth; i++) {
        const t = (i / (teeth - 1) - 0.5) * rT * 0.8;
        const h = rT * (0.3 + (i % 2 === 0 ? 0.22 : 0));
        pxTri(ctx, hx + t - 2, -rT * 0.3, hx + t + 2, -rT * 0.3, hx + t, -rT * 0.3 - h, ol);
        pxTri(ctx, hx + t - 1, -rT * 0.3, hx + t + 1, -rT * 0.3, hx + t, -rT * 0.3 - h + 1, acc);
      }
      break;
    }
    case 'tiger_king': {
      // 额前"王"字纹
      const y0 = -rT * 0.42;
      pxLine(ctx, hx - rT * 0.16, y0, hx + rT * 0.16, y0, acc, 1);
      pxLine(ctx, hx - rT * 0.12, y0 + 3, hx + rT * 0.12, y0 + 3, acc, 1);
      pxLine(ctx, hx, y0, hx, y0 + 6, acc, 1);
      break;
    }
    case 'snake_entwine': {
      for (const side of [-1, 1]) {
        pxLine(ctx, hx, side * rT * 0.3, hx - rT * 0.45, side * rT * 0.42, acc, 1);
        pxLine(ctx, hx - rT * 0.45, side * rT * 0.42, hx - rT * 0.2, side * rT * 0.72, acc, 1);
      }
      break;
    }
    case 'mandibles':
    case 'feelers':
    case 'feeler': {
      for (const side of [-1, 1]) {
        pxLine(ctx, hx + rT * 0.3, side * rT * 0.16, hx + rT * 0.55 + hornLen * 0.6, side * rT * 0.3, ol, 2);
        pxLine(ctx, hx + rT * 0.3, side * rT * 0.16, hx + rT * 0.55 + hornLen * 0.6, side * rT * 0.3, acc, 1);
      }
      break;
    }
    default: {
      // stub / swept 等：短直角
      for (const side of [-1, 1]) {
        pxTri(ctx, hx - rT * 0.1, side * rT * 0.14, hx - rT * 0.42, side * rT * 0.5, hx - rT * 0.2, side * rT * 0.06, ol);
        pxTri(ctx, hx - rT * 0.1, side * rT * 0.18, hx - rT * 0.36, side * rT * 0.46, hx - rT * 0.18, side * rT * 0.12, acc);
      }
      break;
    }
  }
}

// ============================================================================
// 野生小怪（低分辨率，靠 1 像素细节辨识）
// ============================================================================

/** 仅绘制兽体（腿/身/眼），供贴图烘焙；hurt 白色变体由 white 控制 */
export function drawWildMonsterBody(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  walkPhase: number,
  radius: number,
  primary: string,
  secondary: string,
  accent: string,
  white = false,
  lineScale = 1,
): void {
  const rT = Math.max(3, Math.round(radius));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);

  const body = white ? '#ffffff' : bodyFill(primary);

  // 腿
  const swing = Math.round(Math.sin(walkPhase * 4) * rT * 0.2);
  for (const side of [-1, 1]) {
    pxLine(ctx, rT * 0.1, side * rT * 0.3, rT * 0.2 + swing * side, side * rT * 0.85, shade(body, -0.3), 1);
    pxLine(ctx, -rT * 0.3, side * rT * 0.3, -rT * 0.35 - swing * side, side * rT * 0.8, shade(body, -0.3), 1);
  }

  // 躯干
  outlinedEllipse(ctx, 0, 0, rT * 0.85, rT * 0.6, body);
  // 背脊
  if (!white) {
    for (let i = -1; i <= 1; i++) {
      pxRect(ctx, Math.round(i * rT * 0.45), Math.round(-rT * 0.55), 1, 1, secondary);
    }
  }
  // 头
  outlinedEllipse(ctx, rT * 0.6, 0, rT * 0.4, rT * 0.34, body);
  // 眼
  const eye = rT >= 6 ? 2 : 1;
  pxRect(ctx, Math.round(rT * 0.7), -Math.round(rT * 0.14), eye, eye, accent);
  pxRect(ctx, Math.round(rT * 0.7), Math.round(rT * 0.14), eye, eye, accent);

  ctx.restore();
}

/** 兼容旧签名的完整小怪绘制（含血条/警示环），保留给调试场景 */
export function drawWildMonster(ctx: Ctx, e: Enemy): void {
  const r = e.radius;
  const rT = Math.max(3, Math.round(r / 3));
  drawWildMonsterBody(
    ctx, e.x, e.y, e.angle, e.walkPhase,
    rT * (e.isBoss ? 2.6 : 1),
    e.hurtTimer > 0 ? '#ffffff' : e.primary,
    e.secondary, e.accent,
  );

  if (e.isBoss) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    pxRing(ctx, e.x, e.y, r * 1.25, r * 1.25, '#ef4444', 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  if (e.isBoss || e.hp < e.maxHp) {
    const bw = e.isBoss ? r * 2.2 : r * 1.5;
    const bh = e.isBoss ? 6 : 4;
    const y = e.y - r - 12;
    pxRect(ctx, e.x - bw / 2 - 1, y - 1, bw + 2, bh + 2, '#000000');
    pxRect(ctx, e.x - bw / 2, y, bw, bh, '#1a1a24');
    pxRect(ctx, e.x - bw / 2, y, bw * Math.max(0, e.hp / e.maxHp), bh, e.isBoss ? '#f43f5e' : '#fb923c');
  }
}
