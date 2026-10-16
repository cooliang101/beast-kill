// 像素风绘制原语：所有坐标先四舍五入到整数像素，再画硬边矩形，
// 避免抗锯齿产生半透明灰边（那样就不像像素画了）。

/** 一个"艺术像素"在世界上占多少屏幕像素（贴合像素风观感） */
export const TEXEL = 3;

/** 把世界半径换算成贴图的艺术像素半径 */
export function texelRadius(worldRadius: number): number {
  return Math.max(2, Math.round(worldRadius / TEXEL));
}

export function pxRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

export function pxLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  thickness = 1,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pxRect(ctx, x0 + dx * t - thickness / 2, y0 + dy * t - thickness / 2, thickness, thickness, color);
  }
}

export function pxEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const rxi = Math.max(1, Math.round(rx));
  const ryi = Math.max(1, Math.round(ry));
  for (let y = -ryi; y <= ryi; y++) {
    const t = y / ryi;
    const w = Math.round(rxi * Math.sqrt(Math.max(0, 1 - t * t)));
    if (w <= 0) continue;
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

/** 棋盘抖动填充椭圆：像素风里表现柔光/闪白（半透明靠隔像素打点） */
export function pxDitherEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
  phase = 0,
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const rxi = Math.max(1, Math.round(rx));
  const ryi = Math.max(1, Math.round(ry));
  for (let y = -ryi; y <= ryi; y++) {
    const t = y / ryi;
    const w = Math.round(rxi * Math.sqrt(Math.max(0, 1 - t * t)));
    if (w <= 0) continue;
    for (let x = -w; x < w; x++) {
      if (((x + y + phase) & 1) !== 0) continue;
      ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

/** 相对亮度 0~1（用于判断体色是否过暗） */
export function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 体色提亮：深色体色 + 深色描边会让单位变成一团黑影，
 * 因此亮度偏低的形态统一提亮一档，保证像素轮廓可辨。
 */
export function bodyFill(hex: string): string {
  return luminance(hex) < 0.34 ? shade(hex, 0.3) : hex;
}

/** 明暗调整：amount < 0 变暗（用来生成像素描边色），> 0 变亮（受光面） */
export function shade(hex: string, amount: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amount >= 0) {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  } else {
    const k = 1 + amount;
    r *= k;
    g *= k;
    b *= k;
  }
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, '0')}`;
}

/** 像素圆环（每行左右各画 thickness 像素） */
export function pxRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  thickness = 1,
): void {
  ctx.fillStyle = color;
  const rxi = Math.max(1, Math.round(rx));
  const ryi = Math.max(1, Math.round(ry));
  const t = Math.max(1, Math.round(thickness));
  for (let y = -ryi; y <= ryi; y++) {
    const k = 1 - (y * y) / (ryi * ryi);
    if (k <= 0) continue;
    const w = Math.round(rxi * Math.sqrt(k));
    ctx.fillRect(Math.round(cx) - w, Math.round(cy) + y, t, 1);
    ctx.fillRect(Math.round(cx) + w - t, Math.round(cy) + y, t, 1);
  }
}

export function pxTri(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const pts = [[Math.round(x0), Math.round(y0)], [Math.round(x1), Math.round(y1)], [Math.round(x2), Math.round(y2)]] as const;
  const minY = Math.min(pts[0][1], pts[1][1], pts[2][1]);
  const maxY = Math.max(pts[0][1], pts[1][1], pts[2][1]);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < 3; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 3];
      if (a[1] === b[1]) continue;
      const t = (y - a[1]) / (b[1] - a[1]);
      if (t < 0 || t > 1) continue;
      xs.push(a[0] + (b[0] - a[0]) * t);
    }
    if (xs.length < 2) continue;
    const lo = Math.round(Math.min(...xs));
    const hi = Math.round(Math.max(...xs));
    ctx.fillRect(lo, y, Math.max(1, hi - lo + 1), 1);
  }
}

/** 硬边描边的像素矩形（边框由 1 像素矩形拼成） */
export function pxStrokeRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
): void {
  pxRect(ctx, x, y, w, 1, color);
  pxRect(ctx, x, y + h - 1, w, 1, color);
  pxRect(ctx, x, y, 1, h, color);
  pxRect(ctx, x + w - 1, y, 1, h, color);
}
