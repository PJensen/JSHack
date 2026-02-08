// rules/systems/chunkManagementSystem.js
// Manages lazy chunk loading/unloading based on player position.

import { Position } from '../components/Position.js';
import { ChunkMeta } from '../components/ChunkMeta.js';
import { DungeonState } from '../components/DungeonState.js';
import { createRng } from '../../lib/ecs-js/rng.js';
import { generateChunk } from '../environment/dungeon/chunk.js';
import { materializeChunk } from '../environment/dungeon/materialize.js';
import { populateChunk } from '../environment/dungeon/populate.js';
import { generateFloorPlan } from '../environment/dungeon/floorPlan.js';
import { chunkSeed } from '../environment/dungeon/seed.js';
import { CHUNK_SIZE, TILE_STAIR_DOWN, TILE_STAIR_UP } from '../environment/dungeon/constants.js';
import { loadChunk as tileMapLoad, unloadChunk as tileMapUnload } from '../environment/dungeon/tileMap.js';
import { createFrom } from '../../lib/ecs-js/archetype.js';
import { StairDown, StairUp } from '../archetypes/Stairs.js';
import { playerEntity } from '../utils/queries.js';

// Cache floor plans per depth to avoid regenerating each tick
const _floorPlans = new Map(); // `${worldSeed}:${depth}` -> FloorPlan

/**
 * @param {import('../../lib/ecs-js').World} world
 */
export function chunkManagementSystem(world) {
  // Find the dungeon state singleton
  let dungeonId = null;
  let ds = null;
  for (const [id, state] of world.query(DungeonState)) {
    dungeonId = id;
    ds = state;
    break;
  }
  if (!ds) return; // no dungeon active

  // Find player position
  const pe = playerEntity(world);
  if (!pe) return;

  const pcx = Math.floor(pe.pos.x / CHUNK_SIZE);
  const pcy = Math.floor(pe.pos.y / CHUNK_SIZE);

  // Update player chunk in state if changed
  if (pcx !== ds.playerChunkX || pcy !== ds.playerChunkY) {
    world.mutate(dungeonId, DungeonState, r => {
      r.playerChunkX = pcx;
      r.playerChunkY = pcy;
    });
  }

  const radius = ds.chunkLoadRadius;
  const depth = ds.currentDepth;
  const worldSeed = ds.worldSeed;

  // Build set of chunks that should be loaded
  const shouldBeLoaded = new Set();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      shouldBeLoaded.add(`${pcx + dx},${pcy + dy}`);
    }
  }

  // Build map of currently loaded chunks
  const loaded = new Map(); // key -> { metaId, meta }
  for (const [metaId, meta] of world.query(ChunkMeta)) {
    loaded.set(`${meta.chunkX},${meta.chunkY}`, { metaId, meta });
  }

  // Load missing chunks
  for (const key of shouldBeLoaded) {
    if (loaded.has(key)) continue;
    const [cx, cy] = key.split(',').map(Number);
    _loadChunk(world, worldSeed, depth, cx, cy);
  }

  // Unload distant chunks (Chebyshev distance to match square load grid)
  const unloadRadius = radius + 1;
  for (const [key, { metaId, meta }] of loaded) {
    const dist = Math.max(Math.abs(meta.chunkX - pcx), Math.abs(meta.chunkY - pcy));
    if (dist > unloadRadius) {
      _unloadChunk(world, metaId, meta);
    }
  }
}

function _getFloorPlan(worldSeed, depth) {
  const key = `${worldSeed}:${depth}`;
  let plan = _floorPlans.get(key);
  if (!plan) {
    plan = generateFloorPlan(worldSeed, depth);
    _floorPlans.set(key, plan);
  }
  return plan;
}

function _loadChunk(world, worldSeed, depth, cx, cy) {
  const chunkData = generateChunk(worldSeed, depth, cx, cy);
  const floorPlan = _getFloorPlan(worldSeed, depth);

  // Place stairs if the floor plan has any in this chunk
  for (const stair of floorPlan.downStairs) {
    if (stair.chunkX === cx && stair.chunkY === cy) {
      const idx = stair.localY * CHUNK_SIZE + stair.localX;
      chunkData.tiles[idx] = TILE_STAIR_DOWN;
    }
  }
  for (const stair of floorPlan.upStairs) {
    if (stair.chunkX === cx && stair.chunkY === cy) {
      const idx = stair.localY * CHUNK_SIZE + stair.localX;
      chunkData.tiles[idx] = TILE_STAIR_UP;
    }
  }

  // Populate chunk with monsters and items
  const popSeed = chunkSeed(worldSeed, depth, cx, cy) ^ 0xDEAD;
  const popRng = createRng(popSeed >>> 0);
  chunkData.spawns = populateChunk(chunkData, floorPlan, popRng);

  // Register tile data in the analytic TileMap (O(1) lookups for systems)
  tileMapLoad(cx, cy, chunkData.tiles);

  // Materialize interactive entities only (doors, stairs, spawns)
  const stairOpts = {
    createStairDown: (w, x, y) => createFrom(w, StairDown, { x, y }),
    createStairUp: (w, x, y) => createFrom(w, StairUp, { x, y }),
  };
  const entityIds = materializeChunk(world, chunkData, stairOpts);

  // Create a ChunkMeta tracker entity
  const metaId = world.create();
  world.add(metaId, ChunkMeta, {
    chunkX: cx,
    chunkY: cy,
    depth,
    entityIds,
    generated: true,
  });
}

function _unloadChunk(world, metaId, meta) {
  // Remove tile data from TileMap
  tileMapUnload(meta.chunkX, meta.chunkY);

  // Destroy all entities belonging to this chunk
  if (Array.isArray(meta.entityIds)) {
    for (const eid of meta.entityIds) {
      try { world.destroy(eid); } catch (_) { /* already destroyed */ }
    }
  }
  // Destroy the meta tracker itself
  try { world.destroy(metaId); } catch (_) { /* already destroyed */ }
}
