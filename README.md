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
| `npm run fonts` | **重新生成自托管字体子集**（新增中文文案后必须执行，见下文） |
| `npx vitest run tests/sim.test.ts` | 只跑单个测试文件 |

> `npm run smoke` / `npm run shots` 需要本机装一次 Playwright（**它只是测试工具，不在项目依赖里**，以免拖累 CI 与部署）：
> `npm i -D playwright && npx playwright install chromium`，用完可 `npm remove playwright`。

## 目录结构

```
src/
├─ config/        # 数值与数据表：genes/forms/organs/passives（脚本生成）+ balance.ts（调参集中地）
├─ core/          # 通用底层：固定时间步循环、输入、空间哈希、对象池
├─ game/          # 世界状态、主模拟循环（updateWorld）、刷怪/精英/波次导演/事件、游戏编排（Game）
├─ combat/        # 伤害结算、特效生成器、12 器官武器、本命神通
├─ progression/   # 基因亲和/属性重算、升级三选一与 9 选 3、经验与进化
├─ meta/          # 局外成长：精华结算、解锁树数据、localStorage 存档
├─ render/        # 矢量绘制器（painter）、贴图烘焙（textures）、Pixi 场景（scene）
├─ ui/            # HUD、弹窗（升级/进化/图鉴/结算/暂停/祭坛/开局准备）、预览绘制、SVG 图标
└─ audio/         # Web Audio 合成音效
tools/extract-data.mjs   # 从 legacy 演示提取数据表生成 src/config/*.ts
tools/fonts.mjs          # 生成自托管字体子集
tools/smoke.mjs          # 真实浏览器冒烟测试（41 项）
tools/shots.mjs          # 美术审查截图
legacy/                  # 原单文件演示（数值与手感的参照基准，勿改）
tests/                   # Vitest：空间哈希/基因/升级/进化/模拟集成/遭遇系统/局外成长
```

## 部署到 Cloudflare Pages

纯静态、无服务端，构建产物 `dist/` 的资源全部是相对路径（`./assets/...`），可部署在任意子路径或自定义域名下。已用生产构建产物跑过完整的浏览器冒烟（`SMOKE_URL=<预览地址> npm run smoke`，28/28）。

**方式一：GitHub 集成（推荐，推送到 `main` 即自动部署）**

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → 选择 `cooliang101/beast-kill`
2. 构建配置：
   - Framework preset：`None`
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 环境变量：`NODE_VERSION = 22`（仓库已带 `.nvmrc` 作双保险；Vite 7 要求 Node ≥ 20.19）
3. 保存后首次构建约 1 分钟，之后每次 push 自动发布。

**方式二：直接上传（不接 Git）**

```bash
npm run build
npx wrangler pages deploy dist --project-name=beast-kill
```

（首次需 `npx wrangler login`）

**两点注意**

- 依赖里没有 Playwright（见上），CI 构建很轻，无需跳过浏览器下载之类的额外配置。
- **字体已自托管，零外部请求**（见下节）。生产包默认不暴露调试句柄；URL 加 `?debug=1` 可开启 `window.__game`，便于线上排查与控制台调试。

## 字体自托管

游戏不使用任何外部字体 CDN。`npm run fonts`（`tools/fonts.mjs`）会扫描 `index.html` 与 `src/**` 里出现的全部中日韩字符与数字标点，向 Google Fonts 请求**只包含这些字形的 woff2 子集**，落地到 `src/assets/fonts/` 并生成 `src/assets/fonts.css`（每个分片带独立的 `unicode-range`，浏览器按需加载）：

- 两个字体族（书法体 Ma Shan Zheng + 正文 Noto Serif SC 600/900）合计**约 1.4MB**，远小于全量中文字体的 20MB+；首屏只需加载用到的几个分片。
- 字体文件由 Vite 打包成带内容哈希的本地资源（`./assets/*.woff2`），可部署在任意子路径。
- **⚠️ 新增中文文案（数据表里的形态名/技能描述、UI 新文案等）后必须重新运行 `npm run fonts`**，否则新增的字缺字形会回退到系统字体。冒烟测试里有两条守卫断言（自托管字体已加载 / 无外部字体 CDN 请求）会兜住这类回归。

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
| 万兽进化图鉴 | 封面 / 暂停菜单 | 37 种真身 + 12 组超武配方，含**收集度点亮**（已化身/已觉醒计数） |
| 吞噬祭坛 | 封面「🕯 吞噬祭坛」/ 结算弹窗 | 局外成长（见下） |

## 遭遇系统与局外成长

**敌人行为（不只是数值差异）**：六种野生怪各自拥有**行为**——追击、远程弹幕（保持距离+横向游走）、蓄力冲撞（蓄力→冲刺→硬直）、重甲（免击退+减伤）、治疗光环（为周围敌人回血，优先击杀）、死亡分裂（裂成两只小体）。

**精英怪与词缀**：随存活时间提升刷新率（5% 起步），体型放大 1.4 倍、血量 3.2 倍，携带一种词缀并以其颜色显形——狂暴（更快更痛）、分裂（死亡裂开）、护盾（免击退+减伤）、爆裂（死亡近身爆炸，拉开距离即可规避）、吸血（持续自愈，需要爆发击杀）。

**波次导演与随机事件**：每局开局生成一份**随机剧本**（平静/兽潮/精英/喘息段随机排列与时长），跨局不重样；每 42~68 秒触发一次随机事件——兽潮突袭、天降火雨、血月当空（敌速+30%、经验+25%）、宝物妖（击杀掉落宝石簇）、精英猎杀。

**胜利条件**：击败 4 个洪荒霸主或存活 20 分钟即通关结算；通关后可选择「继续征程」进入无尽模式。

**局外成长（吞噬精华）**：击杀/时长/击败 Boss/通关都会折算精华（随难度倍率 1×~2.2×），存档在 `localStorage`。祭坛中可解锁：**血脉祝福**（9 种，开局给对应基因亲和 +6，引导进化走向，300/种）、**起始器官**（5 种可解锁，改变整局构筑起点，240/种）、**属性节点**（5 项小幅度有上限的永久强化）、**难度层级**（通关自动解锁 试炼→凶险→洪荒→灭世）。每局开局可选择起始器官与血脉（「择器降世」弹窗）。

## 与 legacy 演示的关系

- `legacy/gemini-code-1791969672274.html` 保留为**数值与手感的唯一参照**：所有公式、冷却、伤害、成长曲线均一一对应移植（差异点标注在 `src/config/balance.ts`）。
- `src/config/{genes,forms,organs,passives}.ts` 由 `node tools/extract-data.mjs` 从该文件提取生成（含完整性校验），修改数值请直接编辑生成文件或改脚本重新生成。
