// PixiJS 渲染场景（像素风版）。
//
// 分层结构（app.stage 下）：
//   terrainTiling（屏幕固定像素网格）→ worldLayer（相机平移）
//     ├ mapRing / zone / gem / enemy / player 层
//     ├ fx 精灵层 + fx Graphics 层（ADD 混合，替代原 lighter 块）
//     └ 飘字层
//   joystickGfx（屏幕固定）
//
// 像素化要点：
// - 全部贴图为低分辨率艺术像素，最近邻采样放大（关闭抗锯齿）；
// - 精灵位置取整，避免贴图落在半像素上产生糊边/颤动；
// - Graphics 特效（天雷/激光/触须/流星/龙卷/法阵）坐标量化到 TEXEL 网格，方头线帽；
// - 玩家本命真身按艺术像素分辨率绘制到小 Canvas 后上传（1 个实体，保真像素动画）。

import { Application, CanvasSource, Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import {
  bakeTextures,
  BOSS_RING_TEXEL_R,
  BOSS_RING_WORLD_R,
  GEM_TEXEL_R,
  ICE_SWORD_K,
  MAP_RING_TEXEL_R,
  PARTICLE_SCALE,
  PROJ_TEXEL_EXTENT,
  SHURIKEN_K,
  SLASH_ARC_TEXEL_R,
  SPIKE_TEXEL_EXTENT,
  SPIKE_WORLD_EXTENT,
  WISP_TEXEL_R,
} from './textures';
import type { BakedTextures } from './textures';
import { drawMythicalBeast } from './painter';
import { texelRadius, TEXEL } from './pixel';
import { createMapFeatures } from '../game/world';
import type { MapFeature } from '../game/world';
import type { GameState, World } from '../game/types';
import type { Input } from '../core/input';

const WALK_FRAME_STEP = (Math.PI * 2) / 8;
const GRID_SIZE = 180;

/** 量化到艺术像素网格（像素风特效的关键） */
const q = (v: number): number => Math.round(v / TEXEL) * TEXEL;

/** 用 Graphics 画一个量化半径的像素多边形（近圆），比真圆更有像素感 */
function steppedCirclePath(g: Graphics, cx: number, cy: number, r: number, segments = 16): void {
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = q(cx + Math.cos(a) * r);
    const y = q(cy + Math.sin(a) * r);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

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
          stroke: { color: '#000000', width: 3, join: 'round' },
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
  private zonePool!: GraphicsPool;
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
  private playerTexelR = 0;

  /** 供输入系统绑定指针事件 */
  get canvasElement(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  async init(host: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: '#06060f',
      antialias: false, // 像素风必须关闭抗锯齿
      preference: 'webgl',
      resolution: 1,
      autoDensity: true,
      resizeTo: window,
    });
    host.appendChild(this.app.canvas);

    this.textures = bakeTextures();

    // ---- 地形网格（像素网格贴图 + tileScale = TEXEL） ----
    this.terrain = new TilingSprite({
      texture: this.textures.gridCell,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.terrain.tileScale.set(TEXEL);
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

    this.mapRingPool = new SpritePool(mapRingLayer);
    this.zonePool = new GraphicsPool(zoneLayer);
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

    this.boltPool = new GraphicsPool(fxGfxLayer);
    this.beamPool = new GraphicsPool(fxGfxLayer);
    this.tentaclePool = new GraphicsPool(fxGfxLayer);
    this.meteorPool = new GraphicsPool(fxGfxLayer);
    this.tornadoPool = new GraphicsPool(fxGfxLayer);
    this.trailPool = new GraphicsPool(fxGfxLayer);
    this.textPool = new TextPool(textLayer);

    this.gemLineGfx = new Graphics();
    gemLayer.addChild(this.gemLineGfx);

    // 玩家（艺术像素分辨率小 Canvas → 纹理，每帧重绘上传）
    this.playerCanvas = document.createElement('canvas');
    this.playerCtx = this.playerCanvas.getContext('2d')!;
    this.playerSource = new CanvasSource({ resource: this.playerCanvas });
    this.playerSource.scaleMode = 'nearest';
    this.playerSprite = new Sprite(new Texture({ source: this.playerSource }));
    this.playerSprite.anchor.set(0.5);
    enemyLayer.addChild(this.playerSprite);

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

    // ---- 相机与震屏（震动取整，像素风里不做亚像素抖动） ----
    const shakeX = world.shake > 0 ? Math.round((Math.random() - 0.5) * world.shake) : 0;
    const shakeY = world.shake > 0 ? Math.round((Math.random() - 0.5) * world.shake) : 0;
    const camX = Math.round(w / 2 - player.x) + shakeX;
    const camY = Math.round(h / 2 - player.y) + shakeY;
    this.worldLayer.position.set(camX, camY);
    this.terrain.tilePosition.set(((camX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE, ((camY % GRID_SIZE) + GRID_SIZE) % GRID_SIZE);

    this.mapRingPool.begin();
    this.zonePool.begin();
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

    this.mapRingPool.end();
    this.zonePool.end();
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
      s.alpha = 0.12;
      s.position.set(Math.round(f.x), Math.round(f.y));
      s.scale.set(f.r / MAP_RING_TEXEL_R);
    }
  }

  // ---------------------------------------------------------------- 法阵（量化 Graphics）

  private renderZones(world: World): void {
    for (const z of world.zones) {
      const alpha = Math.min(0.8, (z.life / (z.maxLife || 1)) * 0.9);
      const g = this.zonePool.acquire();
      g.position.set(0, 0);
      g.alpha = alpha;

      switch (z.type) {
        case 'poison_web': {
          // 八角剧毒蛛网：量化多边形填充 + 放射线 + 三层折线环
          steppedCirclePath(g, z.x, z.y, z.r, 16);
          g.fill({ color: z.color, alpha: 0.13 });
          for (let w = 0; w < 8; w++) {
            const a = (w * Math.PI) / 4 + z.rot;
            g.moveTo(q(z.x), q(z.y)).lineTo(q(z.x + Math.cos(a) * z.r), q(z.y + Math.sin(a) * z.r));
          }
          g.stroke({ width: TEXEL, color: z.color });
          for (const ring of [0.4, 0.7, 1.0]) {
            steppedCirclePath(g, z.x, z.y, z.r * ring, 16);
            g.stroke({ width: TEXEL, color: z.color });
          }
          break;
        }

        case 'ice_sigil': {
          // 六角雪花冰晶：旋转的像素射线
          const spin = z.rot + world.time * 0.8;
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + spin;
            const ex = q(z.x + Math.cos(a) * z.r);
            const ey = q(z.y + Math.sin(a) * z.r);
            g.moveTo(q(z.x), q(z.y)).lineTo(ex, ey);
            const mx = z.x + Math.cos(a) * z.r * 0.65;
            const my = z.y + Math.sin(a) * z.r * 0.65;
            g.moveTo(q(mx), q(my)).lineTo(q(mx + Math.cos(a + 0.6) * z.r * 0.28), q(my + Math.sin(a + 0.6) * z.r * 0.28));
            g.moveTo(q(mx), q(my)).lineTo(q(mx + Math.cos(a - 0.6) * z.r * 0.28), q(my + Math.sin(a - 0.6) * z.r * 0.28));
          }
          g.stroke({ width: TEXEL, color: 0x7dd3fc });
          break;
        }

        case 'rock_spikes': {
          const spikeCount = 12;
          for (let k = 0; k < spikeCount; k++) {
            const a = (k * Math.PI * 2) / spikeCount + z.rot;
            const dist = z.r * (0.45 + (k % 3) * 0.22);
            const sx = z.x + Math.cos(a) * dist;
            const sy = z.y + Math.sin(a) * dist;
            g.moveTo(q(sx + Math.cos(a) * 26), q(sy + Math.sin(a) * 26));
            g.lineTo(q(sx + Math.cos(a + 1.5) * 9), q(sy + Math.sin(a + 1.5) * 9));
            g.lineTo(q(sx + Math.cos(a - 1.5) * 9), q(sy + Math.sin(a - 1.5) * 9));
            g.closePath();
          }
          g.fill({ color: 0xd6d3d1 }).stroke({ width: 1.5, color: 0xfbbf24 });
          break;
        }

        case 'sonic_bagua': {
          const progress = 1 - z.life / z.maxLife;
          const curR = z.r * (0.3 + progress * 0.7);
          for (let k = 0; k <= 36; k++) {
            const a = (k * Math.PI * 2) / 36;
            const waveR = curR + Math.sin(a * 8 + world.time * 15) * 10;
            const x = q(z.x + Math.cos(a) * waveR);
            const y = q(z.y + Math.sin(a) * waveR);
            if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.closePath();
          g.stroke({ width: TEXEL + 1, color: 0xf43f5e });
          break;
        }

        case 'blackhole': {
          steppedCirclePath(g, z.x, z.y, z.r * 0.45, 12);
          g.fill({ color: 0x05020a });
          // 四条量化螺旋臂
          for (let arm = 0; arm < 4; arm++) {
            const theta = world.time * 3 + (arm + 1) * (Math.PI / 2);
            const segs = 8;
            for (let i = 0; i <= segs; i++) {
              const t = i / segs;
              const rr = z.r * 0.55 * t;
              const a = theta + t * 1.6;
              const x = q(z.x + Math.cos(a) * rr);
              const y = q(z.y + Math.sin(a) * rr);
              if (i === 0) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
          }
          g.stroke({ width: TEXEL, color: 0xc084fc });
          break;
        }

        default: {
          // 熔岩火坑
          steppedCirclePath(g, z.x, z.y, z.r, 20);
          g.fill({ color: z.color, alpha: 0.22 }).stroke({ width: TEXEL, color: z.color });
          break;
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
        lines
          .moveTo(q(g.x), q(g.y))
          .lineTo(q(player.x), q(player.y))
          .stroke({ width: TEXEL, color: g.color, alpha: 0.45, cap: 'butt' });
      }
      const s = this.gemPool.acquire();
      s.texture = this.textures.gem;
      s.tint = g.color;
      s.position.set(Math.round(g.x), Math.round(g.y));
      s.scale.set(g.r / GEM_TEXEL_R);
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
      s.position.set(Math.round(e.x), Math.round(e.y));
      s.rotation = e.angle;
      s.scale.set(e.radius / set.texelR);

      if (e.isBoss) {
        const ring = this.bossRingPool.acquire();
        ring.texture = this.textures.bossRing;
        ring.position.set(Math.round(e.x), Math.round(e.y));
        ring.scale.set(BOSS_RING_WORLD_R / BOSS_RING_TEXEL_R);
      }

      if (e.isBoss || e.hp < e.maxHp) {
        // 像素血条：固定整数尺寸 + 1 像素黑描边
        const bw = e.isBoss ? 120 : 48;
        const bh = e.isBoss ? 12 : 6;
        const bx = Math.round(e.x - bw / 2);
        const by = Math.round(e.y - e.radius - (e.isBoss ? 20 : 14));

        const bg = this.hpBgPool.acquire();
        bg.texture = Texture.WHITE;
        bg.anchor.set(0, 0);
        bg.position.set(bx - TEXEL, by - TEXEL);
        bg.scale.set((bw + TEXEL * 2) / 16, (bh + TEXEL * 2) / 16);
        bg.tint = 0x000000;
        bg.alpha = 0.85;

        const fg = this.hpFgPool.acquire();
        fg.texture = Texture.WHITE;
        fg.anchor.set(0, 0);
        fg.position.set(bx, by);
        const ratio = Math.max(0, e.hp / e.maxHp);
        fg.scale.set((bw * ratio) / 16, bh / 16);
        fg.tint = e.isBoss ? 0xf43f5e : 0xfb923c;
      }
    }
  }

  // ---------------------------------------------------------------- 玩家

  private renderPlayer(world: World): void {
    const player = world.player;
    const rT = texelRadius(player.radius);

    // 尺寸/艺术分辨率变化时重建画布（只在升阶/体型变化时发生）
    if (rT !== this.playerTexelR) {
      this.playerTexelR = rT;
      const size = rT * 2 + PAD_PLAYER * 2;
      this.playerCanvas.width = size;
      this.playerCanvas.height = size;
      this.playerSource.resize(size, size, 1);
      this.playerSprite.scale.set(player.radius / rT);
    }

    const ctx = this.playerCtx;
    const c = this.playerCanvas.width / 2;
    ctx.clearRect(0, 0, this.playerCanvas.width, this.playerCanvas.height);
    drawMythicalBeast(ctx, player.form, c, c, rT, 0, player.walkPhase, player.hurtTimer);
    this.playerSource.update();

    this.playerSprite.position.set(Math.round(player.x), Math.round(player.y));
    this.playerSprite.rotation = player.angle;
  }

  // ---------------------------------------------------------------- 战斗特效

  private renderFx(world: World): void {
    const textures = this.textures;

    // 环绕骨剑与像素残影
    const spikeScale = SPIKE_WORLD_EXTENT / SPIKE_TEXEL_EXTENT;
    for (const sp of world.spikes) {
      if (sp.trail.length > 1) {
        const g = this.trailPool.acquire();
        g.blendMode = 'add';
        for (let t = 0; t < sp.trail.length; t++) {
          const x = q(sp.trail[t].x);
          const y = q(sp.trail[t].y);
          if (t === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke({
          width: sp.evolved ? TEXEL * 3 : TEXEL * 2,
          color: sp.evolved ? 0xfbbf24 : 0xd6d3d1,
          alpha: sp.evolved ? 0.45 : 0.35,
          cap: 'butt',
        });
      }
      const s = this.spikePool.acquire();
      s.blendMode = 'add';
      s.texture = sp.evolved ? textures.spikeEvolved : textures.spikeNormal;
      s.position.set(Math.round(sp.x), Math.round(sp.y));
      s.rotation = sp.angle;
      s.scale.set(spikeScale);
    }

    // 投射物
    for (const p of world.projectiles) {
      if (p.hasTrail && p.trail.length > 1) {
        const g = this.trailPool.acquire();
        g.blendMode = 'add';
        for (let t = 0; t < p.trail.length; t++) {
          const x = q(p.trail[t].x);
          const y = q(p.trail[t].y);
          if (t === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke({ width: TEXEL, color: p.color, alpha: 0.4, cap: 'butt' });
      }

      const s = this.projPool.acquire();
      s.blendMode = 'add';
      s.position.set(Math.round(p.x), Math.round(p.y));
      if (p.style === 'ice_sword') {
        s.texture = textures.iceSword;
        s.rotation = Math.atan2(p.vy, p.vx);
        s.scale.set((ICE_SWORD_K * p.r) / PROJ_TEXEL_EXTENT);
      } else if (p.style === 'wind_shuriken') {
        s.texture = textures.shuriken;
        s.tint = p.color;
        s.rotation = p.rot;
        s.scale.set((SHURIKEN_K * p.r) / PROJ_TEXEL_EXTENT);
      } else {
        s.texture = textures.wispOuter;
        s.tint = p.color;
        s.scale.set(p.r / WISP_TEXEL_R);
        const core = this.projCorePool.acquire();
        core.blendMode = 'add';
        core.texture = textures.wispCore;
        core.position.set(Math.round(p.x), Math.round(p.y));
        core.scale.set(p.r * 0.45);
      }
    }

    // 爪击月牙（外层着色 + 白色高光芯）
    for (const sl of world.slashes) {
      const alpha = sl.life / sl.maxLife;
      const scale = sl.radius / SLASH_ARC_TEXEL_R;
      const arc = this.slashPool.acquire();
      arc.blendMode = 'add';
      arc.texture = textures.slashArc;
      arc.tint = sl.color;
      arc.position.set(Math.round(sl.x), Math.round(sl.y));
      arc.rotation = sl.angle;
      arc.scale.set(scale);
      arc.alpha = alpha;

      const core = this.slashPool.acquire();
      core.blendMode = 'add';
      core.texture = textures.slashCore;
      core.position.set(Math.round(sl.x), Math.round(sl.y));
      core.rotation = sl.angle;
      core.scale.set(scale);
      core.alpha = alpha;
    }

    // 受击火花粒子（像素块）
    for (const pt of world.particles) {
      const s = this.particlePool.acquire();
      s.blendMode = 'add';
      s.texture = textures.particle;
      s.tint = pt.color;
      s.position.set(Math.round(pt.x), Math.round(pt.y));
      s.scale.set(pt.r * PARTICLE_SCALE * 0.6);
      s.alpha = pt.life / pt.maxLife;
    }

    // 分形天雷（顶点量化 + 方头线帽）
    for (const l of world.bolts) {
      const g = this.boltPool.acquire();
      g.blendMode = 'add';
      g.alpha = l.life / l.maxLife;
      const tracePath = (pts: typeof l.pts): void => {
        for (let i = 0; i < pts.length; i++) {
          const x = q(pts[i].x);
          const y = q(pts[i].y);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
      };
      tracePath(l.pts);
      g.stroke({ width: l.isEvolved ? TEXEL * 3 : TEXEL * 2, color: l.color, cap: 'butt', join: 'miter' });
      tracePath(l.pts);
      g.stroke({ width: TEXEL, color: 0xffffff, cap: 'butt' });
      if (l.branchPts.length > 0) {
        tracePath(l.branchPts);
        g.stroke({ width: TEXEL, color: l.color, cap: 'butt' });
      }
      if (l.hasTarget) {
        steppedCirclePath(g, l.targetX, l.targetY, l.isEvolved ? 34 : 20, 10);
        g.stroke({ width: TEXEL, color: l.color });
      }
    }

    // 妖瞳激光（矩形光束 + 白色方芯 + 像素螺旋）
    for (const b of world.beams) {
      const g = this.beamPool.acquire();
      g.blendMode = 'add';
      g.alpha = b.life / b.maxLife;
      g.position.set(q(b.x1), q(b.y1));
      g.rotation = b.angle;
      const outerH = Math.max(TEXEL * 2, q(b.width * 2.2));
      const coreH = Math.max(TEXEL, q(b.width * 0.75));
      g.rect(0, -outerH / 2, q(b.length), outerH).fill({ color: b.color });
      g.rect(0, -coreH / 2, q(b.length), coreH).fill({ color: 0xffffff });
      for (let d = 0; d < b.length; d += TEXEL * 4) {
        const wy = Math.round(Math.sin(d * 0.06 - world.time * 25) * (b.width * 1.3) / TEXEL) * TEXEL;
        if (d === 0) g.moveTo(d, wy);
        else g.lineTo(q(d), wy);
      }
      g.stroke({ width: TEXEL, color: 0xfde047, cap: 'butt' });
    }

    // 深渊触须（量化折线，方头，逐段变细）
    for (const ten of world.tentacles) {
      const g = this.tentaclePool.acquire();
      g.blendMode = 'add';
      g.alpha = ten.life / ten.maxLife;
      const segs = 7;
      let px = q(ten.x);
      let py = q(ten.y);
      for (let s = 1; s <= segs; s++) {
        const ratio = s / segs;
        const wave = Math.sin(world.time * 14 + ten.phase + s * 0.8) * 0.4;
        const a = ten.baseAngle + wave;
        const nx = q(ten.x + Math.cos(a) * (ten.len * ratio));
        const ny = q(ten.y + Math.sin(a) * (ten.len * ratio));
        const w = Math.max(TEXEL, q((1 - ratio * 0.75) * 12));
        g.moveTo(px, py).lineTo(nx, ny).stroke({ width: w, color: ten.color, cap: 'butt' });
        px = nx;
        py = ny;
      }
    }

    // 天火流星（像素预警圈 + 方拖尾 + 白芯方块）
    for (const m of world.meteors) {
      const g = this.meteorPool.acquire();
      g.blendMode = 'add';
      const cx = q(m.startX + (m.targetX - m.startX) * m.progress);
      const cy = q(m.startY + (m.targetY - m.startY) * m.progress);

      steppedCirclePath(g, m.targetX, m.targetY, m.radius * m.progress, 12);
      g.stroke({ width: TEXEL, color: m.color, alpha: 0.55 });

      const tail = m.isEvolved ? TEXEL * 7 : TEXEL * 5;
      g.moveTo(cx, cy).lineTo(q(cx - 45), q(cy - 80)).stroke({ width: tail, color: m.color, cap: 'butt' });
      const core = m.isEvolved ? TEXEL * 5 : TEXEL * 3;
      g.rect(cx - core / 2, cy - core / 2, core, core).fill({ color: 0xffffff });
    }

    // 螺旋龙卷（量化虚线弧）
    for (const tor of world.tornadoes) {
      const g = this.tornadoPool.acquire();
      g.blendMode = 'add';
      for (let ring = 0; ring < 4; ring++) {
        const rr = tor.r * (0.3 + ring * 0.22);
        const ox = Math.cos(tor.phase + ring) * 8;
        const oy = Math.sin(tor.phase + ring) * 8;
        for (let a = tor.phase + ring; a < tor.phase + ring + Math.PI * 1.35; a += 0.3) {
          g.moveTo(q(tor.x + ox + Math.cos(a) * rr), q(tor.y + oy + Math.sin(a) * rr));
          g.lineTo(q(tor.x + ox + Math.cos(a + 0.3) * rr), q(tor.y + oy + Math.sin(a + 0.3) * rr));
        }
      }
      g.stroke({ width: TEXEL, color: 0x34d399, cap: 'butt' });
    }
  }

  // ---------------------------------------------------------------- 飘字与摇杆

  private renderTexts(world: World): void {
    for (const ft of world.texts) {
      const t = this.textPool.acquire();
      t.text = ft.text;
      t.style.fontSize = ft.size;
      t.style.fill = ft.color;
      t.position.set(Math.round(ft.x), Math.round(ft.y));
    }
  }

  private renderJoystick(state: GameState, input: Input): void {
    const g = this.joystickGfx;
    g.clear();
    if (state === 'PLAYING' && input.pointer.active) {
      steppedCirclePath(g, input.pointer.startX, input.pointer.startY, 42, 14);
      g.stroke({ width: TEXEL, color: 0xf5d061, alpha: 0.35 });
      steppedCirclePath(g, input.pointer.currX, input.pointer.currY, 16, 10);
      g.fill({ color: 0xf5d061, alpha: 0.55 });
    }
  }
}

/** 玩家画布四周余量（艺术像素），需容纳光环与尾巴外延 */
const PAD_PLAYER = 10;
