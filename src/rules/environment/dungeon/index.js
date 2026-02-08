// rules/environment/dungeon/index.js
// Public API for the chunk-based BSP dungeon generator.

export { CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from './constants.js';
export { chunkSeed, floorSeed, edgeSeed } from './seed.js';
export { generateChunk, edgeGate, findDoorPositions } from './chunk.js';
export { materializeChunk } from './materialize.js';
export { generateFloorPlan, stairWorldPos } from './floorPlan.js';
export { transitionToDepth } from './transition.js';
export { populateChunk, materializeSpawn } from './populate.js';
export { pickMonster, pickItem } from './tables.js';
export { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from './bsp.js';
export { loadChunk, unloadChunk, clearAll, getTile, isWalkable, isOpaque, forEachTileInRect, loadedChunkCount } from './tileMap.js';

import { DungeonState } from '../../components/DungeonState.js';
import { generateChunk } from './chunk.js';
import { CHUNK_SIZE } from './constants.js';

/**
 * Initialize the dungeon system on a world.
 * Creates the DungeonState singleton entity and finds a valid spawn position
 * inside the first room of the origin chunk.
 * The chunkManagementSystem will load/materialize chunks on the next tick.
 *
 * @param {import('../../../lib/ecs-js').World} world
 * @param {Object} [opts]
 * @param {number} [opts.startDepth=1]
 * @returns {{ x: number, y: number }} spawn position for the player
 */
export function initDungeon(world, opts = {}) {
  const depth = opts.startDepth || 1;
  const worldSeed = world.seed >>> 0;

  // Eagerly generate origin chunk to find a valid floor position for the player
  const chunk0 = generateChunk(worldSeed, depth, 0, 0);
  let spawnX = Math.floor(CHUNK_SIZE / 2);
  let spawnY = Math.floor(CHUNK_SIZE / 2);
  if (chunk0.rooms.length > 0) {
    const room = chunk0.rooms[0];
    spawnX = room.x + Math.floor(room.w / 2);
    spawnY = room.y + Math.floor(room.h / 2);
  }

  // Create dungeon state singleton
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed,
    currentDepth: depth,
    playerChunkX: Math.floor(spawnX / CHUNK_SIZE),
    playerChunkY: Math.floor(spawnY / CHUNK_SIZE),
    chunkLoadRadius: 2,
  });

  return { x: spawnX, y: spawnY };
}
