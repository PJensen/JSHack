import { DungeonState } from "../components/DungeonState.js";
import { Player } from "../components/Player.js";

/**
 * Check whether an entity belongs to the active floor roster.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @param {{
 *   treatPlayerAsOnFloor?: boolean,
 *   fallbackWhenNoDungeonState?: boolean,
 * }} [opts]
 */
export function isEntityOnCurrentFloor(world, entityId, opts = {}) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) return false;
  if (opts.treatPlayerAsOnFloor && world.has(id, Player)) return true;
  for (const [, ds] of world.query(DungeonState)) {
    return Array.isArray(ds?.floorEntityIds) && ds.floorEntityIds.includes(id);
  }
  return !!opts.fallbackWhenNoDungeonState;
}

/**
 * Add an entity to the active floor roster if present.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @returns {boolean}
 */
export function attachEntityToCurrentFloor(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0)) return false;
  for (const [, ds] of world.query(DungeonState)) {
    if (!Array.isArray(ds?.floorEntityIds)) return false;
    if (!ds.floorEntityIds.includes(id)) ds.floorEntityIds.push(id);
    return true;
  }
  return false;
}
