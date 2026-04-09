import { DungeonState } from "../components/DungeonState.js";
import { Player } from "../components/Player.js";

/**
 * Resolve the first player entity id.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} [fallback]
 */
export function firstPlayerId(world, fallback = 0) {
  for (const [id] of world.query(Player)) return Number(id || 0) | 0;
  return Number(fallback || 0) | 0;
}

/**
 * Resolve current dungeon depth from DungeonState.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} [fallback]
 */
export function currentDepth(world, fallback = 1) {
  for (const [, ds] of world.query(DungeonState)) {
    return Number(ds?.currentDepth ?? fallback) | 0;
  }
  return Number(fallback || 0) | 0;
}
