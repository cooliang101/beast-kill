// 此文件由 tools/extract-data.mjs 从 legacy 演示提取生成，勿手改。
// 修改数值请直接编辑本文件（或改脚本后重新生成）。

import type { BeastForm, StageKey } from './types';

export const ALL_FORMS: Record<StageKey, BeastForm[]> = {
  "stage1": [
    {
      "id": "chaos_cub",
      "stage": 1,
      "name": "混沌幼崽",
      "title": "洪荒初生·万兽之源",
      "tags": [
        "dark",
        "blood"
      ],
      "archetype": "cub",
      "primary": "#9333ea",
      "secondary": "#f472b6",
      "accent": "#fde047",
      "eyeColor": "#fef08a",
      "horns": "stub",
      "wings": "none",
      "tails": 1,
      "tailStyle": "fluffy",
      "aura": "chaos",
      "stats": {
        "hp": 130,
        "speed": 3.4,
        "dmgMult": 1,
        "armor": 0
      },
      "skillName": "混沌撕咬",
      "skillDesc": "周期性向最近猎物挥出三连混沌爪影，吞噬基因球范围+25%。"
    }
  ],
  "stage2": [
    {
      "id": "gale_wolf",
      "stage": 2,
      "name": "疾风魔狼",
      "title": "二阶凶兽·裂风掠食者",
      "tags": [
        "wind",
        "blood"
      ],
      "archetype": "wolf",
      "primary": "#059669",
      "secondary": "#6ee7b7",
      "accent": "#ecfdf5",
      "eyeColor": "#34d399",
      "horns": "swept",
      "wings": "wind_fins",
      "tails": 1,
      "tailStyle": "wolf",
      "aura": "wind",
      "stats": {
        "hp": 220,
        "speed": 4.1,
        "dmgMult": 1.25,
        "armor": 2
      },
      "skillName": "朔风新月斩",
      "skillDesc": "疾奔时周期性挥出穿透敌群的翠绿新月风刃与旋风斩。"
    },
    {
      "id": "magma_drake",
      "stage": 2,
      "name": "熔岩巨蜥",
      "title": "二阶凶兽·地心炎兽",
      "tags": [
        "fire",
        "rock"
      ],
      "archetype": "drake",
      "primary": "#b91c1c",
      "secondary": "#fb923c",
      "accent": "#fef08a",
      "eyeColor": "#fde047",
      "horns": "crown_spikes",
      "wings": "none",
      "tails": 1,
      "tailStyle": "spiked_heavy",
      "aura": "fire",
      "stats": {
        "hp": 310,
        "speed": 3.2,
        "dmgMult": 1.3,
        "armor": 8
      },
      "skillName": "大地熔火径",
      "skillDesc": "召唤天火流星砸向敌群，并在地面留下持续焚烧的熔岩火海。"
    },
    {
      "id": "abyss_spider",
      "stage": 2,
      "name": "深渊毒蛛",
      "title": "二阶凶兽·八足瘟神",
      "tags": [
        "poison",
        "dark"
      ],
      "archetype": "spider",
      "primary": "#3f6212",
      "secondary": "#a3e635",
      "accent": "#c084fc",
      "eyeColor": "#bef264",
      "horns": "mandibles",
      "wings": "none",
      "tails": 0,
      "tailStyle": "none",
      "aura": "poison",
      "stats": {
        "hp": 240,
        "speed": 3.5,
        "dmgMult": 1.25,
        "armor": 4
      },
      "skillName": "剧毒腐蚀网",
      "skillDesc": "向四周展开八角剧毒蛛网阵，大幅减速猎物并造成持续毒爆。"
    },
    {
      "id": "frost_fox",
      "stage": 2,
      "name": "玄冰妖狐",
      "title": "二阶凶兽·极北雪魅",
      "tags": [
        "ice",
        "phantom"
      ],
      "archetype": "wolf",
      "primary": "#0284c7",
      "secondary": "#bae6fd",
      "accent": "#f472b6",
      "eyeColor": "#7dd3fc",
      "horns": "fox_ears",
      "wings": "none",
      "tails": 3,
      "tailStyle": "fox",
      "aura": "ice",
      "stats": {
        "hp": 210,
        "speed": 3.9,
        "dmgMult": 1.28,
        "armor": 2
      },
      "skillName": "凛冬冰魄剑",
      "skillDesc": "三尾摇曳齐射六棱寒冰飞剑，冻结敌人并绽放冰晶雪花阵。"
    },
    {
      "id": "berserk_bear",
      "stage": 2,
      "name": "狂暴战熊",
      "title": "二阶凶兽·裂地巨力",
      "tags": [
        "blood",
        "rock"
      ],
      "archetype": "drake",
      "primary": "#7f1d1d",
      "secondary": "#f43f5e",
      "accent": "#fca5a5",
      "eyeColor": "#f87171",
      "horns": "bear_ears",
      "wings": "none",
      "tails": 1,
      "tailStyle": "stub",
      "aura": "blood",
      "stats": {
        "hp": 350,
        "speed": 3.2,
        "dmgMult": 1.35,
        "armor": 10
      },
      "skillName": "撼地血怒震",
      "skillDesc": "重踏大地引发放射状岩石地裂尖刺，震退周围敌群并恢复气血。"
    },
    {
      "id": "thunder_eel",
      "stage": 2,
      "name": "雷鸣电鳗",
      "title": "二阶凶兽·沧海雷蛇",
      "tags": [
        "thunder",
        "wind"
      ],
      "archetype": "serpent",
      "primary": "#ca8a04",
      "secondary": "#fef08a",
      "accent": "#38bdf8",
      "eyeColor": "#fef9c3",
      "horns": "feeler",
      "wings": "fin_wings",
      "tails": 1,
      "tailStyle": "eel",
      "aura": "thunder",
      "stats": {
        "hp": 230,
        "speed": 3.8,
        "dmgMult": 1.3,
        "armor": 3
      },
      "skillName": "高压分形电弧",
      "skillDesc": "周身环绕跳跃分形电弧，自动电击并麻痹靠近的多个目标。"
    },
    {
      "id": "bastion_turtle",
      "stage": 2,
      "name": "磐石巨龟",
      "title": "二阶凶兽·不动山岳",
      "tags": [
        "rock",
        "ice"
      ],
      "archetype": "turtle",
      "primary": "#57534e",
      "secondary": "#a8a29e",
      "accent": "#38bdf8",
      "eyeColor": "#e7e5e4",
      "horns": "stub",
      "wings": "none",
      "tails": 1,
      "tailStyle": "spiked_heavy",
      "aura": "rock",
      "stats": {
        "hp": 400,
        "speed": 3,
        "dmgMult": 1.2,
        "armor": 16
      },
      "skillName": "玄甲荆棘震",
      "skillDesc": "硬化甲壳减免伤害，并周期性向八方破土刺出岩石尖峰。"
    },
    {
      "id": "vampire_bat",
      "stage": 2,
      "name": "噬血魔蝠",
      "title": "二阶凶兽·暗夜血翼",
      "tags": [
        "blood",
        "dark"
      ],
      "archetype": "bat",
      "primary": "#881337",
      "secondary": "#fb7185",
      "accent": "#c084fc",
      "eyeColor": "#fda4af",
      "horns": "bat_ears",
      "wings": "bat_wings",
      "tails": 1,
      "tailStyle": "whip",
      "aura": "blood",
      "stats": {
        "hp": 215,
        "speed": 4,
        "dmgMult": 1.28,
        "armor": 2
      },
      "skillName": "超声波血环",
      "skillDesc": "释放多层律动腥红声波环，造成范围切割伤害并汲取生命。"
    },
    {
      "id": "phantom_cat",
      "stage": 2,
      "name": "幻影灵猫",
      "title": "二阶凶兽·九命幽影",
      "tags": [
        "phantom",
        "wind"
      ],
      "archetype": "wolf",
      "primary": "#831843",
      "secondary": "#f472b6",
      "accent": "#c084fc",
      "eyeColor": "#fbcfe8",
      "horns": "fox_ears",
      "wings": "ribbon",
      "tails": 2,
      "tailStyle": "whip",
      "aura": "phantom",
      "stats": {
        "hp": 205,
        "speed": 4.2,
        "dmgMult": 1.32,
        "armor": 2
      },
      "skillName": "幽冥分身斩",
      "skillDesc": "在猎物群中投射交叉幻影剑芒，造成高频暴击切割。"
    }
  ],
  "stage3": [
    {
      "id": "thunder_roc",
      "stage": 3,
      "name": "九天雷鹏",
      "title": "三阶灵兽·扶摇九万里",
      "tags": [
        "thunder",
        "wind"
      ],
      "archetype": "bird",
      "primary": "#d97706",
      "secondary": "#fef08a",
      "accent": "#38bdf8",
      "eyeColor": "#ffffff",
      "horns": "crest_gold",
      "wings": "feathered_large",
      "tails": 3,
      "tailStyle": "peacock",
      "aura": "thunder",
      "stats": {
        "hp": 420,
        "speed": 4.4,
        "dmgMult": 1.65,
        "armor": 6
      },
      "skillName": "九霄紫电链",
      "skillDesc": "双翼扇动引落分形金色闪电链，在敌群间高速弹射并留下雷印。"
    },
    {
      "id": "qiongqi_beast",
      "stage": 3,
      "name": "穷奇凶兽",
      "title": "三阶灵兽·四凶之首",
      "tags": [
        "blood",
        "wind"
      ],
      "archetype": "wolf",
      "primary": "#9f1239",
      "secondary": "#fb7185",
      "accent": "#fde047",
      "eyeColor": "#fecdd3",
      "horns": "demon_curved",
      "wings": "bat_wings",
      "tails": 1,
      "tailStyle": "spiked_heavy",
      "aura": "blood",
      "stats": {
        "hp": 460,
        "speed": 4,
        "dmgMult": 1.75,
        "armor": 10
      },
      "skillName": "十方戮神剑气",
      "skillDesc": "咆哮释放八方腥红月牙剑气，命中流血猎物时恢复自身气血。"
    },
    {
      "id": "yamata_serpent",
      "stage": 3,
      "name": "八岐大蛇",
      "title": "三阶灵兽·覆海魔蛟",
      "tags": [
        "poison",
        "dark"
      ],
      "archetype": "serpent",
      "primary": "#1e1b4b",
      "secondary": "#84cc16",
      "accent": "#a855f7",
      "eyeColor": "#bef264",
      "horns": "multi_heads",
      "wings": "none",
      "tails": 3,
      "tailStyle": "serpent",
      "aura": "poison",
      "stats": {
        "hp": 480,
        "speed": 3.6,
        "dmgMult": 1.7,
        "armor": 12
      },
      "skillName": "万蛇幽冥毒火",
      "skillDesc": "多颗蛇首同时向四周喷吐幽冥骷髅毒火，落地形成剧毒瘴气池。"
    },
    {
      "id": "bifang_bird",
      "stage": 3,
      "name": "火凤毕方",
      "title": "三阶灵兽·怪火之兆",
      "tags": [
        "fire",
        "wind"
      ],
      "archetype": "bird",
      "primary": "#c2410c",
      "secondary": "#fdba74",
      "accent": "#fef08a",
      "eyeColor": "#ffedd5",
      "horns": "crest_fire",
      "wings": "feathered_large",
      "tails": 2,
      "tailStyle": "ribbon_fire",
      "aura": "fire",
      "stats": {
        "hp": 410,
        "speed": 4.2,
        "dmgMult": 1.75,
        "armor": 6
      },
      "skillName": "流火焚天羽",
      "skillDesc": "振翅召唤流星火雨与烈焰龙卷，穿透敌群并引发连环烈焰爆炸。"
    },
    {
      "id": "bingyi_deity",
      "stage": 3,
      "name": "冰夷河伯",
      "title": "三阶灵兽·九河冰尊",
      "tags": [
        "ice",
        "dark"
      ],
      "archetype": "deity",
      "primary": "#0369a1",
      "secondary": "#7dd3fc",
      "accent": "#e0f2fe",
      "eyeColor": "#ffffff",
      "horns": "ice_crown",
      "wings": "ribbon",
      "tails": 1,
      "tailStyle": "eel",
      "aura": "ice",
      "stats": {
        "hp": 440,
        "speed": 3.7,
        "dmgMult": 1.68,
        "armor": 10
      },
      "skillName": "极寒玄冰风暴",
      "skillDesc": "召唤围绕自身旋转扩大的六角暴风雪法阵，冻结并撕碎一切猎物。"
    },
    {
      "id": "kuiniu_beast",
      "stage": 3,
      "name": "夔牛雷兽",
      "title": "三阶灵兽·苍雷震世",
      "tags": [
        "thunder",
        "rock"
      ],
      "archetype": "drake",
      "primary": "#1e3a8a",
      "secondary": "#93c5fd",
      "accent": "#facc15",
      "eyeColor": "#fef08a",
      "horns": "bull_giant",
      "wings": "none",
      "tails": 1,
      "tailStyle": "spiked_heavy",
      "aura": "thunder",
      "stats": {
        "hp": 550,
        "speed": 3.5,
        "dmgMult": 1.7,
        "armor": 18
      },
      "skillName": "雷音震世吼",
      "skillDesc": "独足踏地发出苍雷咆哮，引发全屏雷暴音浪环与落雷矩阵。"
    },
    {
      "id": "xiangliu_hydra",
      "stage": 3,
      "name": "相柳毒神",
      "title": "三阶灵兽·九首腐骨",
      "tags": [
        "poison",
        "blood"
      ],
      "archetype": "serpent",
      "primary": "#064e3b",
      "secondary": "#34d399",
      "accent": "#f43f5e",
      "eyeColor": "#6ee7b7",
      "horns": "multi_heads",
      "wings": "fin_wings",
      "tails": 2,
      "tailStyle": "serpent",
      "aura": "poison",
      "stats": {
        "hp": 490,
        "speed": 3.6,
        "dmgMult": 1.72,
        "armor": 12
      },
      "skillName": "化血腥风潮",
      "skillDesc": "伸出多条剧毒深渊触须抽打全场，使大范围敌人持续融化爆裂。"
    },
    {
      "id": "golden_hou",
      "stage": 3,
      "name": "金毛犼",
      "title": "三阶灵兽·吞天伏龙",
      "tags": [
        "fire",
        "rock"
      ],
      "archetype": "wolf",
      "primary": "#b45309",
      "secondary": "#fde047",
      "accent": "#fb923c",
      "eyeColor": "#fef9c3",
      "horns": "lion_mane",
      "wings": "none",
      "tails": 1,
      "tailStyle": "fluffy",
      "aura": "fire",
      "stats": {
        "hp": 520,
        "speed": 3.8,
        "dmgMult": 1.72,
        "armor": 16
      },
      "skillName": "金焰焚仙圈",
      "skillDesc": "张口吐出三道金色神火冲击环与陨石火雨，焚尽靠近的一切妖魔。"
    },
    {
      "id": "ninetail_fox",
      "stage": 3,
      "name": "九尾天狐",
      "title": "三阶灵兽·青丘帝姬",
      "tags": [
        "phantom",
        "ice"
      ],
      "archetype": "wolf",
      "primary": "#be185d",
      "secondary": "#fbcfe8",
      "accent": "#67e8f9",
      "eyeColor": "#fdf2f8",
      "horns": "fox_ears",
      "wings": "ribbon",
      "tails": 9,
      "tailStyle": "fox",
      "aura": "phantom",
      "stats": {
        "hp": 430,
        "speed": 4.3,
        "dmgMult": 1.75,
        "armor": 8
      },
      "skillName": "青丘摄魂妖火",
      "skillDesc": "九尾齐摇唤出摄魂鬼火与双螺旋妖瞳神光，自动索敌引爆幻境。"
    }
  ],
  "stage4": [
    {
      "id": "kunpeng_myth",
      "stage": 4,
      "name": "北冥鲲鹏",
      "title": "四阶神兽·吞天垂云",
      "tags": [
        "dark",
        "wind"
      ],
      "archetype": "bird",
      "primary": "#312e81",
      "secondary": "#818cf8",
      "accent": "#38bdf8",
      "eyeColor": "#e0e7ff",
      "horns": "crest_gold",
      "wings": "cosmic_wings",
      "tails": 3,
      "tailStyle": "peacock",
      "aura": "chaos",
      "stats": {
        "hp": 820,
        "speed": 4.5,
        "dmgMult": 2.3,
        "armor": 18
      },
      "skillName": "北冥归墟黑洞",
      "skillDesc": "召唤吞噬万物的归墟黑洞与虚空触手，强力牵引全屏猎物并碾碎。"
    },
    {
      "id": "yinglong_dragon",
      "stage": 4,
      "name": "太古应龙",
      "title": "四阶神兽·翼龙天罚",
      "tags": [
        "thunder",
        "fire"
      ],
      "archetype": "serpent",
      "primary": "#b45309",
      "secondary": "#fde047",
      "accent": "#f97316",
      "eyeColor": "#ffffff",
      "horns": "antler_dragon",
      "wings": "feathered_large",
      "tails": 1,
      "tailStyle": "dragon",
      "aura": "thunder",
      "stats": {
        "hp": 880,
        "speed": 4.3,
        "dmgMult": 2.45,
        "armor": 22
      },
      "skillName": "天罚金焰陨星",
      "skillDesc": "呼唤九天金焰雷陨石与分形神雷轰炸战场，造成毁灭性范围伤害。"
    },
    {
      "id": "taotie_fiend",
      "stage": 4,
      "name": "饕餮魔神",
      "title": "四阶神兽·吞天噬地",
      "tags": [
        "blood",
        "dark"
      ],
      "archetype": "drake",
      "primary": "#4c0519",
      "secondary": "#f43f5e",
      "accent": "#c084fc",
      "eyeColor": "#fda4af",
      "horns": "ram_giant",
      "wings": "bat_wings",
      "tails": 1,
      "tailStyle": "spiked_heavy",
      "aura": "blood",
      "stats": {
        "hp": 980,
        "speed": 3.9,
        "dmgMult": 2.35,
        "armor": 26
      },
      "skillName": "饕餮噬界漩涡",
      "skillDesc": "张开深渊巨口与修罗巨爪吞噬生灵，每吞噬猎物永久提升体型与攻击！"
    },
    {
      "id": "zhurong_fire",
      "stage": 4,
      "name": "祝融火神",
      "title": "四阶神兽·南荒火祖",
      "tags": [
        "fire",
        "thunder"
      ],
      "archetype": "deity",
      "primary": "#9a3412",
      "secondary": "#fb923c",
      "accent": "#fef08a",
      "eyeColor": "#fef9c3",
      "horns": "fire_crown",
      "wings": "ribbon_fire",
      "tails": 2,
      "tailStyle": "dragon",
      "aura": "fire",
      "stats": {
        "hp": 850,
        "speed": 4.1,
        "dmgMult": 2.5,
        "armor": 20
      },
      "skillName": "南明离火神柱",
      "skillDesc": "在敌群密集处降下连环大日陨星火雨，瞬间融化敌方护甲与血肉。"
    },
    {
      "id": "gonggong_water",
      "stage": 4,
      "name": "共工水神",
      "title": "四阶神兽·怒触不周",
      "tags": [
        "ice",
        "poison"
      ],
      "archetype": "deity",
      "primary": "#0c4a6e",
      "secondary": "#38bdf8",
      "accent": "#a3e635",
      "eyeColor": "#bae6fd",
      "horns": "antler_dragon",
      "wings": "fin_wings",
      "tails": 1,
      "tailStyle": "serpent",
      "aura": "ice",
      "stats": {
        "hp": 890,
        "speed": 4,
        "dmgMult": 2.35,
        "armor": 22
      },
      "skillName": "弱水三千怒潮",
      "skillDesc": "掀起环绕全屏的玄冥寒冰剑阵与剧毒怒潮，冰封腐蚀沿途所有敌群。"
    },
    {
      "id": "qilin_sage",
      "stage": 4,
      "name": "麒麟瑞兽",
      "title": "四阶神兽·万兽尊王",
      "tags": [
        "rock",
        "thunder"
      ],
      "archetype": "wolf",
      "primary": "#ca8a04",
      "secondary": "#fef08a",
      "accent": "#34d399",
      "eyeColor": "#ffffff",
      "horns": "antler_dragon",
      "wings": "ribbon",
      "tails": 1,
      "tailStyle": "fluffy",
      "aura": "thunder",
      "stats": {
        "hp": 920,
        "speed": 4.3,
        "dmgMult": 2.35,
        "armor": 28
      },
      "skillName": "五方祥瑞雷罡",
      "skillDesc": "踏出祥瑞八卦地裂大阵，同时降下密集九霄紫金天雷。"
    },
    {
      "id": "baihu_slayer",
      "stage": 4,
      "name": "白虎杀神",
      "title": "四阶神兽·庚金戮仙",
      "tags": [
        "blood",
        "wind"
      ],
      "archetype": "wolf",
      "primary": "#e2e8f0",
      "secondary": "#f43f5e",
      "accent": "#38bdf8",
      "eyeColor": "#f43f5e",
      "horns": "tiger_king",
      "wings": "feathered_large",
      "tails": 1,
      "tailStyle": "whip",
      "aura": "blood",
      "stats": {
        "hp": 840,
        "speed": 4.7,
        "dmgMult": 2.6,
        "armor": 20
      },
      "skillName": "庚金白虎诛仙斩",
      "skillDesc": "挥出遮天蔽日的修罗血爪与飓风龙卷，撕裂全屏敌群。"
    },
    {
      "id": "xuanwu_saint",
      "stage": 4,
      "name": "玄武圣兽",
      "title": "四阶神兽·北极镇天",
      "tags": [
        "rock",
        "ice"
      ],
      "archetype": "turtle",
      "primary": "#0f172a",
      "secondary": "#38bdf8",
      "accent": "#a3e635",
      "eyeColor": "#7dd3fc",
      "horns": "snake_entwine",
      "wings": "none",
      "tails": 1,
      "tailStyle": "serpent",
      "aura": "ice",
      "stats": {
        "hp": 1150,
        "speed": 3.6,
        "dmgMult": 2.2,
        "armor": 38
      },
      "skillName": "玄冥镇岳冰山",
      "skillDesc": "龟蛇合鸣唤出北极六角冰晶大阵与大地尖刺，镇压四方群魔。"
    },
    {
      "id": "zhuque_phoenix",
      "stage": 4,
      "name": "朱雀神鸟",
      "title": "四阶神兽·涅槃神凰",
      "tags": [
        "fire",
        "phantom"
      ],
      "archetype": "bird",
      "primary": "#be123c",
      "secondary": "#fb923c",
      "accent": "#fde047",
      "eyeColor": "#fef08a",
      "horns": "crest_fire",
      "wings": "cosmic_wings",
      "tails": 5,
      "tailStyle": "peacock",
      "aura": "fire",
      "stats": {
        "hp": 830,
        "speed": 4.5,
        "dmgMult": 2.5,
        "armor": 18
      },
      "skillName": "红莲涅槃神火",
      "skillDesc": "展开遮天火翼降下红莲陨星雨与破灭神光，并具备涅槃自愈能力。"
    }
  ],
  "stage5": [
    {
      "id": "pangu_titan",
      "stage": 5,
      "name": "盘古真身",
      "title": "五阶创世·开天辟地",
      "tags": [
        "rock",
        "blood",
        "thunder"
      ],
      "archetype": "deity",
      "primary": "#b45309",
      "secondary": "#fef08a",
      "accent": "#f43f5e",
      "eyeColor": "#ffffff",
      "horns": "crown_god",
      "wings": "halo_rings",
      "tails": 0,
      "tailStyle": "none",
      "aura": "god",
      "stats": {
        "hp": 1800,
        "speed": 4.5,
        "dmgMult": 3.5,
        "armor": 45
      },
      "skillName": "开天辟地神斧",
      "skillDesc": "挥动开天神斧劈出横贯全屏的黄金巨刃裂缝与九霄神雷秒杀群魔。"
    },
    {
      "id": "zhulong_creator",
      "stage": 5,
      "name": "烛龙创世",
      "title": "五阶创世·睁眼为昼",
      "tags": [
        "fire",
        "ice",
        "dark"
      ],
      "archetype": "serpent",
      "primary": "#991b1b",
      "secondary": "#fde047",
      "accent": "#38bdf8",
      "eyeColor": "#fef08a",
      "horns": "crown_god",
      "wings": "cosmic_wings",
      "tails": 1,
      "tailStyle": "dragon",
      "aura": "god",
      "stats": {
        "hp": 1650,
        "speed": 4.8,
        "dmgMult": 3.6,
        "armor": 35
      },
      "skillName": "昼夜轮回吐息",
      "skillDesc": "睁眼焚世大日陨星、闭眼永夜极寒冰阵，全屏交替降下昼夜创世神罚！"
    },
    {
      "id": "chaos_fiend",
      "stage": 5,
      "name": "混沌魔神",
      "title": "五阶创世·鸿蒙凶祖",
      "tags": [
        "dark",
        "phantom",
        "poison"
      ],
      "archetype": "deity",
      "primary": "#3b0764",
      "secondary": "#c084fc",
      "accent": "#a3e635",
      "eyeColor": "#f472b6",
      "horns": "demon_curved",
      "wings": "six_wings",
      "tails": 3,
      "tailStyle": "whip",
      "aura": "chaos",
      "stats": {
        "hp": 1700,
        "speed": 4.6,
        "dmgMult": 3.55,
        "armor": 38
      },
      "skillName": "鸿蒙归墟灭世",
      "skillDesc": "六翼齐振撕裂虚空，召唤归墟黑洞群、深渊巨触与破灭神光吞没万物。"
    },
    {
      "id": "nuwa_saint",
      "stage": 5,
      "name": "女娲圣躯",
      "title": "五阶创世·五彩补天",
      "tags": [
        "phantom",
        "rock",
        "wind"
      ],
      "archetype": "serpent",
      "primary": "#047857",
      "secondary": "#6ee7b7",
      "accent": "#f472b6",
      "eyeColor": "#fef08a",
      "horns": "crown_god",
      "wings": "ribbon",
      "tails": 1,
      "tailStyle": "serpent",
      "aura": "god",
      "stats": {
        "hp": 1680,
        "speed": 4.6,
        "dmgMult": 3.4,
        "armor": 40
      },
      "skillName": "五彩神石补天阵",
      "skillDesc": "召唤五色补天神石流星雨与飓风龙卷轰击全屏，并持续恢复气血。"
    },
    {
      "id": "dijun_emperor",
      "stage": 5,
      "name": "帝俊天帝",
      "title": "五阶创世·大日天庭",
      "tags": [
        "fire",
        "thunder",
        "wind"
      ],
      "archetype": "bird",
      "primary": "#d97706",
      "secondary": "#fef08a",
      "accent": "#fb923c",
      "eyeColor": "#ffffff",
      "horns": "crown_god",
      "wings": "six_wings",
      "tails": 5,
      "tailStyle": "peacock",
      "aura": "god",
      "stats": {
        "hp": 1600,
        "speed": 5,
        "dmgMult": 3.7,
        "armor": 32
      },
      "skillName": "十日凌空焚世录",
      "skillDesc": "召唤十日金乌陨星轰炸与分形天雷风暴，瞬间蒸发一切生灵。"
    },
    {
      "id": "donghuang_taiyi",
      "stage": 5,
      "name": "东皇太一",
      "title": "五阶创世·混沌钟主",
      "tags": [
        "thunder",
        "dark",
        "phantom"
      ],
      "archetype": "deity",
      "primary": "#ca8a04",
      "secondary": "#fef08a",
      "accent": "#c084fc",
      "eyeColor": "#fef08a",
      "horns": "crown_god",
      "wings": "halo_rings",
      "tails": 0,
      "tailStyle": "none",
      "aura": "god",
      "stats": {
        "hp": 1750,
        "speed": 4.6,
        "dmgMult": 3.6,
        "armor": 42
      },
      "skillName": "东皇混沌钟声",
      "skillDesc": "敲响混沌钟释放镇压诸天的金色八卦音波巨环与破灭激光束。"
    },
    {
      "id": "zulong_ancestor",
      "stage": 5,
      "name": "祖龙真灵",
      "title": "五阶创世·万龙之祖",
      "tags": [
        "thunder",
        "ice",
        "rock"
      ],
      "archetype": "serpent",
      "primary": "#1d4ed8",
      "secondary": "#93c5fd",
      "accent": "#fde047",
      "eyeColor": "#ffffff",
      "horns": "antler_dragon",
      "wings": "cosmic_wings",
      "tails": 1,
      "tailStyle": "dragon",
      "aura": "god",
      "stats": {
        "hp": 1850,
        "speed": 4.7,
        "dmgMult": 3.55,
        "armor": 44
      },
      "skillName": "九龙朝圣灭世劫",
      "skillDesc": "呼唤极寒冰剑风暴与九霄紫金雷劫，所过之处万物俱灭。"
    },
    {
      "id": "yuanfeng_immortal",
      "stage": 5,
      "name": "元凤不死",
      "title": "五阶创世·百禽之皇",
      "tags": [
        "fire",
        "wind",
        "phantom"
      ],
      "archetype": "bird",
      "primary": "#e11d48",
      "secondary": "#fda4af",
      "accent": "#fde047",
      "eyeColor": "#fef08a",
      "horns": "crest_fire",
      "wings": "six_wings",
      "tails": 7,
      "tailStyle": "peacock",
      "aura": "god",
      "stats": {
        "hp": 1620,
        "speed": 5.1,
        "dmgMult": 3.65,
        "armor": 34
      },
      "skillName": "九天涅槃凰炎劫",
      "skillDesc": "化作不死凰火陨星与飓风席卷天地，散发无尽追踪鬼火与重生圣焰。"
    },
    {
      "id": "shiqilin_sovereign",
      "stage": 5,
      "name": "始麒麟皇",
      "title": "五阶创世·大地皇者",
      "tags": [
        "rock",
        "poison",
        "blood"
      ],
      "archetype": "wolf",
      "primary": "#78350f",
      "secondary": "#fcd34d",
      "accent": "#34d399",
      "eyeColor": "#fef08a",
      "horns": "antler_dragon",
      "wings": "halo_rings",
      "tails": 3,
      "tailStyle": "fluffy",
      "aura": "god",
      "stats": {
        "hp": 1950,
        "speed": 4.5,
        "dmgMult": 3.5,
        "armor": 50
      },
      "skillName": "洪荒大地崩灭印",
      "skillDesc": "脚踏洪荒地脉引发全屏连环地裂岩刺、修罗血爪与万瘟毒界。"
    }
  ]
};
