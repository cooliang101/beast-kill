// 经验与升级流程。等级节点 5/10/15/20 触发 9 选 3 形态进化，
// 其余等级触发器官/基因三选一。

import { BALANCE } from '../config/balance';
import { sfx } from '../audio/sfx';
import type { World } from '../game/types';

/** 获得经验；升级返回 true（一次只结算一级，与 demo 一致） */
export function gainExp(world: World, amount: number): boolean {
  const player = world.player;
  player.exp += amount;
  if (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.level++;
    player.expNext = Math.round(player.expNext * BALANCE.expNextMult + BALANCE.expNextAdd);
    handleLevelUp(world);
    return true;
  }
  return false;
}

export function handleLevelUp(world: World): void {
  sfx.playEvolution();
  const player = world.player;
  const target = BALANCE.stageLevels[player.level];
  if (target && player.stage < target) {
    world.events.onStageEvolution?.(target);
  } else {
    world.events.onLevelUp?.(player.level);
  }
}
