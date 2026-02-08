// rules/environment/dungeon/transition.js
// Handles level transitions (ascending/descending stairs).

import { ChunkMeta } from '../../components/ChunkMeta.js';
import { DungeonState } from '../../components/DungeonState.js';
import { Position } from '../../components/Position.js';
import { Player } from '../../components/Player.js';
import { clearAll as clearTileMap } from './tileMap.js';

/**
 * Transition the dungeon to a new depth.
 *
 * Steps:
 * 1. Unload ALL loaded chunks (destroy tile/feature entities)
 * 2. Update DungeonState.currentDepth
 * 3. Move player to destination position
 * 4. chunkManagementSystem will load new chunks on next tick
 *
 * @param {import('../../../lib/ecs-js').World} world
 * @param {number} newDepth
 * @param {{x: number, y: number}} destinationPos - world coords for player placement
 */
export function transitionToDepth(world, newDepth, destinationPos) {
  // Clear all tile data from TileMap
  clearTileMap();

  // Unload all chunks
  const chunksToDestroy = [];
  for (const [metaId, meta] of world.query(ChunkMeta)) {
    chunksToDestroy.push({ metaId, entityIds: meta.entityIds });
  }
  for (const { metaId, entityIds } of chunksToDestroy) {
    if (Array.isArray(entityIds)) {
      for (const eid of entityIds) {
        try { world.destroy(eid); } catch (_) { /* already gone */ }
      }
    }
    try { world.destroy(metaId); } catch (_) { /* already gone */ }
  }

  // Update dungeon state
  for (const [dungeonId, _ds] of world.query(DungeonState)) {
    world.mutate(dungeonId, DungeonState, r => {
      r.currentDepth = newDepth;
      r.playerChunkX = 0;
      r.playerChunkY = 0;
    });
    break;
  }

  // Move player to destination
  for (const [id] of world.query(Player)) {
    world.set(id, Position, { x: destinationPos.x, y: destinationPos.y });
    break;
  }

  world.emit?.('dungeon:transitioned', { depth: newDepth, pos: destinationPos });
}
