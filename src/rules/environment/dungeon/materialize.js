// rules/environment/dungeon/materialize.js
// Creates ECS entities for interactive features (doors, stairs, spawns).
// Floor and wall tiles are NOT entities — they live in the TileMap grid.

import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { Door } from '../../archetypes/Door.js';
import { materializeSpawn } from './populate.js';
import {
  CHUNK_SIZE, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP,
} from './constants.js';

/**
 * Create ECS entities for interactive tiles and spawn features.
 * Floor/wall tiles are handled by the TileMap — no entities created for them.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {import('./chunk.js').ChunkData} chunk
 * @param {Object} [opts]
 * @param {Function} [opts.createStairDown] - archetype creator for down stairs
 * @param {Function} [opts.createStairUp]   - archetype creator for up stairs
 * @returns {number[]} entity IDs created (for chunk tracking)
 */
export function materializeChunk(world, chunk, opts = {}) {
  const ids = [];
  const cs = CHUNK_SIZE;
  const ox = chunk.chunkX * cs;
  const oy = chunk.chunkY * cs;

  for (let ly = 0; ly < cs; ly++) {
    for (let lx = 0; lx < cs; lx++) {
      const tile = chunk.tiles[ly * cs + lx];
      const wx = ox + lx;
      const wy = oy + ly;

      switch (tile) {
        case TILE_DOOR:
          ids.push(createFrom(world, Door, { x: wx, y: wy }));
          break;
        case TILE_STAIR_DOWN:
          if (opts.createStairDown) {
            ids.push(opts.createStairDown(world, wx, wy));
          }
          break;
        case TILE_STAIR_UP:
          if (opts.createStairUp) {
            ids.push(opts.createStairUp(world, wx, wy));
          }
          break;
      }
    }
  }

  // Materialize spawn points (monsters, items)
  for (const sp of chunk.spawns) {
    const eid = spawnFeature(world, sp);
    if (eid != null) ids.push(eid);
  }

  return ids;
}

/**
 * Create an entity from a spawn point descriptor.
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {{x:number, y:number, kind:string, params:Object}} spawn
 * @returns {number|null} entity ID or null
 */
function spawnFeature(world, spawn) {
  return materializeSpawn(world, spawn);
}
