// 键盘 + 指针虚拟摇杆输入（与原 demo 行为一致：指针拖拽优先于键盘）。

export class Input {
  readonly keys: Record<string, boolean> = {};
  readonly pointer = { active: false, startX: 0, startY: 0, currX: 0, currY: 0 };
  /** 由 Game 在非 PLAYING 状态置 false，屏蔽拖拽 */
  enabled = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    this.pointer.active = true;
    this.pointer.startX = e.clientX;
    this.pointer.startY = e.clientY;
    this.pointer.currX = e.clientX;
    this.pointer.currY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointer.active) return;
    this.pointer.currX = e.clientX;
    this.pointer.currY = e.clientY;
  };

  private onPointerUp = (): void => {
    this.pointer.active = false;
  };

  /** 窗口失焦时清空按键，避免"卡住一直走" */
  private onBlur = (): void => {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
    this.pointer.active = false;
  };

  /** 归一化移动向量（键盘 + 指针摇杆合成，未归一化前与 demo 一致由调用方处理） */
  moveVector(): { x: number; y: number } {
    let mx = 0;
    let my = 0;
    if (this.keys['w'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;

    if (this.pointer.active) {
      const dx = this.pointer.currX - this.pointer.startX;
      const dy = this.pointer.currY - this.pointer.startY;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        mx = dx / len;
        my = dy / len;
      }
    }
    return { x: mx, y: my };
  }
}
