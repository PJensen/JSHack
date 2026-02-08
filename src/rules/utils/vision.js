// rules/utils/vision.js
// ECS-aware vision query helpers.

import { Position } from '../components/Position.js';
import { Terrain } from '../components/Terrain.js';
import { Collider } from '../components/Collider.js';

/**
 * Build a Set of "x,y" keys for tiles that block vision.
 * Checks Terrain.opaque and Collider.blocksSight.
 *
 * @param {import('../../lib/ecs-js').World} world
 * @returns {Set<string>}
 */
export function buildBlocksVisionMap(world) {
  const blocked = new Set();
  for (const [id, pos] of world.query(Position)) {
    let blocks = false;
    const ter = world.get(id, Terrain);
    if (ter && ter.opaque) blocks = true;
    const col = world.get(id, Collider);
    if (col && col.blocksSight) blocks = true;
    if (blocks) blocked.add(`${pos.x},${pos.y}`);
  }
  return blocked;
}

/**
 * Returns an isBlocked callback suitable for hasLOS / computeFOV.
 * @param {Set<string>} blockedSet
 * @returns {(x:number, y:number) => boolean}
 */
export function blockedCallback(blockedSet) {
  return (x, y) => blockedSet.has(`${x},${y}`);
}
