// 全局数值调优集中地。与原 demo 的差异点均标注了原值。

export const BALANCE = {
  // ---- 刷怪 ----
  // 敌人上限随时间从 enemyCapBase 增长到 enemyCapMax（原 demo 恒为 115；
  // 开局必须克制，后期再放开，避免"一上来就满屏怪"）
  enemyCapBase: 110,
  enemyCapPerMinute: 18,
  enemyCapMax: 360,
  /** 硬上限（压测/事件短时突破用） */
  enemyCap: 500,
  // 刷怪速率曲线（显式曲线，便于推理与调参）：
  // 替代原 demo 的 1 + floor(t/35) 分段跳变——那条曲线第 2 分钟就到 ~7.8 只/秒，
  // 远超玩家早期清怪能力，是"前期怪太多"的主因。
  spawnRateBase: 1.2, // 开局每秒刷怪数
  spawnRatePerMinute: 0.55, // 每分钟递增
  spawnRateMax: 9, // 后期上限（每秒）
  spawnBurstCount: 1, // 普通段每次刷 1 只；兽潮段由 hordeCountMult 放大
  scaleTimeFactor: 0.025,
  scaleLevelFactor: 0.11,
  spawnRingMargin: 70,
  separation: true, // 轻量群体分离，避免大量单位重叠成一坨
  /** 开局宽限：此时间内不刷精英、不出随机事件、剧本不排兽潮/精英段 */
  earlyGraceTime: 90,

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

  // ---- 敌人行为（P1） ----
  rangedKeepDist: 250,
  rangedFireCd: 3.0,
  rangedShotSpeed: 3.0,
  rangedShotDmg: 12,
  rangedShotLife: 4,
  chargerTriggerDist: 300,
  chargerWindup: 0.65,
  chargerDashTime: 0.4,
  chargerDashSpeed: 8.0,
  chargerRecover: 0.85,
  splitterChildren: 1,
  splitterChildScale: 0.62,
  splitterChildHpMult: 0.4,
  armoredDamageMult: 0.85, // 护甲行为受到的伤害倍率
  bufferPeriod: 2.6,
  bufferRadius: 210,
  bufferHealPct: 0.05,
  fleeSpeedMult: 1.35,

  // ---- 精英怪（P1） ----
  eliteChanceBase: 0.015,
  eliteChancePerMinute: 0.01,
  eliteHpMult: 2.6,
  eliteRadiusMult: 1.4,
  eliteExpMult: 2.2,
  eliteContactMult: 1.25,
  explodeRadius: 110,
  explodeDmg: 24,
  leechRegenPct: 0.02, // 吸血词缀：每秒回最大生命的 2%

  // ---- 波次导演与随机事件（P1） ----
  segmentCalm: [24, 40] as const, // [最短, 最长] 秒
  segmentHorde: [12, 20] as const,
  segmentElite: [8, 14] as const,
  segmentBreather: [5, 9] as const,
  hordeSpawnMult: 2.2, // 兽潮段：只放大刷怪速率
  hordeCountMult: 1, // 每次刷怪数量倍率（保持 1：爆发感交给"兽潮突袭"事件的成批投放）
  eventInterval: [75, 110] as const,
  eventHordeCount: 22,
  eventMeteorCount: 10,
  eventMeteorDmg: 46,
  bloodMoonDuration: 15,
  bloodMoonSpeedMult: 1.2,
  bloodMoonSpawnMult: 1.25,
  bloodMoonExpMult: 1.25,
  treasureGemCount: 6,
  treasureHpMult: 6,

  // ---- 胜利条件（P1） ----
  victoryBosses: 4,
  victoryTime: 1200, // 存活 20 分钟也可通关

  // ---- 局外成长（P2） ----
  essencePerKill: 0.4,
  essencePerSecond: 0.5,
  essencePerBoss: 70,
  essenceVictoryBonus: 150,
  difficultyEssenceMult: [1, 1.35, 1.75, 2.2] as const,
  difficultyNames: ['试炼', '凶险', '洪荒', '灭世'] as const,
  difficultyEnemyHpMult: [1, 1.35, 1.75, 2.2] as const,
  difficultyEnemyDmgMult: [1, 1.2, 1.45, 1.7] as const,
  bloodlineBonus: 6, // 血脉祝福：对应基因亲和 +6
  maxDifficulty: 4,
} as const;
