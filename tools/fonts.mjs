// 字体自托管工具：按"项目实际用到的字符"生成字体子集并落地到 src/assets/fonts/。
//
// 为什么这么做：
// - 全量中文字体一个权重就有 5~15MB，不能自托管；Google Fonts 的 CDN 在大陆不可达。
// - 本游戏文案是封闭集合（数据表 + UI 固定文案），因此可以只打包用到的字形，
//   两个字体族合计通常只有几十 KB。
//
// ⚠️ 新增中文文案后必须重新运行 `npm run fonts`，否则新字会缺字形（回退系统字体）。
//
// 用法：node tools/fonts.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = join(root, 'src', 'assets', 'fonts');
const cssPath = join(root, 'src', 'assets', 'fonts.css');

const FAMILIES = [
  { css: "family=Ma+Shan+Zheng", name: 'Ma Shan Zheng' },
  { css: 'family=Noto+Serif+SC:wght@600;900', name: 'Noto Serif SC' },
];

// ---------------------------------------------------------------- 收集字符

/** 递归收集源码目录下的文件 */
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|html|css)$/.test(p)) out.push(p);
  }
  return out;
}

function collectChars() {
  const files = [join(root, 'index.html'), ...walk(join(root, 'src'))];
  const chars = new Set();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (
        (cp >= 0x4e00 && cp <= 0x9fff) || // CJK 统一表意
        (cp >= 0x3000 && cp <= 0x303f) || // CJK 标点
        (cp >= 0xff00 && cp <= 0xffef) || // 全角字符
        (cp >= 0x20 && cp <= 0x7e) // ASCII 可见字符（数字/字母/符号）
      ) {
        chars.add(ch);
      }
    }
  }
  // 补上运行时可能出现但源码里没有的字形：伤害数字、百分比、特殊符号
  for (const ch of '0123456789%:./+-×·、。，！？：；（）【】《》「」…—★☆✓✗➔▲▼●○◆◇') chars.add(ch);
  return [...chars].sort();
}

// ---------------------------------------------------------------- 抓取子集

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36';

async function fetchCss(familyCss, chunk) {
  const url = `https://fonts.googleapis.com/css2?${familyCss}&text=${encodeURIComponent(chunk)}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`拉取字体 CSS 失败 (${res.status}): ${url.slice(0, 120)}…`);
  return res.text();
}

/** 从一个 CSS 文本里解析出 @font-face 描述（去掉 url，其余描述符保留） */
function parseFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    const get = (k) => (body.match(new RegExp(`${k}:\\s*([^;]+);`)) ?? [])[1]?.trim();
    const url = (body.match(/url\(([^)]+)\)/) ?? [])[1]?.trim();
    if (!url) continue;
    faces.push({
      family: get('font-family'),
      style: get('font-style') ?? 'normal',
      weight: get('font-weight') ?? '400',
      url,
    });
  }
  return faces;
}

/** 由字符集生成 unicode-range（自己构造，保证多分片并存时各管各的字形） */
function unicodeRange(chars) {
  return chars
    .map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase()}`)
    .join(', ');
}

async function buildFamily({ css, name }, chars, chunkSize = 120) {
  const blocks = [];
  let fileIndex = 0;
  for (let i = 0; i < chars.length; i += chunkSize) {
    const chunk = chars.slice(i, i + chunkSize).join('');
    const faceCss = await fetchCss(css, chunk);
    const faces = parseFaces(faceCss);
    if (faces.length === 0) throw new Error(`${name} 未解析到 @font-face`);
    for (const face of faces) {
      const file = `${name.replace(/\s+/g, '-').toLowerCase()}-${fileIndex}.woff2`;
      fileIndex++;
      const bin = await fetch(face.url, { headers: { 'User-Agent': UA } });
      if (!bin.ok) throw new Error(`下载字体文件失败 (${bin.status}): ${face.url}`);
      const buf = Buffer.from(await bin.arrayBuffer());
      writeFileSync(join(fontDir, file), buf);
      // Google 返回的 family 值自带引号，需剥掉后再统一用单引号包裹
      const family = (face.family ?? name).replace(/^['"]+|['"]+$/g, '');
      blocks.push(
        `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  font-style: ${face.style};\n` +
        `  font-weight: ${face.weight};\n` +
        `  font-display: swap;\n` +
        `  src: url('./fonts/${file}') format('woff2');\n` +
        `  unicode-range: ${unicodeRange([...chunk])};\n` +
        `}\n`,
      );
    }
  }
  return blocks;
}

// ---------------------------------------------------------------- 主流程

const chars = collectChars();
console.log(`扫描到 ${chars.length} 个需内嵌字形（含 CJK / 数字 / 标点）`);

rmSync(fontDir, { recursive: true, force: true });
mkdirSync(fontDir, { recursive: true });

const allBlocks = [];
for (const fam of FAMILIES) {
  const blocks = await buildFamily(fam, chars);
  allBlocks.push(`/* ${fam.name}（子集，按项目实际用字生成） */\n${blocks.join('')}`);
  console.log(`${fam.name}: ${blocks.length} 个分片`);
}

const header =
  '/* 此文件由 tools/fonts.mjs 生成，勿手改。\n' +
  '   新增中文文案后请重新运行 `npm run fonts`，否则新字缺字形。\n' +
  '   字体文件位于 src/assets/fonts/，由 Vite 打包为带哈希的本地资源。 */\n\n';
writeFileSync(cssPath, header + allBlocks.join('\n'));

const total = readdirSync(fontDir).reduce((a, f) => a + statSync(join(fontDir, f)).size, 0);
console.log(`完成：${readdirSync(fontDir).length} 个 woff2，合计 ${(total / 1024).toFixed(1)} KB`);
console.log(`CSS: ${relative(root, cssPath)}`);
