// rules/environment/dungeon/materialize.js
// Converts a ChunkData tile map into ECS entities.

import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { FloorTile, WallTile } from '../../archetypes/Tiles.js';
import { Door } from '../../archetypes/Door.js';
import { Position } from '../../components/Position.js';
import { materializeSpawn } from './populate.js';
import {
  CHUNK_SIZE, TILE_FLOOR, TILE_WALL, TILE_DOOR,
  TILE_STAIR_DOWN, TILE_STAIR_UP,
} from './constants.js';

/**
 * Convert a ChunkData tile map into ECS entities.
 * @param {import('../../../lib/ecs-js').World} world
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
        case TILE_FLOOR:
          ids.push(createFrom(world, FloorTile, { x: wx, y: wy }));
          break;
        case TILE_WALL:
          ids.push(createFrom(world, WallTile, { x: wx, y: wy }));
          break;
        case TILE_DOOR: {
          // Floor underneath + door on top
          ids.push(createFrom(world, FloorTile, { x: wx, y: wy }));
          ids.push(createFrom(world, Door, { x: wx, y: wy }));
          break;
        }
        case TILE_STAIR_DOWN: {
          ids.push(createFrom(world, FloorTile, { x: wx, y: wy }));
          if (opts.createStairDown) {
            ids.push(opts.createStairDown(world, wx, wy));
          }
          break;
        }
        case TILE_STAIR_UP: {
          ids.push(createFrom(world, FloorTile, { x: wx, y: wy }));
          if (opts.createStairUp) {
            ids.push(opts.createStairUp(world, wx, wy));
          }
          break;
        }
        // TILE_VOID: nothing
      }
    }
  }

  // Materialize spawn points
  for (const sp of chunk.spawns) {
    const eid = spawnFeature(world, sp);
    if (eid != null) ids.push(eid);
  }

  return ids;
}

/**
 * Create an entity from a spawn point descriptor.
 * @param {import('../../../lib/ecs-js').World} world
 * @param {{x:number, y:number, kind:string, params:Object}} spawn
 * @returns {number|null} entity ID or null
 */
function spawnFeature(world, spawn) {
  return materializeSpawn(world, spawn);
}
