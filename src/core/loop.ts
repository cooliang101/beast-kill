// 固定时间步长主循环：模拟锁定 60Hz（可复现、数值稳定），
// 渲染每个显示帧执行（120Hz 屏幕上渲染更顺滑，模拟不加速）。

export const SIM_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 4;

export class FixedLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;

    let steps = 0;
    while (this.acc >= SIM_STEP && steps < MAX_STEPS_PER_FRAME) {
      this.step(SIM_STEP);
      this.acc -= SIM_STEP;
      steps++;
    }
    // 掉帧过久（切标签页等）丢弃积压，防止追帧雪崩
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;

    this.render();
  };
}
