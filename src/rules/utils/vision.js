// rules/utils/vision.js
// ECS-aware vision query helpers.

import { Position } from '../components/Position.js';
import { Collider } from '../components/Collider.js';
import { isOpaque } from '../environment/dungeon/tileMap.js';

/**
 * Build a Set of "x,y" keys for entities that block vision (doors, etc.).
 * Walls are handled by TileMap.isOpaque() — this only covers Collider.blocksSight.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Set<string>}
 */
export function buildBlocksVisionMap(world) {
  const blocked = new Set();
  for (const [id, pos] of world.query(Position)) {
    const col = world.get(id, Collider);
    if (col && col.blocksSight) blocked.add(`${pos.x},${pos.y}`);
  }
  return blocked;
}

/**
 * Returns an isBlocked callback suitable for hasLOS / computeFOV.
 * Composes TileMap opacity (walls) with entity-based blocksSight (closed doors).
 * @param {Set<string>} blockedSet
 * @returns {(x:number, y:number) => boolean}
 */
export function blockedCallback(blockedSet) {
  return (x, y) => isOpaque(x, y) || blockedSet.has(`${x},${y}`);
}
