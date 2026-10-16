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
  /** 贴图帧索引（0-4 对应 WILD_TYPES，5 为 Boss 配色），渲染层用 */
  typeIndex: number;
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
}

export interface World {
  time: number;
  kills: number;
  shake: number;
  /** 视口尺寸（屏幕像素），由渲染层在 resize 时写入，刷怪环依赖它 */
  view: { w: number; h: number };
  player: PlayerState;
  enemies: Enemy[];
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
  pools: Pools;
  grid: SpatialGrid<Enemy>;
  events: WorldEvents;
}
