// 封面动态预览与各弹窗内的形态预览绘制（DOM Canvas2D，不进 60fps 主循环）。
//
// 像素风做法：画布后备存储用"艺术像素分辨率"（很小），再由 CSS 放大 +
// `image-rendering: pixelated` 得到硬边像素；因此这里必须把画布尺寸改小、
// 并用 CSS 尺寸控制显示大小。

import { ALL_FORMS } from '../config/forms';
import { drawMythicalBeast } from '../render/painter';
import { texelRadius } from '../render/pixel';
import type { BeastForm } from '../config/types';

const previewForms: BeastForm[] = [
  ALL_FORMS.stage1[0],
  ALL_FORMS.stage2[0],
  ALL_FORMS.stage3[0],
  ALL_FORMS.stage4[1],
  ALL_FORMS.stage5[1],
];

/** 把画布调整为艺术像素分辨率，返回中心点（CSS 负责放大显示） */
function fitTexelCanvas(cvs: HTMLCanvasElement, worldRadius: number, pad = 6): number {
  const rT = texelRadius(worldRadius);
  const size = rT * 2 + pad;
  cvs.width = size;
  cvs.height = size;
  return size / 2;
}

/** 封面实时骨骼渲染循环（混沌幼崽 → 烛龙创世） */
export function startPreviewLoop(isStart: () => boolean): void {
  const tick = (): void => {
    if (isStart()) {
      const cvs = document.getElementById('heroPreviewCanvas') as HTMLCanvasElement | null;
      if (cvs) {
        // 后备存储用像素分辨率，由 CSS 放大到 display 尺寸（宽高比与容器接近）
        if (cvs.width !== 230 || cvs.height !== 70) {
          cvs.width = 230;
          cvs.height = 70;
        }
        const c = cvs.getContext('2d');
        if (c) {
          const t = performance.now() / 1000;
          // 注意：本画布已是像素分辨率，坐标直接用画布尺寸，不能再除 TEXEL
          const w = cvs.width;
          const h = cvs.height;
          c.clearRect(0, 0, cvs.width, cvs.height);
          previewForms.forEach((f, idx) => {
            const px = Math.round(w * 0.12 + idx * w * 0.19);
            const py = Math.round(h * 0.5);
            const r = texelRadius(18 + idx * 3.5);
            drawMythicalBeast(c, f, px, py, r, -Math.PI / 5 + Math.sin(t + idx) * 0.15, t * 2 + idx, 0);
          });
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 进化弹窗三张候选卡预览 */
export function drawEvolutionPreviews(forms: BeastForm[]): void {
  setTimeout(() => {
    forms.forEach((f, idx) => {
      const cvs = document.getElementById(`evoPreviewCanvas_${idx}`) as HTMLCanvasElement | null;
      if (!cvs) return;
      const c = cvs.getContext('2d');
      if (!c) return;
      const mid = fitTexelCanvas(cvs, 34, 10);
      c.clearRect(0, 0, cvs.width, cvs.height);
      drawMythicalBeast(c, f, mid, mid, texelRadius(34), -Math.PI / 6, idx * 1.5, 0);
    });
  }, 20);
}

/** 图鉴全部形态小图 */
export function drawCodexPreviews(forms: BeastForm[]): void {
  setTimeout(() => {
    for (const f of forms) {
      const cvs = document.getElementById(`codex_cvs_${f.id}`) as HTMLCanvasElement | null;
      if (!cvs) continue;
      const c = cvs.getContext('2d');
      if (!c) continue;
      const mid = fitTexelCanvas(cvs, 22, 8);
      c.clearRect(0, 0, cvs.width, cvs.height);
      drawMythicalBeast(c, f, mid, mid, texelRadius(22), -Math.PI / 5, 1.2, 0);
    }
  }, 30);
}

/** 结算弹窗最终形态头像 */
export function drawEndPreview(form: BeastForm): void {
  const cvs = document.getElementById('endFormPreview') as HTMLCanvasElement | null;
  if (!cvs) return;
  const c = cvs.getContext('2d');
  if (!c) return;
  const mid = fitTexelCanvas(cvs, 36, 10);
  c.clearRect(0, 0, cvs.width, cvs.height);
  drawMythicalBeast(c, form, mid, mid, texelRadius(36), -Math.PI / 6, 2.0, 0);
}

/** 本局构筑面板的当前真身头像 */
export function drawBuildFormPreview(form: BeastForm): void {
  setTimeout(() => {
    const cvs = document.getElementById('buildFormPreview') as HTMLCanvasElement | null;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    if (!c) return;
    const mid = fitTexelCanvas(cvs, 28, 10);
    c.clearRect(0, 0, cvs.width, cvs.height);
    drawMythicalBeast(c, form, mid, mid, texelRadius(28), -Math.PI / 6, 1.6, 0);
  }, 20);
}
