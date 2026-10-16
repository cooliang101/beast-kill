// 极简对象池：热路径实体（投射物/粒子/飘字/怪物等）全部复用，
// 稳态下零新建对象，杜绝 GC 停顿。

export class Pool<T> {
  private free: T[] = [];

  constructor(private readonly make: () => T) {}

  acquire(): T {
    return this.free.pop() ?? this.make();
  }

  release(item: T): void {
    this.free.push(item);
  }

  get size(): number {
    return this.free.length;
  }
}

/** 原地压缩：life 衰减到 0 的实体回收到池，保持数组顺序与长度稳定（零新数组分配） */
export function decayAndCompact<T extends { life: number }>(arr: T[], dt: number, pool: Pool<T>): void {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    const it = arr[r];
    it.life -= dt;
    if (it.life > 0) {
      arr[w++] = it;
    } else {
      pool.release(it);
    }
  }
  arr.length = w;
}
