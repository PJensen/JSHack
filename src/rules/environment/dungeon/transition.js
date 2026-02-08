// rules/environment/dungeon/transition.js
// Handles level transitions (ascending/descending stairs).

import { DungeonState } from '../../components/DungeonState.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { clearAll as clearTileMap } from './tileMap.js';
import { clearExplored } from './exploredMap.js';
import { generateFloor } from './index.js';
import { clearSpatialIndex } from '../../utils/spatialIndex.js';

/**
 * Transition the dungeon to a new depth.
 *
 * Steps:
 * 1. Destroy all floor entities
 * 2. Clear tile data and fog-of-war
 * 3. Generate new floor
 * 4. Move player to destination position
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {number} newDepth
 * @param {{x: number, y: number}} destinationPos - world coords for player placement
 */
export function transitionToDepth(world, newDepth, destinationPos) {
  // Find dungeon state
  let dungeonId = null;
  let ds = null;
  for (const [id, state] of world.query(DungeonState)) {
    dungeonId = id;
    ds = state;
    break;
  }

  // Destroy all entities from the current floor
  if (ds && Array.isArray(ds.floorEntityIds)) {
    for (const eid of ds.floorEntityIds) {
      try { world.destroy(eid); } catch (_) { /* already gone */ }
    }
  }

  // Clear tile data and fog-of-war
  clearTileMap();
  clearExplored();
  clearSpatialIndex(world);

  // Generate the new floor
  const worldSeed = ds ? ds.worldSeed : (world.seed >>> 0);
  const { entityIds } = generateFloor(world, worldSeed, newDepth);

  // Update dungeon state
  if (dungeonId != null) {
    world.mutate(dungeonId, DungeonState, r => {
      r.currentDepth = newDepth;
      r.floorEntityIds = entityIds;
    });
  }

  // Move player to destination
  for (const [id] of world.query(Player)) {
    world.set(id, Position, { x: destinationPos.x, y: destinationPos.y });
    break;
  }

  world.emit?.('dungeon:transitioned', { depth: newDepth, pos: destinationPos });
}
