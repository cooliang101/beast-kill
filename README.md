# 山海吞噬录：万兽基因谱

网页端高密度单位生存进化游戏（Vampire-Survivors 类）。吞噬万兽精血、融合 24 种太古器官与突变基因、解锁 12 组双器官超武共鸣，依据九大基因亲和度在 5 阶 37 种山海真身中完成"9 选 3"血脉跃迁。

本仓库是原单文件演示（见 `legacy/`）的正式工程化重构版本。

## 技术栈

| 层 | 选型 |
|---|---|
| 语言/构建 | TypeScript（strict）+ Vite |
| 渲染 | PixiJS v8（WebGL，`preference: 'webgl'`；贴图烘焙 + 精灵批渲染） |
| 美术 | 程序化**像素风**：所有异兽由像素图元实时生成（非手绘贴图），启动时烘焙成低分辨率贴图，最近邻放大 3 倍 |
| 模拟 | 自研数据导向实体层：对象池 + 均匀网格空间哈希 + 固定 60Hz 时间步 |
| UI | DOM 覆盖层 + Tailwind CSS v4（硬边框/阶梯色阶/抖动底纹，HUD 不进渲染热路径） |
| 音频 | Web Audio 合成（带节流阀） |
| 测试 | Vitest（纯逻辑 + 模拟层集成，Node 环境）+ Playwright（真实浏览器冒烟 + 美术截图） |

## 快速开始

```bash
npm install
npm run dev        # 开发服务器（默认 http://localhost:5173）
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（HMR，默认 http://localhost:5173） |
| `npm run build` | 类型检查 + 生产构建（输出 `dist/`，`base: './'` 可直接静态托管） |
| `npm run preview` | 本地预览构建产物 |
| `npm run typecheck` | 仅类型检查（tsc --noEmit） |
| `npm test` | 跑全部单测（纯逻辑 + 模拟层集成，Node 环境） |
| `npm run smoke` | 真实浏览器冒烟测试：无头 Chromium 自动跑「开始 → ESC 暂停/恢复 → 图鉴流转 → 升级弹窗拦截 → 压测」，截图存 `tools/screenshots/` |
| `npm run shots` | 美术审查截图：封面/图鉴 37 形态/进化卡/战斗特效/压测/暂停菜单/本局构筑 |
| `npx vitest run tests/sim.test.ts` | 只跑单个测试文件 |

> 首次运行 `npm run smoke` 需要已安装 Playwright 的 Chromium（`npx playwright install chromium`）。

## 目录结构

```
src/
├─ config/        # 数值与数据表：genes/forms/organs/passives（脚本生成）+ balance.ts（调参集中地）
├─ core/          # 通用底层：固定时间步循环、输入、空间哈希、对象池
├─ game/          # 世界状态、主模拟循环（updateWorld）、刷怪、游戏编排（Game）
├─ combat/        # 伤害结算、特效生成器、12 器官武器、本命神通
├─ progression/   # 基因亲和/属性重算、升级三选一与 9 选 3、经验与进化
├─ render/        # 矢量绘制器（painter）、贴图烘焙（textures）、Pixi 场景（scene）
├─ ui/            # HUD、弹窗（升级/进化/图鉴/结算）、预览绘制、SVG 图标
└─ audio/         # Web Audio 合成音效
tools/extract-data.mjs   # 从 legacy 演示提取数据表生成 src/config/*.ts
legacy/                  # 原单文件演示（数值与手感的参照基准，勿改）
tests/                   # Vitest：空间哈希 / 基因 / 升级 / 进化 / 模拟集成
```

## 像素美术管线

异兽美术**不是手绘贴图**，而是由 `src/render/painter.ts` 用像素图元程序化生成——因此加一种新形态只需给数据表加一条记录，角色/敌人/图鉴缩略图/进化卡/封面预览会同时更新。

- **颗粒尺度**：`src/render/pixel.ts` 里的 `TEXEL = 3`（1 个艺术像素 = 3 个世界像素）。改这一个常数就能整体调粗/调细画面颗粒。
- **换算规则**：贴图声明艺术半径 `texelR`，运行时 `sprite.scale = 世界半径 / texelR`，保证小怪与巨兽的像素颗粒一样大。
- **硬边**：关闭抗锯齿 + 最近邻采样 + 精灵坐标取整；特效线条的顶点量化到像素网格、方头线帽。
- **深色形态**：`bodyFill()` 会自动提亮过暗的体色，避免在深色描边下变成一团黑影。
- **UI**：方角、硬投影、阶梯色带（`repeating-linear-gradient` 硬停止），刻意不用模糊与柔和渐变。
- 想看效果：`npm run shots` 生成全套美术截图。

## 性能设计（"不卡"的实现方式）

1. **贴图烘焙**：所有程序化矢量美术（小怪、投射物、月牙、法阵）在启动时烘焙成 GPU 贴图，运行时只画精灵（原来的"每帧上百次 path 调用"变成 1 个 sprite）。
2. **精灵/Graphics 池**：高频实体（怪物/血条/经验球/投射物/粒子/飘字）全部池化复用，稳态零新建对象、零 GC 停顿。
3. **空间哈希**：所有 AOE/索敌从 O(效果×怪物) 全量扫描降为 O(邻近单位)（TypedArray 链表实现，build 零分配）。
4. **ADD 混合替代 shadowBlur**：发光特效统一用 `blendMode: 'add'`，与原 demo 的 `lighter` 管线一致。
5. **DOM UI 隔离**：HUD 数值刷新带变更守卫、结构刷新事件驱动；弹窗打开即暂停模拟。
6. **固定时间步**：模拟锁 60Hz（每帧最多追 4 步），高刷屏只提升渲染流畅度。

游戏内「✨ 神通试炼台」面板提供压测按钮：**🐜 压测：生成1500只怪**，可直接验证海量单位同屏的帧率表现。

## 局内功能

| 功能 | 入口 | 说明 |
|---|---|---|
| 暂停菜单 | `ESC` / HUD「⏸ 暂停」 | 继续吞噬 / 本局图鉴 / 万兽图鉴 / 重开本局 / 返回封面 |
| 本局基因器官图鉴 | HUD「🧬 本局图鉴」/ 暂停菜单 | 当前真身、派生属性总览、九大基因亲和度、12 器官（含超武觉醒状态与配对被动）、12 被动基因；未获得的条目置灰展示 |
| 万兽进化图鉴 | 封面 / 暂停菜单 | 37 种真身 + 12 组超武配方 |

暂停状态机：升级三选一与阶段进化弹窗是强制选择，`ESC` 不会跳过；从暂停菜单进入图鉴后关闭会回到暂停菜单，局内直接打开图鉴则关闭后继续游戏。

## 与 legacy 演示的关系

- `legacy/gemini-code-1791969672274.html` 保留为**数值与手感的唯一参照**：所有公式、冷却、伤害、成长曲线均一一对应移植（差异点标注在 `src/config/balance.ts`）。
- `src/config/{genes,forms,organs,passives}.ts` 由 `node tools/extract-data.mjs` 从该文件提取生成（含完整性校验），修改数值请直接编辑生成文件或改脚本重新生成。
