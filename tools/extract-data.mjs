// 一次性数据迁移脚本：从 legacy 演示 HTML 中提取四张纯数据表，
// 生成 src/config/ 下的类型化 TS 文件（零人工转写误差）。
// 用法：node tools/extract-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'legacy', 'gemini-code-1791969672274.html'), 'utf8');

const start = html.indexOf('const GENE_TAGS');
const end = html.indexOf('function getOrganSvg');
if (start < 0 || end < 0 || end <= start) throw new Error('未找到数据表区域');

const code = html.slice(start, end);
const data = new Function(
  `${code}\nreturn { GENE_TAGS, ALL_FORMS, ACTIVE_ORGANS, PASSIVE_GENES };`,
)();

// 完整性校验，防止提取到残缺数据
const geneCount = Object.keys(data.GENE_TAGS).length;
const formCounts = Object.entries(data.ALL_FORMS).map(([k, v]) => `${k}:${v.length}`);
const formTotal = Object.values(data.ALL_FORMS).reduce((a, b) => a + b.length, 0);
console.log(`基因标签: ${geneCount}，形态: ${formCounts.join(' ')}（共 ${formTotal}）`);
console.log(`主动器官: ${data.ACTIVE_ORGANS.length}，被动基因: ${data.PASSIVE_GENES.length}`);
if (geneCount !== 9 || formTotal !== 37 || data.ACTIVE_ORGANS.length !== 12 || data.PASSIVE_GENES.length !== 12) {
  throw new Error('数据数量与演示不符，终止生成');
}

const header = '// 此文件由 tools/extract-data.mjs 从 legacy 演示提取生成，勿手改。\n// 修改数值请直接编辑本文件（或改脚本后重新生成）。\n\n';
const j = (v) => JSON.stringify(v, null, 2);

mkdirSync(join(root, 'src', 'config'), { recursive: true });

writeFileSync(
  join(root, 'src', 'config', 'genes.ts'),
  `${header}import type { GeneId, GeneTag } from './types';\n\nexport const GENE_TAGS: Record<GeneId, GeneTag> = ${j(data.GENE_TAGS)};\n`,
);

writeFileSync(
  join(root, 'src', 'config', 'forms.ts'),
  `${header}import type { BeastForm, StageKey } from './types';\n\nexport const ALL_FORMS: Record<StageKey, BeastForm[]> = ${j(data.ALL_FORMS)};\n`,
);

writeFileSync(
  join(root, 'src', 'config', 'organs.ts'),
  `${header}import type { OrganDef } from './types';\n\nexport const ACTIVE_ORGANS: OrganDef[] = ${j(data.ACTIVE_ORGANS)};\n`,
);

writeFileSync(
  join(root, 'src', 'config', 'passives.ts'),
  `${header}import type { PassiveDef } from './types';\n\nexport const PASSIVE_GENES: PassiveDef[] = ${j(data.PASSIVE_GENES)};\n`,
);

console.log('已生成 src/config/{genes,forms,organs,passives}.ts');
