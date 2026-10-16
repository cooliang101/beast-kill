// Web Audio 合成音效（原样移植）。节流阀是关键性能设计：
// AOE 命中时若每击都创建振荡器节点会瞬间创建几十个音频节点导致卡顿。

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private lastHitTime = 0;
  private lastDevourTime = 0;

  init(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  playDevour(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastDevourTime < 55) return;
    this.lastDevourTime = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playHit(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const nowMs = performance.now();
    // 75ms 内最多 1 次受击音效，杜绝 AOE 命中时音频节点风暴
    if (nowMs - this.lastHitTime < 75) return;
    this.lastHitTime = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playEvolution(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    [261.6, 329.6, 392.0, 523.2, 659.2].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.1, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.4);
    });
  }
}

export const sfx = new SoundSystem();
