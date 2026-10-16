// 全局数值调优集中地。与原 demo 的差异点均标注了原值。

export const BALANCE = {
  // ---- 刷怪 ----
  enemyCap: 500, // 原 demo 为 115（Canvas2D 渲染上限），Pixi 下大幅提高
  spawnIntervalBase: 0.75,
  spawnIntervalMin: 0.2,
  spawnCountPerSeconds: 35, // count = 1 + floor(gameTime / 35)
  scaleTimeFactor: 0.025,
  scaleLevelFactor: 0.11,
  spawnRingMargin: 70,
  separation: true, // 轻量群体分离，避免大量单位重叠成一坨

  // ---- Boss ----
  bossFirstTime: 45,
  bossInterval: 55,
  bossHpBase: 1400,
  bossHpTimeFactor: 0.04,
  bossSpeed: 2.15,
  bossRadius: 44,
  bossContactDmg: 26,

  // ---- 经验与升级 ----
  expNextBase: 18,
  expNextMult: 1.25,
  expNextAdd: 12,
  gemCap: 300, // 原 180
  gemMergeValue: 5,
  stageLevels: { 5: 2, 10: 3, 15: 4, 20: 5 } as Record<number, number>,

  // ---- 演出上限（对象池化后均上调，原值见注释） ----
  particleCap: 400, // 原 140
  floatingTextCap: 24, // 原 28
  projectileCap: 600,

  // ---- 卡组上限 ----
  maxOrgans: 6,
  maxPassives: 6,
  maxCardLevel: 5,

  // ---- 空间哈希 ----
  hashCellSize: 96,

  // ---- 压测 ----
  stressSpawnCount: 1500,
} as const;
