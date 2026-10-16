// 程序化异兽/小怪矢量绘制引擎（原 demo 绘制函数原样移植）。
// 用途：
//  1) 启动时把野生小怪烘焙为贴图帧（渲染热路径用）；
//  2) 玩家本命真身每帧绘制到 Canvas 后上传为纹理（保真骨骼动画）；
//  3) 封面 / 进化卡 / 图鉴 / 结算弹窗的预览绘制。
// 绘制约定：所有函数把 (x, y) 作为兽体中心，angle 为朝向弧度。

import type { BeastForm } from '../config/types';
import type { Enemy } from '../game/types';

export function drawMythicalBeast(
  ctx: CanvasRenderingContext2D,
  form: BeastForm,
  x: number,
  y: number,
  radius: number,
  angle: number,
  walkPhase: number,
  hurtFlash = 0,
): void {
  ctx.save();
  ctx.translate(x, y);

  drawBeastAura(ctx, form, radius, walkPhase);
  ctx.rotate(angle);

  const breathe = 1 + Math.sin(walkPhase * 2) * 0.045;
  const sway = Math.sin(walkPhase * 3) * 0.06;
  ctx.scale(breathe, 1 / breathe);
  ctx.rotate(sway);

  drawBeastTails(ctx, form, radius, walkPhase);

  if (form.wings && form.wings !== 'none') {
    drawBeastWings(ctx, form, radius, walkPhase);
  }

  switch (form.archetype) {
    case 'spider': drawSpiderBody(ctx, form, radius, walkPhase); break;
    case 'serpent': drawSerpentBody(ctx, form, radius, walkPhase); break;
    case 'bird': drawBirdBody(ctx, form, radius); break;
    case 'turtle': drawTurtleBody(ctx, form, radius); break;
    case 'deity': drawDeityBody(ctx, form, radius, walkPhase); break;
    case 'drake': drawDrakeBody(ctx, form, radius, walkPhase); break;
    default: drawQuadrupedBody(ctx, form, radius, walkPhase); break;
  }

  drawBeastHead(ctx, form, radius, walkPhase);

  if (hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, hurtFlash * 2)})`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBeastAura(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  ctx.save();
  const stage = form.stage || 1;
  ctx.rotate(phase * 0.4);

  const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * (1.35 + stage * 0.12));
  grad.addColorStop(0, form.secondary + '44');
  grad.addColorStop(0.6, form.primary + '22');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.35 + stage * 0.12), 0, Math.PI * 2);
  ctx.fill();

  if (stage >= 3) {
    ctx.strokeStyle = form.secondary + '66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();

    const points = stage >= 5 ? 8 : 6;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const a = (i * Math.PI * 2) / points;
      const x1 = Math.cos(a) * r * 1.25;
      const y1 = Math.sin(a) * r * 1.25;
      const a2 = ((i + 2) * Math.PI * 2) / points;
      const x2 = Math.cos(a2) * r * 1.25;
      const y2 = Math.sin(a2) * r * 1.25;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = form.accent + '44';
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeastTails(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  const count = form.tails || 0;
  if (count <= 0) return;

  for (let i = 0; i < count; i++) {
    const spread = count === 1 ? 0 : (i / (count - 1) - 0.5) * 1.15;
    const wave = Math.sin(phase * 3.5 + i * 0.9) * 0.35;
    ctx.save();
    ctx.translate(-r * 0.55, 0);
    ctx.rotate(spread + wave);

    ctx.fillStyle = form.secondary;
    ctx.strokeStyle = form.accent;
    ctx.lineWidth = 1.2;

    if (form.tailStyle === 'fox' || form.tailStyle === 'fluffy') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * 0.5, -r * 0.38, -r * 1.1, -r * 0.25, -r * 1.45, Math.sin(phase * 4 + i) * r * 0.15);
      ctx.bezierCurveTo(-r * 1.1, r * 0.25, -r * 0.5, r * 0.38, 0, 0);
      ctx.fill();
      ctx.stroke();
    } else if (form.tailStyle === 'peacock' || form.tailStyle === 'ribbon_fire') {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.8, -r * 0.15, -r * 1.6, 0);
      ctx.quadraticCurveTo(-r * 0.8, r * 0.15, 0, 0);
      ctx.fill();
      ctx.fillStyle = form.accent;
      ctx.beginPath();
      ctx.arc(-r * 1.35, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.18);
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.12, -r * 1.35, 0);
      ctx.quadraticCurveTo(-r * 0.7, r * 0.12, 0, r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBeastWings(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  const flap = Math.sin(phase * 4.2) * 0.28;

  if (form.wings === 'halo_rings') {
    ctx.save();
    ctx.strokeStyle = form.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-r * 0.2, 0, r * 1.25, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.38 + Math.sin(phase * 2) * 0.1;
      const wx = Math.cos(a + Math.PI) * r * 1.35;
      const wy = Math.sin(a + Math.PI) * r * 1.35;
      ctx.fillStyle = form.secondary;
      ctx.beginPath();
      ctx.arc(wx, wy, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const wingPairs = form.wings === 'six_wings' ? 3 : 1;
  for (let p = 0; p < wingPairs; p++) {
    const scaleP = 1 - p * 0.2;
    const offsetAngle = p * 0.32;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-r * 0.05, side * r * 0.25);
      ctx.scale(scaleP, side * scaleP);
      ctx.rotate(flap + offsetAngle);

      ctx.fillStyle = form.secondary;
      ctx.strokeStyle = form.accent;
      ctx.lineWidth = 1.5;

      if (form.wings === 'bat_wings') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.25, r * 1.35);
        ctx.quadraticCurveTo(-r * 0.1, r * 1.05, -r * 0.35, r * 1.45);
        ctx.quadraticCurveTo(-r * 0.5, r * 0.9, -r * 0.85, r * 1.15);
        ctx.quadraticCurveTo(-r * 0.6, r * 0.45, -r * 0.4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (form.wings === 'ribbon' || form.wings === 'ribbon_fire') {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.5, r * 0.9, -r * 0.8, r * 1.2, -r * 1.2, r * 1.7);
        ctx.bezierCurveTo(-r * 0.5, r * 1.3, r * 0.2, r * 0.8, -r * 0.2, 0);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(r * 0.15, 0);
        ctx.quadraticCurveTo(r * 0.45, r * 0.9, -r * 0.15, r * 1.65);
        ctx.lineTo(-r * 0.45, r * 1.4);
        ctx.lineTo(-r * 0.35, r * 1.15);
        ctx.lineTo(-r * 0.7, r * 1.1);
        ctx.lineTo(-r * 0.55, r * 0.8);
        ctx.lineTo(-r * 0.85, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.45, r * 0.2, -r * 0.3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawQuadrupedBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  const legPositions = [
    { x: r * 0.35, y: -r * 0.52, p: 0 },
    { x: r * 0.35, y: r * 0.52, p: Math.PI },
    { x: -r * 0.4, y: -r * 0.48, p: Math.PI },
    { x: -r * 0.4, y: r * 0.48, p: 0 },
  ];
  for (const leg of legPositions) {
    const stride = Math.sin(phase * 5 + leg.p) * r * 0.22;
    ctx.save();
    ctx.translate(leg.x + stride, leg.y);
    ctx.fillStyle = form.primary;
    ctx.strokeStyle = form.accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.24, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.secondary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.65, 0);
  ctx.bezierCurveTo(r * 0.55, -r * 0.65, -r * 0.55, -r * 0.55, -r * 0.72, 0);
  ctx.bezierCurveTo(-r * 0.55, r * 0.55, r * 0.55, r * 0.65, r * 0.65, 0);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.3, 0);
  ctx.lineTo(-r * 0.5, 0);
  ctx.stroke();
}

function drawDrakeBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      const stride = Math.sin(phase * 4 + side * front) * r * 0.18;
      ctx.fillStyle = form.primary;
      ctx.strokeStyle = form.accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(front * r * 0.35 + stride, side * r * 0.62, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.78, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (form.id === 'taotie_fiend') {
    ctx.fillStyle = '#090206';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = form.accent;
      ctx.beginPath();
      ctx.moveTo(i * r * 0.22 + r * 0.12, 0);
      ctx.lineTo(i * r * 0.22 - r * 0.08, -r * 0.16);
      ctx.lineTo(i * r * 0.22 - r * 0.08, r * 0.16);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawSpiderBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  ctx.strokeStyle = form.secondary;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const baseAngle = side * (0.45 + i * 0.38);
      const lift = Math.sin(phase * 6 + i * 1.4 + (side > 0 ? 0 : Math.PI)) * 0.2;
      const a = baseAngle + lift;
      const kx = Math.cos(a) * r * 0.75;
      const ky = Math.sin(a) * r * 0.75;
      const tx = Math.cos(a - side * 0.25) * r * 1.28;
      const ty = Math.sin(a - side * 0.25) * r * 1.28;
      ctx.beginPath();
      ctx.moveTo(0, side * r * 0.2);
      ctx.lineTo(kx, ky);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }
  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.secondary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, 0, r * 0.58, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawSerpentBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  const segments = 8;
  for (let i = segments; i >= 1; i--) {
    const t = i / segments;
    const sx = (0.35 - t * 1.45) * r;
    const sy = Math.sin(phase * 4.5 - i * 0.65) * r * (0.12 + t * 0.28);
    const sr = r * (0.48 - t * 0.28);

    ctx.fillStyle = i % 2 === 0 ? form.primary : form.secondary;
    ctx.strokeStyle = form.accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawBirdBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number): void {
  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, 0);
  ctx.quadraticCurveTo(0, -r * 0.52, -r * 0.68, -r * 0.2);
  ctx.lineTo(-r * 0.85, 0);
  ctx.lineTo(-r * 0.68, r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.52, r * 0.7, 0);
  ctx.fill();
  ctx.stroke();
}

function drawTurtleBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number): void {
  for (const side of [-1, 1]) {
    for (const front of [-1, 1]) {
      ctx.fillStyle = form.primary;
      ctx.beginPath();
      ctx.arc(front * r * 0.45, side * r * 0.68, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * r * 0.45;
    const py = Math.sin(a) * r * 0.45;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawDeityBody(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(r * 0.45, -r * 0.78);
  ctx.quadraticCurveTo(r * 0.7, 0, r * 0.45, r * 0.78);
  ctx.lineTo(-r * 0.45, r * 0.48);
  ctx.quadraticCurveTo(-r * 0.7, 0, -r * 0.45, -r * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const side of [-1, 1]) {
    const fx = r * 0.55 + Math.sin(phase * 4 + side) * r * 0.15;
    const fy = side * r * 0.92;
    ctx.fillStyle = form.accent;
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBeastHead(ctx: CanvasRenderingContext2D, form: BeastForm, r: number, phase: number): void {
  ctx.save();
  ctx.translate(r * 0.52, 0);

  if (form.horns === 'multi_heads') {
    for (let h = -1; h <= 1; h++) {
      ctx.save();
      ctx.rotate(h * 0.45 + Math.sin(phase * 3 + h) * 0.1);
      ctx.translate(r * 0.25, 0);
      ctx.fillStyle = form.primary;
      ctx.strokeStyle = form.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.32, r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = form.eyeColor;
      ctx.beginPath();
      ctx.arc(r * 0.1, -r * 0.1, r * 0.06, 0, Math.PI * 2);
      ctx.arc(r * 0.1, r * 0.1, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = form.primary;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.45, 0);
  ctx.quadraticCurveTo(r * 0.15, -r * 0.42, -r * 0.3, -r * 0.32);
  ctx.quadraticCurveTo(-r * 0.45, 0, -r * 0.3, r * 0.32);
  ctx.quadraticCurveTo(r * 0.15, r * 0.42, r * 0.45, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = form.accent;
  ctx.strokeStyle = form.accent;
  ctx.lineWidth = 2.2;
  if (form.horns === 'antler_dragon' || form.horns === 'crown_god') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, side * r * 0.22);
      ctx.quadraticCurveTo(-r * 0.35, side * r * 0.65, -r * 0.75, side * r * 0.52);
      ctx.moveTo(-r * 0.35, side * r * 0.45);
      ctx.lineTo(-r * 0.55, side * r * 0.78);
      ctx.stroke();
    }
  } else if (form.horns === 'bull_giant' || form.horns === 'demon_curved' || form.horns === 'ram_giant') {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, side * r * 0.25);
      ctx.quadraticCurveTo(r * 0.35, side * r * 0.85, -r * 0.3, side * r * 0.75);
      ctx.quadraticCurveTo(r * 0.05, side * r * 0.55, -r * 0.15, side * r * 0.22);
      ctx.fill();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.05, side * r * 0.2);
      ctx.lineTo(-r * 0.48, side * r * 0.55);
      ctx.lineTo(-r * 0.28, side * r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.fillStyle = form.eyeColor || '#fef08a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(r * 0.08, side * r * 0.16, r * 0.1, r * 0.055, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 野生小怪

/** 仅绘制兽体（腿/身/眼），供贴图烘焙；hurt 白色变体由 white 控制，lineScale 调整描边粗细（Boss 更粗） */
export function drawWildMonsterBody(
  ctx: CanvasRenderingContext2D,
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
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const r = radius;
  const p = walkPhase;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5 * lineScale;
  for (const side of [-1, 1]) {
    const legSwing = Math.sin(p * 4 + side) * r * 0.22;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, side * r * 0.4);
    ctx.lineTo(r * 0.35 + legSwing, side * r * 0.92);
    ctx.moveTo(-r * 0.25, side * r * 0.4);
    ctx.lineTo(-r * 0.35 - legSwing, side * r * 0.92);
    ctx.stroke();
  }

  ctx.fillStyle = white ? '#ffffff' : primary;
  ctx.strokeStyle = secondary;
  ctx.lineWidth = 1.4 * lineScale;

  ctx.beginPath();
  ctx.moveTo(r * 0.95, 0);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.82, -r * 0.82, -r * 0.52);
  ctx.lineTo(-r * 0.58, 0);
  ctx.lineTo(-r * 0.82, r * 0.52);
  ctx.quadraticCurveTo(r * 0.2, r * 0.82, r * 0.95, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.22, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.35, r * 0.22, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** 兼容旧签名的完整小怪绘制（含血条），供旧预览场景使用；主渲染已改为精灵化 */
export function drawWildMonster(ctx: CanvasRenderingContext2D, e: Enemy): void {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  const r = e.radius;
  const p = e.walkPhase;

  if (e.isBoss) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = e.accent;
  ctx.lineWidth = e.isBoss ? 2.5 : 1.5;
  for (const side of [-1, 1]) {
    const legSwing = Math.sin(p * 4 + side) * r * 0.22;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, side * r * 0.4);
    ctx.lineTo(r * 0.35 + legSwing, side * r * 0.92);
    ctx.moveTo(-r * 0.25, side * r * 0.4);
    ctx.lineTo(-r * 0.35 - legSwing, side * r * 0.92);
    ctx.stroke();
  }

  ctx.fillStyle = e.hurtTimer > 0 ? '#ffffff' : e.primary;
  ctx.strokeStyle = e.secondary;
  ctx.lineWidth = e.isBoss ? 2.5 : 1.4;

  ctx.beginPath();
  ctx.moveTo(r * 0.95, 0);
  ctx.quadraticCurveTo(r * 0.2, -r * 0.82, -r * 0.82, -r * 0.52);
  ctx.lineTo(-r * 0.58, 0);
  ctx.lineTo(-r * 0.82, r * 0.52);
  ctx.quadraticCurveTo(r * 0.2, r * 0.82, r * 0.95, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.22, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.35, r * 0.22, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (e.isBoss || e.hp < e.maxHp) {
    const bw = e.isBoss ? r * 2.2 : r * 1.5;
    const bh = e.isBoss ? 6 : 3.5;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(e.x - bw / 2, e.y - r - 12, bw, bh);
    ctx.fillStyle = e.isBoss ? '#f43f5e' : '#fb923c';
    ctx.fillRect(e.x - bw / 2, e.y - r - 12, bw * Math.max(0, e.hp / e.maxHp), bh);
  }
}
