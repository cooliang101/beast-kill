// 运行时世界实体定义。所有热路径实体均为池化对象，字段在 acquire 时重置。

import type { BeastForm, GeneId } from '../config/types';
import type { Pool } from '../core/pool';
import type { SpatialGrid } from '../core/spatial';

export interface Vec2 {
  x: number;
  y: number;
}

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'OVER';

// ---------------------------------------------------------------- 敌人

/** 敌人行为：直线追击 / 保持距离放弹幕 / 蓄力冲撞 / 免击退重甲 / 治疗光环 / 逃跑（宝箱怪） */
export type EnemyBehavior = 'chaser' | 'ranged' | 'charger' | 'armored' | 'buffer' | 'splitter' | 'flee';

/** 精英词缀 */
export type EliteAffix = 'none' | 'ferocious' | 'splitting' | 'shielded' | 'explosive' | 'leech';

export interface Enemy {
  x: number;
  y: number;
  angle: number;
  walkPhase: number;
  hurtTimer: number;
  primary: string;
  secondary: string;
  accent: string;
  maxHp: number;
  hp: number;
  speed: number;
  radius: number;
  isBoss: boolean;
  name: string;
  /** 贴图帧索引（0..WILD_TYPES.length-1 为野生类型，WILD_TYPES.length 为 Boss 配色），渲染层用 */
  typeIndex: number;
  // ---- 行为（P1） ----
  behavior: EnemyBehavior;
  /** 行为通用计时器（开火间隔 / 冲锋各阶段剩余时间 / 光环周期） */
  actionTimer: number;
  /** 冲锋状态：0 正常 1 蓄力 2 冲刺 3 硬直 */
  actionState: number;
  dashVx: number;
  dashVy: number;
  // ---- 精英（P1） ----
  elite: boolean;
  affix: EliteAffix;
  /** 接触伤害倍率（狂暴精英更高） */
  contactMult: number;
  /** 免疫击退（重甲/护盾） */
  kbImmune: boolean;
  /** 每秒回血（吸血词缀） */
  regen: number;
}

/** 敌方弹幕（远程怪与事件用） */
export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  dmg: number;
  life: number;
}

/** 遭遇段类型：平静 / 兽潮 / 精英 / 喘息 */
export type EncounterPhase = 'calm' | 'horde' | 'elite' | 'breather';

export interface EncounterSegment {
  phase: EncounterPhase;
  duration: number;
}

/** 波次导演：每局开局生成一份随机剧本，运行时按剧本推进 */
export interface Director {
  plan: EncounterSegment[];
  index: number;
  segmentElapsed: number;
  eventTimer: number;
  /** 血月等全局增益的剩余时间 */
  bloodMoonTimer: number;
}

// ---------------------------------------------------------------- 玩家

export interface OrganSlot {
  id: string;
  level: number;
  evolved: boolean;
  timer: number;
}

export interface PassiveSlot {
  id: string;
  level: number;
}

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  walkPhase: number;
  radius: number;
  form: BeastForm;
  stage: number;
  level: number;
  exp: number;
  expNext: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmgMult: number;
  armor: number;
  hurtTimer: number;
  formSkillTimer: number;
  taotieStacks: number;
  organs: OrganSlot[];
  passives: PassiveSlot[];
  geneCounts: Record<GeneId, number>;
  /** 局外成长加成（开局时由存档注入，recalculateStatsAndGenes 叠加） */
  meta: { hpPct: number; speedPct: number; dmgPct: number; critAdd: number; armorAdd: number };
}

// ---------------------------------------------------------------- 武器特效

export type ProjectileStyle = 'ice_sword' | 'wind_shuriken' | 'soul_wisp';

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  dmg: number;
  pierce: number;
  style: ProjectileStyle;
  evo: boolean;
  homing: boolean;
  hasTrail: boolean;
  rot: number;
  life: number;
  trail: Vec2[];
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  isGiant: boolean;
}

export interface LightningBolt {
  pts: Vec2[];
  branchPts: Vec2[];
  targetX: number;
  targetY: number;
  hasTarget: boolean;
  color: string;
  isEvolved: boolean;
  life: number;
  maxLife: number;
}

export interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle: number;
  length: number;
  width: number;
  color: string;
  isEvolved: boolean;
  life: number;
  maxLife: number;
}

export interface AbyssTentacle {
  x: number;
  y: number;
  baseAngle: number;
  len: number;
  color: string;
  phase: number;
  life: number;
  maxLife: number;
}

export interface Meteor {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  dmg: number;
  isEvolved: boolean;
  progress: number;
  speed: number;
}

export type ZoneType =
  | 'poison_web'
  | 'ice_sigil'
  | 'rock_spikes'
  | 'sonic_bagua'
  | 'blackhole'
  | 'magma_crater';

export interface GroundZone {
  x: number;
  y: number;
  r: number;
  color: string;
  dmg: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  type: ZoneType;
  rot: number;
}

export interface Tornado {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  dmg: number;
  life: number;
  tickTimer: number;
  phase: number;
}

export interface OrbitSpike {
  x: number;
  y: number;
  angle: number;
  evolved: boolean;
  trail: Vec2[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
}

export interface ExpGem {
  x: number;
  y: number;
  val: number;
  color: string;
  r: number;
  beingPulled: boolean;
}

// ---------------------------------------------------------------- 世界

export interface Pools {
  enemy: Pool<Enemy>;
  enemyShot: Pool<EnemyShot>;
  projectile: Pool<Projectile>;
  slash: Pool<SlashEffect>;
  bolt: Pool<LightningBolt>;
  beam: Pool<LaserBeam>;
  tentacle: Pool<AbyssTentacle>;
  meteor: Pool<Meteor>;
  zone: Pool<GroundZone>;
  tornado: Pool<Tornado>;
  spike: Pool<OrbitSpike>;
  particle: Pool<Particle>;
  text: Pool<FloatingText>;
  gem: Pool<ExpGem>;
}

export interface WorldEvents {
  onLevelUp?: (level: number) => void;
  onStageEvolution?: (targetStage: number) => void;
  onStatsChanged?: () => void;
  onBossSpawn?: (name: string) => void;
  onGameOver?: () => void;
  /** 通关（击败指定数量 Boss 或存活到时限） */
  onVictory?: () => void;
  /** 随机事件播报（横幅提示） */
  onEvent?: (label: string, color: string) => void;
  /** 精英出现播报 */
  onEliteSpawn?: (affixName: string) => void;
}

export interface World {
  time: number;
  kills: number;
  shake: number;
  /** 视口尺寸（屏幕像素），由渲染层在 resize 时写入，刷怪环依赖它 */
  view: { w: number; h: number };
  player: PlayerState;
  enemies: Enemy[];
  enemyShots: EnemyShot[];
  projectiles: Projectile[];
  meteors: Meteor[];
  slashes: SlashEffect[];
  bolts: LightningBolt[];
  beams: LaserBeam[];
  tentacles: AbyssTentacle[];
  zones: GroundZone[];
  tornadoes: Tornado[];
  spikes: OrbitSpike[];
  particles: Particle[];
  texts: FloatingText[];
  gems: ExpGem[];
  spawnTimer: number;
  nextBossTime: number;
  /** 已击败 Boss 数（胜利条件） */
  bossesKilled: number;
  victory: boolean;
  /** 通关后选择继续（无尽模式）：不再触发胜利结算 */
  endless: boolean;
  /** 难度层级 1..4 */
  difficulty: number;
  /** 全局敌速倍率（血月事件） */
  enemySpeedMult: number;
  /** 全局经验倍率（血月事件） */
  enemyExpMult: number;
  /** 本局开局选择的起始器官 id */
  startOrganId: string;
  /** 本局开局选择的血脉标签（无则 null） */
  bloodline: GeneId | null;
  director: Director;
  pools: Pools;
  grid: SpatialGrid<Enemy>;
  events: WorldEvents;
}
