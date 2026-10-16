// PixiJS 渲染场景（原 renderGame 的 GPU 化移植）。
//
// 分层结构（app.stage 下）：
//   terrainTiling（屏幕固定网格）→ worldLayer（相机平移）
//     ├ mapRing / zone / gem / enemy / player 层
//     ├ fx 精灵层 + fx Graphics 层（ADD 混合，替代原 lighter 块）
//     └ 飘字层
//   joystickGfx（屏幕固定）
//
// 性能设计：
// - 高频实体（小怪/血条/经验球/投射物/粒子/月牙）全部精灵池化，稳态零新建；
// - 低频特效（天雷/激光/触须/流星/龙卷/法阵动画）用 Graphics 池，数量有界；
// - 玩家本命真身每帧绘制到 320² 离屏 Canvas 后上传纹理（1 个实体，保真骨骼动画）。

import { Application, CanvasSource, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { bakeTextures, PROJECTILE_TEX_BASE_R, SLASH_ARC_BASE_R, ZONE_TEX_BASE_R } from './textures';
import type { BakedTextures } from './textures';
import { drawMythicalBeast } from './painter';
import { createMapFeatures } from '../game/world';
import type { MapFeature } from '../game/world';
import type { GameState, World } from '../game/types';
import type { Input } from '../core/input';

const WALK_FRAME_STEP = (Math.PI * 2) / 8;
const GRID_SIZE = 180;
const PLAYER_CANVAS = 320;

/** 精灵池：begin → acquire（重置默认态）→ end（隐藏未用） */
class SpritePool {
  private items: Sprite[] = [];
  private used = 0;

  constructor(private readonly parent: Container) {}

  begin(): void {
    this.used = 0;
  }

  acquire(): Sprite {
    let s = this.items[this.used];
    if (!s) {
      s = new Sprite(Texture.WHITE);
      this.parent.addChild(s);
      this.items.push(s);
    }
    this.used++;
    s.visible = true;
    s.alpha = 1;
    s.tint = 0xffffff;
    s.rotation = 0;
    s.scale.set(1);
    s.anchor.set(0.5);
    s.blendMode = 'normal';
    return s;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

/** Graphics 池：低频特效专用 */
class GraphicsPool {
  private items: Graphics[] = [];
  private used = 0;

  constructor(private readonly parent: Container) {}

  begin(): void {
    this.used = 0;
  }

  acquire(): Graphics {
    let g = this.items[this.used];
    if (!g) {
      g = new Graphics();
      this.parent.addChild(g);
      this.items.push(g);
    }
    this.used++;
    g.visible = true;
    g.alpha = 1;
    g.rotation = 0;
    g.scale.set(1);
    g.position.set(0, 0);
    g.blendMode = 'normal';
    g.clear();
    return g;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

/** 伤害飘字 Text 池 */
class TextPool {
  private items: Text[] = [];
  private used = 0;

  constructor(private readonly parent: Container) {}

  begin(): void {
    this.used = 0;
  }

  acquire(): Text {
    let t = this.items[this.used];
    if (!t) {
      t = new Text({
        text: '',
        style: {
          fontFamily: 'Noto Serif SC, PingFang SC, Microsoft YaHei, serif',
          fontSize: 12,
          fontWeight: '900',
          fill: '#ffffff',
          stroke: { color: '#000000', width: 2.5 },
        },
      });
      t.anchor.set(0.5);
      this.parent.addChild(t);
      this.items.push(t);
    }
    this.used++;
    t.visible = true;
    return t;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

export class GameScene {
  private app!: Application;
  private textures!: BakedTextures;
  private mapFeatures: MapFeature[] = createMapFeatures();

  private terrain!: TilingSprite;
  private worldLayer = new Container();

  private mapRingPool!: SpritePool;
  private zoneSpritePool!: SpritePool;
  private gemPool!: SpritePool;
  private enemyPool!: SpritePool;
  private hpBgPool!: SpritePool;
  private hpFgPool!: SpritePool;
  private bossRingPool!: SpritePool;
  private spikePool!: SpritePool;
  private projPool!: SpritePool;
  private projCorePool!: SpritePool;
  private slashPool!: SpritePool;
  private particlePool!: SpritePool;

  private zoneGfxPool!: GraphicsPool;
  private boltPool!: GraphicsPool;
  private beamPool!: GraphicsPool;
  private tentaclePool!: GraphicsPool;
  private meteorPool!: GraphicsPool;
  private tornadoPool!: GraphicsPool;
  private trailPool!: GraphicsPool;
  private gemLineGfx!: Graphics;
  private joystickGfx!: Graphics;

  private textPool!: TextPool;

  private playerCanvas!: HTMLCanvasElement;
  private playerCtx!: CanvasRenderingContext2D;
  private playerSource!: CanvasSource;
  private playerSprite!: Sprite;

  /** 供输入系统绑定指针事件 */
  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  async init(host: HTMLElement): Promise<void> {    this.app = new Application();
    await this.app.init({
      background: '#06060f',
      antialias: true,
      preference: 'webgl',
      resolution: 1,
      autoDensity: true,
      resizeTo: window,
    });
    host.appendChild(this.app.canvas);

    this.textures = bakeTextures();

    // ---- 地形网格（TilingSprite 替代每帧重绘网格线） ----
    this.terrain = new TilingSprite({
      texture: this.textures.gridCell,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.app.stage.addChild(this.terrain);

    // ---- 世界层 ----
    this.app.stage.addChild(this.worldLayer);
    const mapRingLayer = new Container();
    const zoneLayer = new Container();
    const gemLayer = new Container();
    const enemyLayer = new Container();
    const fxSpriteLayer = new Container();
    const fxGfxLayer = new Container();
    const textLayer = new Container();
    this.worldLayer.addChild(mapRingLayer, zoneLayer, gemLayer, enemyLayer, fxSpriteLayer, fxGfxLayer, textLayer);

    // 精灵池
    this.mapRingPool = new SpritePool(mapRingLayer);
    this.zoneSpritePool = new SpritePool(zoneLayer);
    this.gemPool = new SpritePool(gemLayer);
    this.enemyPool = new SpritePool(enemyLayer);
    this.hpBgPool = new SpritePool(enemyLayer);
    this.hpFgPool = new SpritePool(enemyLayer);
    this.bossRingPool = new SpritePool(enemyLayer);
    this.spikePool = new SpritePool(fxSpriteLayer);
    this.projPool = new SpritePool(fxSpriteLayer);
    this.projCorePool = new SpritePool(fxSpriteLayer);
    this.slashPool = new SpritePool(fxSpriteLayer);
    this.particlePool = new SpritePool(fxSpriteLayer);

    // Graphics 池
    this.zoneGfxPool = new GraphicsPool(zoneLayer);
    this.boltPool = new GraphicsPool(fxGfxLayer);
    this.beamPool = new GraphicsPool(fxGfxLayer);
    this.tentaclePool = new GraphicsPool(fxGfxLayer);
    this.meteorPool = new GraphicsPool(fxGfxLayer);
    this.tornadoPool = new GraphicsPool(fxGfxLayer);
    this.trailPool = new GraphicsPool(fxGfxLayer);
    this.textPool = new TextPool(textLayer);

    // 基因球牵引线：全局单 Graphics
    this.gemLineGfx = new Graphics();
    gemLayer.addChild(this.gemLineGfx);

    // 玩家（离屏 Canvas → 纹理，每帧重绘上传）
    this.playerCanvas = document.createElement('canvas');
    this.playerCanvas.width = PLAYER_CANVAS;
    this.playerCanvas.height = PLAYER_CANVAS;
    this.playerCtx = this.playerCanvas.getContext('2d')!;
    this.playerSource = new CanvasSource({ resource: this.playerCanvas });
    this.playerSprite = new Sprite(new Texture({ source: this.playerSource }));
    this.playerSprite.anchor.set(0.5);
    enemyLayer.addChild(this.playerSprite);

    // 虚拟摇杆（屏幕坐标层）
    this.joystickGfx = new Graphics();
    this.app.stage.addChild(this.joystickGfx);
  }

  render(world: World, state: GameState, input: Input): void {
    const renderer = this.app.renderer;
    world.view.w = renderer.width;
    world.view.h = renderer.height;
    const w = renderer.width;
    const h = renderer.height;
    const player = world.player;

    // ---- 相机与震屏 ----
    const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
    const camX = w / 2 - player.x + shakeX;
    const camY = h / 2 - player.y + shakeY;
    this.worldLayer.position.set(camX, camY);
    this.terrain.tilePosition.set(((camX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE, ((camY % GRID_SIZE) + GRID_SIZE) % GRID_SIZE);

    // ---- 池 begin ----
    this.mapRingPool.begin();
    this.zoneSpritePool.begin();
    this.zoneGfxPool.begin();
    this.gemPool.begin();
    this.enemyPool.begin();
    this.hpBgPool.begin();
    this.hpFgPool.begin();
    this.bossRingPool.begin();
    this.spikePool.begin();
    this.projPool.begin();
    this.projCorePool.begin();
    this.slashPool.begin();
    this.particlePool.begin();
    this.boltPool.begin();
    this.beamPool.begin();
    this.tentaclePool.begin();
    this.meteorPool.begin();
    this.tornadoPool.begin();
    this.trailPool.begin();
    this.textPool.begin();

    this.renderMapRings(player.x, player.y, w, h);
    this.renderZones(world);
    this.renderGems(world, w, h);
    this.renderEnemies(world, w, h);
    this.renderPlayer(world);
    this.renderFx(world);
    this.renderTexts(world);
    this.renderJoystick(state, input);

    // ---- 池 end ----
    this.mapRingPool.end();
    this.zoneSpritePool.end();
    this.zoneGfxPool.end();
    this.gemPool.end();
    this.enemyPool.end();
    this.hpBgPool.end();
    this.hpFgPool.end();
    this.bossRingPool.end();
    this.spikePool.end();
    this.projPool.end();
    this.projCorePool.end();
    this.slashPool.end();
    this.particlePool.end();
    this.boltPool.end();
    this.beamPool.end();
    this.tentaclePool.end();
    this.meteorPool.end();
    this.tornadoPool.end();
    this.trailPool.end();
    this.textPool.end();
  }

  // ---------------------------------------------------------------- 地形装饰

  private renderMapRings(px: number, py: number, w: number, h: number): void {
    for (const f of this.mapFeatures) {
      if (Math.abs(f.x - px) > w * 0.65 || Math.abs(f.y - py) > h * 0.65) continue;
      const s = this.mapRingPool.acquire();
      s.texture = this.textures.mapRing;
      s.tint = f.color;
      s.alpha = 0.1;
      s.position.set(f.x, f.y);
      s.scale.set(f.r / 28);
    }
  }

  // ---------------------------------------------------------------- 法阵

  private renderZones(world: World): void {
    for (const z of world.zones) {
      const alpha = Math.min(0.75, (z.life / (z.maxLife || 1)) * 0.85);

      if (z.type === 'poison_web') {
        const s = this.zoneSpritePool.acquire();
        s.texture = this.textures.poisonWeb;
        s.tint = z.color;
        s.position.set(z.x, z.y);
        s.rotation = z.rot;
        s.scale.set(z.r / ZONE_TEX_BASE_R);
        s.alpha = alpha;
      } else if (z.type === 'ice_sigil') {
        const s = this.zoneSpritePool.acquire();
        s.texture = this.textures.iceSigil;
        s.position.set(z.x, z.y);
        s.rotation = z.rot + world.time * 0.8;
        s.scale.set(z.r / ZONE_TEX_BASE_R);
        s.alpha = alpha;
      } else {
        const g = this.zoneGfxPool.acquire();
        g.position.set(z.x, z.y);
        g.alpha = alpha;

        if (z.type === 'rock_spikes') {
          const spikeCount = 12;
          for (let k = 0; k < spikeCount; k++) {
            const a = (k * Math.PI * 2) / spikeCount + z.rot;
            const dist = z.r * (0.45 + (k % 3) * 0.22);
            const sx = Math.cos(a) * dist;
            const sy = Math.sin(a) * dist;
            g.moveTo(sx + Math.cos(a) * 26, sy + Math.sin(a) * 26);
            g.lineTo(sx + Math.cos(a + 1.5) * 9, sy + Math.sin(a + 1.5) * 9);
            g.lineTo(sx + Math.cos(a - 1.5) * 9, sy + Math.sin(a - 1.5) * 9);
            g.closePath();
          }
          g.fill({ color: 0xd6d3d1 });
          g.stroke({ width: 1.5, color: 0xfbbf24 });
        } else if (z.type === 'sonic_bagua') {
          const progress = 1 - z.life / z.maxLife;
          const curR = z.r * (0.3 + progress * 0.7);
          for (let k = 0; k <= 36; k++) {
            const a = (k * Math.PI * 2) / 36;
            const waveR = curR + Math.sin(a * 8 + world.time * 15) * 10;
            const px = Math.cos(a) * waveR;
            const py = Math.sin(a) * waveR;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke({ width: 3.5, color: 0xf43f5e });
        } else if (z.type === 'blackhole') {
          g.circle(0, 0, z.r * 0.45).fill({ color: 0x05020a });
          for (let arm = 0; arm < 4; arm++) {
            const theta = world.time * 3 + (arm + 1) * (Math.PI / 2);
            g.arc(Math.cos(theta) * z.r * 0.25, Math.sin(theta) * z.r * 0.25, z.r * 0.55, theta, theta + Math.PI * 1.1);
          }
          g.stroke({ width: 2.5, color: 0xc084fc });
        } else {
          // magma_crater
          g.circle(0, 0, z.r).fill({ color: z.color, alpha: 0.2 }).stroke({ width: 2, color: z.color });
        }
      }
    }
  }

  // ---------------------------------------------------------------- 经验球

  private renderGems(world: World, w: number, h: number): void {
    const player = world.player;
    const lines = this.gemLineGfx;
    lines.clear();

    for (const g of world.gems) {
      if (Math.abs(g.x - player.x) > w * 0.6 || Math.abs(g.y - player.y) > h * 0.6) continue;
      if (g.beingPulled) {
        lines.moveTo(g.x, g.y).lineTo(player.x, player.y).stroke({ width: 1.2, color: g.color, alpha: 0.4 });
      }
      const s = this.gemPool.acquire();
      s.texture = this.textures.softDot;
      s.tint = g.color;
      s.position.set(g.x, g.y);
      s.scale.set(g.r / 8);
    }
  }

  // ---------------------------------------------------------------- 敌人

  private renderEnemies(world: World, w: number, h: number): void {
    const player = world.player;
    for (const e of world.enemies) {
      if (Math.abs(e.x - player.x) > w * 0.65 || Math.abs(e.y - player.y) > h * 0.65) continue;

      const set = this.textures.wild[e.typeIndex] ?? this.textures.wild[0];
      const frame = set.frames[Math.floor(e.walkPhase / WALK_FRAME_STEP) % set.frames.length];

      const s = this.enemyPool.acquire();
      s.texture = e.hurtTimer > 0 ? set.white : frame;
      s.position.set(e.x, e.y);
      s.rotation = e.angle;
      const scale = e.radius / set.radius;
      s.scale.set(scale);

      if (e.isBoss) {
        const ring = this.bossRingPool.acquire();
        ring.texture = this.textures.bossRing;
        ring.position.set(e.x, e.y);
        ring.scale.set(e.radius / 44);
      }

      if (e.isBoss || e.hp < e.maxHp) {
        const bw = e.isBoss ? e.radius * 2.2 : e.radius * 1.5;
        const bh = e.isBoss ? 6 : 3.5;
        const bg = this.hpBgPool.acquire();
        bg.texture = Texture.WHITE;
        bg.anchor.set(0, 0);
        bg.position.set(e.x - bw / 2, e.y - e.radius - 12);
        bg.scale.set(bw / 16, bh / 16);
        bg.tint = 0x000000;
        bg.alpha = 0.7;

        const fg = this.hpFgPool.acquire();
        fg.texture = Texture.WHITE;
        fg.anchor.set(0, 0);
        fg.position.set(e.x - bw / 2, e.y - e.radius - 12);
        fg.scale.set((bw * Math.max(0, e.hp / e.maxHp)) / 16, bh / 16);
        fg.tint = e.isBoss ? 0xf43f5e : 0xfb923c;
      }
    }
  }

  // ---------------------------------------------------------------- 玩家

  private renderPlayer(world: World): void {
    const player = world.player;
    const ctx = this.playerCtx;
    const c = PLAYER_CANVAS / 2;
    ctx.clearRect(0, 0, PLAYER_CANVAS, PLAYER_CANVAS);
    drawMythicalBeast(ctx, player.form, c, c, player.radius, 0, player.walkPhase, player.hurtTimer);
    this.playerSource.update();

    this.playerSprite.position.set(player.x, player.y);
    this.playerSprite.rotation = player.angle;
  }

  // ---------------------------------------------------------------- 战斗特效

  private renderFx(world: World): void {
    const textures = this.textures;

    // 环绕骨剑与丝带残影
    for (const sp of world.spikes) {
      if (sp.trail.length > 1) {
        const g = this.trailPool.acquire();
        g.blendMode = 'add';
        for (let t = 0; t < sp.trail.length; t++) {
          if (t === 0) g.moveTo(sp.trail[t].x, sp.trail[t].y);
          else g.lineTo(sp.trail[t].x, sp.trail[t].y);
        }
        g.stroke({
          width: sp.evolved ? 8 : 5,
          color: sp.evolved ? 0xfbbf24 : 0xd6d3d1,
          alpha: sp.evolved ? 0.45 : 0.35,
          cap: 'round',
        });
      }
      const s = this.spikePool.acquire();
      s.blendMode = 'add';
      s.texture = sp.evolved ? textures.spikeEvolved : textures.spikeNormal;
      s.position.set(sp.x, sp.y);
      s.rotation = sp.angle;
    }

    // 投射物
    for (const p of world.projectiles) {
      if (p.hasTrail && p.trail.length > 1) {
        const g = this.trailPool.acquire();
        g.blendMode = 'add';
        for (let t = 0; t < p.trail.length; t++) {
          if (t === 0) g.moveTo(p.trail[t].x, p.trail[t].y);
          else g.lineTo(p.trail[t].x, p.trail[t].y);
        }
        g.stroke({ width: p.r * 0.9, color: p.color, alpha: 0.4, cap: 'round' });
      }

      const s = this.projPool.acquire();
      s.blendMode = 'add';
      s.position.set(p.x, p.y);
      if (p.style === 'ice_sword') {
        s.texture = textures.iceSword;
        s.rotation = Math.atan2(p.vy, p.vx);
        s.scale.set(p.r / PROJECTILE_TEX_BASE_R);
      } else if (p.style === 'wind_shuriken') {
        s.texture = textures.shuriken;
        s.tint = p.color;
        s.rotation = p.rot;
        s.scale.set(p.r / PROJECTILE_TEX_BASE_R);
      } else {
        s.texture = textures.wispOuter;
        s.tint = p.color;
        s.scale.set(p.r / 12);
        const core = this.projCorePool.acquire();
        core.blendMode = 'add';
        core.texture = textures.wispCore;
        core.position.set(p.x, p.y);
        core.scale.set((p.r * 0.45) / 5);
      }
    }

    // 爪击月牙（外层着色 + 白色高光芯）
    for (const sl of world.slashes) {
      const alpha = sl.life / sl.maxLife;
      const scale = sl.radius / SLASH_ARC_BASE_R;
      const arc = this.slashPool.acquire();
      arc.blendMode = 'add';
      arc.texture = textures.slashArc;
      arc.tint = sl.color;
      arc.position.set(sl.x, sl.y);
      arc.rotation = sl.angle;
      arc.scale.set(scale);
      arc.alpha = alpha;

      const core = this.slashPool.acquire();
      core.blendMode = 'add';
      core.texture = textures.slashCore;
      core.position.set(sl.x, sl.y);
      core.rotation = sl.angle;
      core.scale.set(scale);
      core.alpha = alpha;
    }

    // 受击火花粒子
    for (const pt of world.particles) {
      const s = this.particlePool.acquire();
      s.blendMode = 'add';
      s.texture = textures.softDot;
      s.tint = pt.color;
      s.position.set(pt.x, pt.y);
      s.scale.set(pt.r / 8);
      s.alpha = pt.life / pt.maxLife;
    }

    // 分形天雷
    for (const l of world.bolts) {
      const g = this.boltPool.acquire();
      g.blendMode = 'add';
      g.alpha = l.life / l.maxLife;
      const drawPath = (pts: typeof l.pts): void => {
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) g.moveTo(pts[i].x, pts[i].y);
          else g.lineTo(pts[i].x, pts[i].y);
        }
      };
      drawPath(l.pts);
      g.stroke({ width: l.isEvolved ? 9 : 6, color: l.color, cap: 'round', join: 'round' });
      drawPath(l.pts);
      g.stroke({ width: 2.2, color: 0xffffff });
      if (l.branchPts.length > 0) {
        drawPath(l.branchPts);
        g.stroke({ width: 2, color: l.color });
      }
      if (l.hasTarget) {
        g.circle(l.targetX, l.targetY, l.isEvolved ? 34 : 20).stroke({ width: 2, color: l.color });
      }
    }

    // 妖瞳激光
    for (const b of world.beams) {
      const g = this.beamPool.acquire();
      g.blendMode = 'add';
      g.alpha = b.life / b.maxLife;
      g.position.set(b.x1, b.y1);
      g.rotation = b.angle;
      g.moveTo(0, 0).lineTo(b.length, 0).stroke({ width: b.width * 2.2, color: b.color, cap: 'round' });
      g.moveTo(0, 0).lineTo(b.length, 0).stroke({ width: b.width * 0.75, color: 0xffffff });
      for (let d = 0; d < b.length; d += 18) {
        const wy = Math.sin(d * 0.06 - world.time * 25) * (b.width * 1.3);
        if (d === 0) g.moveTo(d, wy);
        else g.lineTo(d, wy);
      }
      g.stroke({ width: 2, color: 0xfde047 });
    }

    // 深渊触须
    for (const ten of world.tentacles) {
      const g = this.tentaclePool.acquire();
      g.blendMode = 'add';
      g.position.set(ten.x, ten.y);
      g.alpha = ten.life / ten.maxLife;
      const segs = 7;
      let px = 0;
      let py = 0;
      for (let s = 1; s <= segs; s++) {
        const ratio = s / segs;
        const wave = Math.sin(world.time * 14 + ten.phase + s * 0.8) * 0.4;
        const a = ten.baseAngle + wave;
        const nx = Math.cos(a) * (ten.len * ratio);
        const ny = Math.sin(a) * (ten.len * ratio);
        g.moveTo(px, py).lineTo(nx, ny).stroke({ width: (1 - ratio * 0.75) * 12, color: ten.color, cap: 'round' });
        px = nx;
        py = ny;
      }
    }

    // 天火流星（预警圈 + 拖尾 + 白芯）
    for (const m of world.meteors) {
      const g = this.meteorPool.acquire();
      g.blendMode = 'add';
      const cx = m.startX + (m.targetX - m.startX) * m.progress;
      const cy = m.startY + (m.targetY - m.startY) * m.progress;

      g.circle(m.targetX, m.targetY, m.radius * m.progress).stroke({ width: 2, color: m.color, alpha: 0.53 });
      g.moveTo(cx, cy).lineTo(cx - 45, cy - 80).stroke({ width: m.isEvolved ? 22 : 14, color: m.color, cap: 'round' });
      g.circle(cx, cy, m.isEvolved ? 14 : 9).fill({ color: 0xffffff });
    }

    // 螺旋龙卷
    for (const tor of world.tornadoes) {
      const g = this.tornadoPool.acquire();
      g.blendMode = 'add';
      g.position.set(tor.x, tor.y);
      for (let ring = 0; ring < 4; ring++) {
        const rr = tor.r * (0.3 + ring * 0.22);
        const offsetX = Math.cos(tor.phase + ring) * 8;
        const offsetY = Math.sin(tor.phase + ring) * 8;
        g.arc(offsetX, offsetY, rr, tor.phase + ring, tor.phase + ring + Math.PI * 1.35).stroke({ width: 2.5, color: 0x34d399 });
      }
    }
  }

  // ---------------------------------------------------------------- 飘字与摇杆

  private renderTexts(world: World): void {
    for (const ft of world.texts) {
      const t = this.textPool.acquire();
      t.text = ft.text;
      t.style.fontSize = ft.size;
      t.style.fill = ft.color;
      t.position.set(ft.x, ft.y);
    }
  }

  private renderJoystick(state: GameState, input: Input): void {
    const g = this.joystickGfx;
    g.clear();
    if (state === 'PLAYING' && input.pointer.active) {
      g.circle(input.pointer.startX, input.pointer.startY, 42).stroke({ width: 2, color: 0xf5d061, alpha: 0.35 });
      g.circle(input.pointer.currX, input.pointer.currY, 16).fill({ color: 0xf5d061, alpha: 0.55 });
    }
  }
}
