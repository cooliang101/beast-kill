// 全局静态配置的数据结构定义。
// 数据本体位于同目录的 genes.ts / forms.ts / organs.ts / passives.ts，
// 由 tools/extract-data.mjs 从 legacy 演示文件中提取生成，勿手改。

export type GeneId =
  | 'wind' | 'fire' | 'thunder' | 'poison' | 'blood'
  | 'ice' | 'rock' | 'dark' | 'phantom';

export interface GeneTag {
  id: GeneId;
  name: string;
  color: string;
  glow: string;
  bg: string;
  desc: string;
}

export interface FormStats {
  hp: number;
  speed: number;
  dmgMult: number;
  armor: number;
}

export interface BeastForm {
  id: string;
  stage: number;
  name: string;
  title: string;
  tags: GeneId[];
  archetype: string;
  primary: string;
  secondary: string;
  accent: string;
  eyeColor: string;
  horns: string;
  wings: string;
  tails: number;
  tailStyle: string;
  aura: string;
  stats: FormStats;
  skillName: string;
  skillDesc: string;
}

export interface OrganDef {
  id: string;
  name: string;
  tags: GeneId[];
  pairPassive: string;
  synergyName: string;
  synergyDesc: string;
  desc: string;
  color: string;
}

export interface PassiveDef {
  id: string;
  name: string;
  tags: GeneId[];
  desc: string;
  color: string;
}

export type StageKey = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';
