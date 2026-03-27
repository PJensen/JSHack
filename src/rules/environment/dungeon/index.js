// rules/environment/dungeon/index.js
// Public API for the BSP dungeon generator.
// Floors are generated in one shot — no per-tick chunk management.

export {
  CHUNK_SIZE,
  TILE_VOID,
  TILE_FLOOR,
  TILE_WALL,
  TILE_DOOR,
  TILE_STAIR_DOWN,
  TILE_STAIR_UP,
  TILE_GRASS,
  TILE_WATER,
  TILE_MOUNTAIN,
  TILE_TREE,
} from './constants.js';
export { chunkSeed, floorSeed, edgeSeed } from './seed.js';
export { generateChunk, edgeGate, findDoorPositions } from './chunk.js';
export { materializeChunk } from './materialize.js';
export { generateFloorPlan, stairWorldPos } from './floorPlan.js';
export { transitionToDepth } from './transition.js';
export { populateChunk, materializeSpawn, reconcileShopDoorAccess } from './populate.js';
export { pickMonster, pickItem } from './tables.js';
export { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from './bsp.js';
export { loadChunk, unloadChunk, clearAll, getTile, isWalkable, isFlyable, isOpaque, isRoofed, setRoofed, forEachTileInRect, forEachLoadedTile, loadedChunkCount } from './tileMap.js';
export { markExplored } from './exploredMap.js';

import { DungeonState } from '../../components/DungeonState.js';
import { generateChunk } from './chunk.js';
import { materializeChunk } from './materialize.js';
import { populateChunk, reconcileShopDoorAccess } from './populate.js';
import { generateFloorPlan } from './floorPlan.js';
import { chunkSeed } from './seed.js';
import { createRng } from '../../../lib/ecs-js/rng.js';
import { createFrom } from '../../../lib/ecs-js/archetype.js';
import { StairDown, StairUp } from '../../archetypes/Stairs.js';
import { CHUNK_SIZE, TILE_VOID, TILE_WALL, TILE_FLOOR, TILE_STAIR_DOWN, TILE_STAIR_UP } from './constants.js';
import { loadChunk as tileMapLoad, clearAll as clearTileMap } from './tileMap.js';
import { clearExplored } from './exploredMap.js';
import { clearPerceptionMemory } from './perceptionMemory.js';
import { ensureCalendarState } from '../../utils/calendarState.js';
import { clearSpatialIndex } from '../../utils/spatialIndex.js';
import { generateOverworldChunks } from './overworld.js';
import { WeatherState } from '../../components/WeatherState.js';
import { getCachedHighscores } from '../../../shared/tombstoneApi.js';

/**
 * Generate all chunks for a floor and materialize everything at once.
 * Returns entity IDs created for bulk cleanup on transition.
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {number} worldSeed
 * @param {number} depth
 * @param {Object} [tombstoneRepo] - Tombstone repository for placing tombstones
 * @param {(progress: { phase: 'chunks', depth: number, processed: number, total: number, cx?: number, cy?: number }) => void} [onProgress]
 * @param {{x:number,y:number}[]|null} [priorDownStairPositions]
 *   Actual world positions of down-stairs on the floor above; passed to
 *   generateFloorPlan so up-stairs inherit those exact positions.
 * @returns {{ spawnX: number, spawnY: number, entityIds: number[], downStairPositions: {x:number,y:number}[], profileType: string }}
 */
export function generateFloor(world, worldSeed, depth, tombstoneRepo = null, onProgress = null, priorDownStairPositions = null, opts = {}) {
  if (depth === 0) {
    const ow = generateOverworldChunks(worldSeed);

    // Church graveyard epitaph source priority:
    // 1) Pin top 5 global highscores in rank order to the five church graves.
    // 2) If globals are shallow/missing, top up remaining graves from local tombstones.
    if (tombstoneRepo) {
      const graveSpawns = [];
      for (const chunkData of ow.chunks) {
        const chunkSpawns = Array.isArray(chunkData?.spawns) ? chunkData.spawns : [];
        for (const spawn of chunkSpawns) {
          if (spawn?.kind === 'grave_tombstone') graveSpawns.push(spawn);
        }
      }

      if (graveSpawns.length > 0) {
        // Deterministic slot order: south row left→right, then north row left→right.
        graveSpawns.sort((a, b) => {
          const ay = Number(a?.y || 0) | 0;
          const by = Number(b?.y || 0) | 0;
          if (ay !== by) return by - ay;
          const ax = Number(a?.x || 0) | 0;
          const bx = Number(b?.x || 0) | 0;
          return ax - bx;
        });

        const graveRng = createRng(((worldSeed >>> 0) ^ 0x47524156) >>> 0);
        const records = [];

        const highscores = getCachedHighscores();
        const maxGlobalPinned = Math.min(5, graveSpawns.length);
        if (Array.isArray(highscores) && highscores.length > 0) {
          const top = highscores.slice(0, maxGlobalPinned);
          for (let i = 0; i < top.length; i++) {
            const entry = top[i];
            records.push({
              id: `church_global_rank_${i + 1}`,
              depth: 0,
              cause: 'highscore',
              killerName: null,
              killerIdentity: null,
              timestamp: 0,
              turn: 0,
              playerName: String(entry?.playerName || 'Hero'),
              className: String(entry?.className || ''),
              score: Math.max(0, Number(entry?.score || 0) | 0),
              rank: i + 1,
            });
          }
        }

        if (records.length < graveSpawns.length) {
          const fallbackPool = Array.isArray(tombstoneRepo.getAll?.()) ? tombstoneRepo.getAll() : [];
          const shuffled = [...fallbackPool];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(graveRng.next() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          for (const rec of shuffled) {
            if (records.length >= graveSpawns.length) break;
            const duplicate = records.some((r) => String(r?.id || '') === String(rec?.id || ''));
            if (!duplicate) records.push(rec);
          }
        }

        for (let i = 0; i < graveSpawns.length; i++) {
          const data = records[i] || null;
          const spawn = graveSpawns[i];
          spawn.params = { ...(spawn.params || {}) };
          if (data) spawn.params.tombstoneData = data;
        }
      }
    }

    const totalChunks = ow.chunks.length;
    let processedChunks = 0;

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'chunks', depth, processed: 0, total: totalChunks });
    }

    const stairOpts = {
      createStairDown: (w, x, y) => createFrom(w, StairDown, { x, y }),
      createStairUp: (w, x, y) => createFrom(w, StairUp, { x, y }),
    };

    const allEntityIds = [];
    for (const chunkData of ow.chunks) {
      tileMapLoad(chunkData.chunkX, chunkData.chunkY, chunkData.tiles);
      const ids = materializeChunk(world, chunkData, stairOpts);
      allEntityIds.push(...ids);
      processedChunks++;
      if (typeof onProgress === 'function') {
        onProgress({
          phase: 'chunks',
          depth,
          processed: processedChunks,
          total: totalChunks,
          cx: chunkData.chunkX,
          cy: chunkData.chunkY,
        });
      }
    }

    reconcileShopDoorAccess(world);

    const downStairPositions = [];
    for (const chunkData of ow.chunks) {
      const ox = chunkData.chunkX * CHUNK_SIZE, oy = chunkData.chunkY * CHUNK_SIZE;
      for (let i = 0; i < chunkData.tiles.length; i++) {
        if (chunkData.tiles[i] === TILE_STAIR_DOWN) {
          downStairPositions.push({ x: ox + (i % CHUNK_SIZE), y: oy + Math.floor(i / CHUNK_SIZE) });
        }
      }
    }
    return { spawnX: ow.spawnX, spawnY: ow.spawnY, entityIds: allEntityIds, downStairPositions, profileType: 'overworld' };
  }

  const floorPlan = generateFloorPlan(worldSeed, depth, priorDownStairPositions, opts);
  const { extent } = floorPlan;
  const allEntityIds = [];
  const downStairPositions = [];
  // Track how many down-stairs have already been placed per chunk so multiple stairs
  // in the same chunk are snapped to successive rooms (from the end of the room list).
  const _downPlacedPerChunk = new Map();
  const totalChunks = Math.max(
    0,
    (extent.maxCX - extent.minCX + 1) * (extent.maxCY - extent.minCY + 1),
  );
  let processedChunks = 0;

  if (typeof onProgress === 'function') {
    onProgress({ phase: 'chunks', depth, processed: 0, total: totalChunks });
  }

  const stairOpts = {
    createStairDown: (w, x, y) => createFrom(w, StairDown, { x, y }),
    createStairUp: (w, x, y) => createFrom(w, StairUp, { x, y }),
  };

  let spawnX = Math.floor(CHUNK_SIZE / 2);
  let spawnY = Math.floor(CHUNK_SIZE / 2);

  for (let cy = extent.minCY; cy <= extent.maxCY; cy++) {
    for (let cx = extent.minCX; cx <= extent.maxCX; cx++) {
      const chunkData = generateChunk(worldSeed, depth, cx, cy, floorPlan.profile, floorPlan);

      // Place stairs inside actual rooms (not at random positions that may be void).
      // Multiple down-stairs in the same chunk snap to successive rooms from the end
      // of the room list so each stair occupies a distinct room.
      for (const stair of floorPlan.downStairs) {
        if (stair.chunkX === cx && stair.chunkY === cy && chunkData.rooms.length > 0) {
          const key = `${cx},${cy}`;
          const placed = _downPlacedPerChunk.get(key) ?? 0;
          const roomIdx = Math.max(0, chunkData.rooms.length - 1 - placed);
          const room = chunkData.rooms[roomIdx];
          const lx = (room.x - cx * CHUNK_SIZE) + Math.floor(room.w / 2);
          const ly = (room.y - cy * CHUNK_SIZE) + Math.floor(room.h / 2);
          chunkData.tiles[ly * CHUNK_SIZE + lx] = TILE_STAIR_DOWN;
          downStairPositions.push({ x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly });
          _downPlacedPerChunk.set(key, placed + 1);
        }
      }
      for (const stair of floorPlan.upStairs) {
        if (stair.chunkX === cx && stair.chunkY === cy) {
          let lx, ly;
          if (stair.forced) {
            // Inherited position from the down-stair on the floor above.
            lx = stair.localX;
            ly = stair.localY;
            const centerTile = chunkData.tiles[ly * CHUNK_SIZE + lx];
            // Always make the stair tile itself walkable.
            chunkData.tiles[ly * CHUNK_SIZE + lx] = TILE_FLOOR;
            if ((centerTile === TILE_VOID || centerTile === TILE_WALL) && chunkData.rooms.length > 0) {
              // Stair landed in uncarved space or inside a wall — connect it to the
              // nearest room with an L-shaped corridor so the player can always
              // navigate off it.  We only add walls beside void segments (never punch
              // through existing room walls).
              let nearRoom = chunkData.rooms[0];
              let nearDist = Infinity;
              for (const r of chunkData.rooms) {
                const rcx = r.x - cx * CHUNK_SIZE + Math.floor(r.w / 2);
                const rcy = r.y - cy * CHUNK_SIZE + Math.floor(r.h / 2);
                const d = Math.abs(rcx - lx) + Math.abs(rcy - ly);
                if (d < nearDist) { nearDist = d; nearRoom = r; }
              }
              const rcx = nearRoom.x - cx * CHUNK_SIZE + Math.floor(nearRoom.w / 2);
              const rcy = nearRoom.y - cy * CHUNK_SIZE + Math.floor(nearRoom.h / 2);
              // Horizontal then vertical.
              const xLo = Math.min(lx, rcx), xHi = Math.max(lx, rcx);
              for (let x = xLo; x <= xHi; x++) {
                chunkData.tiles[ly * CHUNK_SIZE + x] = TILE_FLOOR;
                if (ly > 0 && chunkData.tiles[(ly - 1) * CHUNK_SIZE + x] === TILE_VOID)
                  chunkData.tiles[(ly - 1) * CHUNK_SIZE + x] = TILE_WALL;
                if (ly < CHUNK_SIZE - 1 && chunkData.tiles[(ly + 1) * CHUNK_SIZE + x] === TILE_VOID)
                  chunkData.tiles[(ly + 1) * CHUNK_SIZE + x] = TILE_WALL;
              }
              const yLo = Math.min(ly, rcy), yHi = Math.max(ly, rcy);
              for (let y = yLo; y <= yHi; y++) {
                chunkData.tiles[y * CHUNK_SIZE + rcx] = TILE_FLOOR;
                if (rcx > 0 && chunkData.tiles[y * CHUNK_SIZE + rcx - 1] === TILE_VOID)
                  chunkData.tiles[y * CHUNK_SIZE + rcx - 1] = TILE_WALL;
                if (rcx < CHUNK_SIZE - 1 && chunkData.tiles[y * CHUNK_SIZE + rcx + 1] === TILE_VOID)
                  chunkData.tiles[y * CHUNK_SIZE + rcx + 1] = TILE_WALL;
              }
            }
            // TILE_FLOOR / TILE_DOOR center: stair sits cleanly inside an existing room or corridor.
          } else if (chunkData.rooms.length > 0) {
            const room = chunkData.rooms[0];
            lx = (room.x - cx * CHUNK_SIZE) + Math.floor(room.w / 2);
            ly = (room.y - cy * CHUNK_SIZE) + Math.floor(room.h / 2);
          } else {
            continue;
          }
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

      processedChunks++;
      if (typeof onProgress === 'function') {
        onProgress({
          phase: 'chunks',
          depth,
          processed: processedChunks,
          total: totalChunks,
          cx,
          cy,
        });
      }
    }
  }

  return { spawnX, spawnY, entityIds: allEntityIds, downStairPositions, profileType: floorPlan.profile.id || 'default' };
}

/**
 * Initialize the dungeon system on a world.
 * Creates the DungeonState singleton and generates the first floor.
 *
 * @param {import('../../../lib/ecs-js/index.js').World} world
 * @param {Object} [opts]
 * @param {number} [opts.startDepth=1]
 * @param {Object} [opts.tombstoneRepo] - Tombstone repository for placing tombstones
 * @param {(progress: { phase: 'chunks', depth: number, processed: number, total: number, cx?: number, cy?: number }) => void} [opts.onProgress]
 * @returns {{ x: number, y: number }} spawn position for the player
 */
export function initDungeon(world, opts = {}) {
  const depthArg = Number(opts.startDepth);
  const depth = Number.isFinite(depthArg) ? Math.max(0, Math.floor(depthArg)) : 1;
  const worldSeed = world.seed >>> 0;
  const tombstoneRepo = opts.tombstoneRepo || null;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;

  clearTileMap();
  clearExplored();
  clearPerceptionMemory();
  clearSpatialIndex(world);

  const { spawnX, spawnY, entityIds, downStairPositions, profileType } = generateFloor(world, worldSeed, depth, tombstoneRepo, onProgress, null, { dungeonType: opts.dungeonType ?? null });

  // Create dungeon state singleton
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed,
    currentDepth: depth,
    profileType: profileType || 'default',
    floorEntityIds: entityIds,
    downStairPositions: downStairPositions || [],
  });
  ensureCalendarState(world);

  // Create weather singleton for overworld
  if (depth === 0) {
    const wsId = world.create();
    world.add(wsId, WeatherState, {
      current: "clear",
      turnsRemaining: 60 + Math.floor((worldSeed & 0xff) * 0.4),
      transitionCooldown: 0,
    });
  }

  return { x: spawnX, y: spawnY };
}
