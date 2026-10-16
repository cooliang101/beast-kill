// 封面动态预览与各弹窗内的形态预览绘制（DOM Canvas2D，不进 60fps 主循环）。

import { ALL_FORMS } from '../config/forms';
import { drawMythicalBeast } from '../render/painter';
import type { BeastForm } from '../config/types';

const previewForms: BeastForm[] = [
  ALL_FORMS.stage1[0],
  ALL_FORMS.stage2[0],
  ALL_FORMS.stage3[0],
  ALL_FORMS.stage4[1],
  ALL_FORMS.stage5[1],
];

/** 封面实时骨骼渲染循环（混沌幼崽 → 烛龙创世） */
export function startPreviewLoop(isStart: () => boolean): void {
  const tick = (): void => {
    if (isStart()) {
      const cvs = document.getElementById('heroPreviewCanvas') as HTMLCanvasElement | null;
      if (cvs) {
        const c = cvs.getContext('2d');
        if (c) {
          c.clearRect(0, 0, cvs.width, cvs.height);
          const t = performance.now() / 1000;
          previewForms.forEach((f, idx) => {
            const px = 78 + idx * 130;
            const py = 96;
            const r = 18 + idx * 3.5;
            drawMythicalBeast(c, f, px, py, r, -Math.PI / 5 + Math.sin(t + idx) * 0.15, t * 2 + idx, 0);
            c.font = 'bold 12px "Noto Serif SC", serif';
            c.fillStyle = '#fde68a';
            c.textAlign = 'center';
            c.fillText(`${idx + 1}阶·${f.name}`, px, 178);
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
      if (cvs) {
        const c = cvs.getContext('2d');
        if (c) {
          c.clearRect(0, 0, cvs.width, cvs.height);
          drawMythicalBeast(c, f, 110, 72, 34, -Math.PI / 6, idx * 1.5, 0);
        }
      }
    });
  }, 20);
}

/** 图鉴全部形态小图 */
export function drawCodexPreviews(forms: BeastForm[]): void {
  setTimeout(() => {
    for (const f of forms) {
      const cvs = document.getElementById(`codex_cvs_${f.id}`) as HTMLCanvasElement | null;
      if (cvs) {
        const c = cvs.getContext('2d');
        if (c) {
          c.clearRect(0, 0, cvs.width, cvs.height);
          drawMythicalBeast(c, f, 46, 46, 22, -Math.PI / 5, 1.2, 0);
        }
      }
    }
  }, 30);
}

/** 结算弹窗最终形态头像 */
export function drawEndPreview(form: BeastForm): void {
  const cvs = document.getElementById('endFormPreview') as HTMLCanvasElement | null;
  if (!cvs) return;
  const c = cvs.getContext('2d');
  if (!c) return;
  c.clearRect(0, 0, cvs.width, cvs.height);
  drawMythicalBeast(c, form, 80, 80, 36, -Math.PI / 6, 2.0, 0);
}

/** 本局构筑面板的当前真身头像 */
export function drawBuildFormPreview(form: BeastForm): void {
  setTimeout(() => {
    const cvs = document.getElementById('buildFormPreview') as HTMLCanvasElement | null;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, cvs.width, cvs.height);
    drawMythicalBeast(c, form, 60, 62, 28, -Math.PI / 6, 1.6, 0);
  }, 20);
}
