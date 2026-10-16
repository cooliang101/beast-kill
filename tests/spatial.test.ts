import { describe, it, expect } from 'vitest';
import { SpatialGrid } from '../src/core/spatial';

interface Item {
  x: number;
  y: number;
  id: number;
}

function item(x: number, y: number, id: number): Item {
  return { x, y, id };
}

describe('SpatialGrid 均匀网格空间哈希', () => {
  it('queryCircle 返回包围盒内候选，不含远处实体', () => {
    const items = [item(0, 0, 0), item(50, 0, 1), item(500, 500, 2), item(-40, 30, 3)];
    const grid = new SpatialGrid<Item>(96);
    grid.build(items);
    const found = grid.queryCircle(0, 0, 100).map((i) => grid.at(i).id);
    expect(found).toContain(0);
    expect(found).toContain(1);
    expect(found).toContain(3);
    expect(found).not.toContain(2);
  });

  it('nearest 返回最近实体并遵守最大距离', () => {
    const items = [item(0, 0, 0), item(80, 0, 1), item(300, 0, 2)];
    const grid = new SpatialGrid<Item>(96);
    grid.build(items);
    expect(grid.nearest(10, 0, 500)?.id).toBe(0);
    expect(grid.nearest(200, 0, 500)?.id).toBe(2);
    expect(grid.nearest(1000, 1000, 50)).toBeNull();
  });

  it('负坐标与大范围坐标跨桶正确', () => {
    const items = [item(-5000, -5000, 0), item(-4990, -4995, 1), item(12345, -6789, 2)];
    const grid = new SpatialGrid<Item>(96);
    grid.build(items);
    const found = grid.queryCircle(-5000, -5000, 60).map((i) => grid.at(i).id);
    expect(found).toContain(0);
    expect(found).toContain(1);
    expect(found).not.toContain(2);
  });

  it('重建后不残留旧实体', () => {
    const grid = new SpatialGrid<Item>(96);
    grid.build([item(0, 0, 0)]);
    grid.build([]);
    expect(grid.queryCircle(0, 0, 100).length).toBe(0);
  });
});
