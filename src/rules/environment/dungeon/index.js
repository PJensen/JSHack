// rules/environment/dungeon/index.js
// Public API for the BSP dungeon generator.
// Floors are generated in one shot — no per-tick chunk management.

export { CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from './constants.js';
export { chunkSeed, floorSeed, edgeSeed } from './seed.js';
export { generateChunk, edgeGate, findDoorPositions } from './chunk.js';
export { materializeChunk } from './materialize.js';
export { generateFloorPlan, stairWorldPos } from './floorPlan.js';
export { transitionToDepth } from './transition.js';
export { populateChunk, materializeSpawn } from './populate.js';
export { pickMonster, pickItem } from './tables.js';
export { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from './bsp.js';
export { loadChunk, unloadChunk, clearAll, getTile, isWalkable, isOpaque, forEachTileInRect, forEachLoadedTile, loadedChunkCount } from './tileMap.js';
export { markExplored } from './exploredMap.js';

import { DungeonState } from '../../components/DungeonState.js';
import { generateChunk } from './chunk.js';
import { materializeChunk } from './materialize.js';
import { populateChunk } from './populate.js';
import { generateFloorPlan } from './floorPlan.js';
import { chunkSeed } from './seed.js';
import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { StairDown, StairUp } from '../../archetypes/Stairs.js';
import { CHUNK_SIZE, TILE_STAIR_DOWN, TILE_STAIR_UP } from './constants.js';
import { loadChunk as tileMapLoad, clearAll as clearTileMap } from './tileMap.js';
import { clearExplored } from './exploredMap.js';
import { clearSpatialIndex } from '../../utils/spatialIndex.js';

/**
 * Generate all chunks for a floor and materialize everything at once.
 * Returns entity IDs created for bulk cleanup on transition.
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {number} worldSeed
 * @param {number} depth
 * @param {Object} [tombstoneRepo] - Tombstone repository for placing tombstones
 * @returns {{ spawnX: number, spawnY: number, entityIds: number[] }}
 */
export function generateFloor(world, worldSeed, depth, tombstoneRepo = null) {
  const floorPlan = generateFloorPlan(worldSeed, depth);
  const { extent } = floorPlan;
  const allEntityIds = [];

  const stairOpts = {
    createStairDown: (w, x, y) => createFrom(w, StairDown, { x, y }),
    createStairUp: (w, x, y) => createFrom(w, StairUp, { x, y }),
  };

  let spawnX = Math.floor(CHUNK_SIZE / 2);
  let spawnY = Math.floor(CHUNK_SIZE / 2);

  for (let cy = extent.minCY; cy <= extent.maxCY; cy++) {
    for (let cx = extent.minCX; cx <= extent.maxCX; cx++) {
      const chunkData = generateChunk(worldSeed, depth, cx, cy);

      // Place stairs inside actual rooms (not at random positions that may be void)
      for (const stair of floorPlan.downStairs) {
        if (stair.chunkX === cx && stair.chunkY === cy && chunkData.rooms.length > 0) {
          const room = chunkData.rooms[chunkData.rooms.length - 1];
          const lx = (room.x - cx * CHUNK_SIZE) + Math.floor(room.w / 2);
          const ly = (room.y - cy * CHUNK_SIZE) + Math.floor(room.h / 2);
          chunkData.tiles[ly * CHUNK_SIZE + lx] = TILE_STAIR_DOWN;
        }
      }
      for (const stair of floorPlan.upStairs) {
        if (stair.chunkX === cx && stair.chunkY === cy && chunkData.rooms.length > 0) {
          const room = chunkData.rooms[0];
          const lx = (room.x - cx * CHUNK_SIZE) + Math.floor(room.w / 2);
          const ly = (room.y - cy * CHUNK_SIZE) + Math.floor(room.h / 2);
          chunkData.tiles[ly * CHUNK_SIZE + lx] = TILE_STAIR_UP;
        }
      }

      // Populate chunk with monsters and items
      const popSeed = chunkSeed(worldSeed, depth, cx, cy) ^ 0xDEAD;
      const popRng = createRng(popSeed >>> 0);
      chunkData.spawns = populateChunk(chunkData, floorPlan, popRng, tombstoneRepo);

      // Register tile data
      tileMapLoad(cx, cy, chunkData.tiles);

      // Materialize entities (doors, stairs, spawns)
      const ids = materializeChunk(world, chunkData, stairOpts);
      allEntityIds.push(...ids);

      // Use first room of origin chunk as spawn
      if (cx === 0 && cy === 0 && chunkData.rooms.length > 0) {
        const room = chunkData.rooms[0];
        spawnX = room.x + Math.floor(room.w / 2);
        spawnY = room.y + Math.floor(room.h / 2);
      }
    }
  }

  return { spawnX, spawnY, entityIds: allEntityIds };
}

/**
 * Initialize the dungeon system on a world.
 * Creates the DungeonState singleton and generates the first floor.
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {Object} [opts]
 * @param {number} [opts.startDepth=1]
 * @param {Object} [opts.tombstoneRepo] - Tombstone repository for placing tombstones
 * @returns {{ x: number, y: number }} spawn position for the player
 */
export function initDungeon(world, opts = {}) {
  const depth = opts.startDepth || 1;
  const worldSeed = world.seed >>> 0;
  const tombstoneRepo = opts.tombstoneRepo || null;

  clearTileMap();
  clearExplored();
  clearSpatialIndex(world);

  const { spawnX, spawnY, entityIds } = generateFloor(world, worldSeed, depth, tombstoneRepo);

  // Create dungeon state singleton
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed,
    currentDepth: depth,
    floorEntityIds: entityIds,
  });

  return { x: spawnX, y: spawnY };
}
