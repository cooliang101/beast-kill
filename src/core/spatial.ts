// 均匀网格空间哈希：把"效果 × 全部敌人"的 O(n×m) 全量扫描
// 降为 O(邻近单位)。使用 TypedArray 链表实现，build() 零分配。
//
// 用法约束：
// - 每帧 build() 一次；queryCircle 返回的索引数组是内部复用缓冲，
//   必须"立即消费、不得嵌套查询、不得持有"。
// - queryCircle 只做桶粗筛（返回圆形包围盒内的候选），
//   距离/角度精筛由调用方完成（与原 demo 的全遍历语义一致）。

export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cell: number;
  private readonly mask: number;
  private readonly head: Int32Array;
  private next: Int32Array;
  private items: T[] = [];
  private readonly out: number[] = [];

  constructor(cellSize: number, bucketCount = 4096) {
    this.cell = cellSize;
    this.mask = bucketCount - 1;
    this.head = new Int32Array(bucketCount);
    this.next = new Int32Array(1024);
  }

  private bucket(cx: number, cy: number): number {
    return ((cx * 73856093) ^ (cy * 19349663)) & this.mask;
  }

  build(items: T[]): void {
    if (items.length > this.next.length) {
      this.next = new Int32Array(items.length * 2);
    }
    this.head.fill(-1);
    this.items = items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const b = this.bucket(Math.floor(it.x / this.cell), Math.floor(it.y / this.cell));
      this.next[i] = this.head[b];
      this.head[b] = i;
    }
  }

  /** 返回候选实体索引（内部缓冲，立即消费） */
  queryCircle(x: number, y: number, r: number): number[] {
    const out = this.out;
    out.length = 0;
    const minX = Math.floor((x - r) / this.cell);
    const maxX = Math.floor((x + r) / this.cell);
    const minY = Math.floor((y - r) / this.cell);
    const maxY = Math.floor((y + r) / this.cell);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        for (let i = this.head[this.bucket(cx, cy)]; i !== -1; i = this.next[i]) {
          out.push(i);
        }
      }
    }
    return out;
  }

  /** 圆形范围内最近实体（含距离精筛） */
  nearest(x: number, y: number, maxDist: number): T | null {
    const idx = this.queryCircle(x, y, maxDist);
    let best: T | null = null;
    let bestSq = maxDist * maxDist;
    for (let k = 0; k < idx.length; k++) {
      const it = this.items[idx[k]];
      const dx = it.x - x;
      const dy = it.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        best = it;
      }
    }
    return best;
  }

  /** 取回索引对应的实体（配合 queryCircle 使用） */
  at(index: number): T {
    return this.items[index];
  }
}
