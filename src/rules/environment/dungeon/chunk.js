// rules/environment/dungeon/chunk.js
// Orchestrates BSP generation for a single chunk, including door detection
// and cross-chunk edge gates.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from './bsp.js';
import { chunkSeed, edgeSeed } from './seed.js';
import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
} from './constants.js';

/**
 * @typedef {Object} ChunkData
 * @property {number} chunkX
 * @property {number} chunkY
 * @property {number} depth
 * @property {number} seed
 * @property {Uint8Array} tiles        - CHUNK_SIZE * CHUNK_SIZE flat array
 * @property {Array<{x:number,y:number,w:number,h:number}>} rooms - rooms in world coords
 * @property {Array<{x:number,y:number}>} doors  - door positions (world coords)
 * @property {Array<{x:number,y:number,kind:string,params:Object}>} spawns
 */

/**
 * Generate a single chunk's tile data.
 * @param {number} worldSeed
 * @param {number} depth
 * @param {number} chunkX
 * @param {number} chunkY
 * @param {import('./profiles/default.js').DungeonProfile|null} [profile]
 * @returns {ChunkData}
 */
export function generateChunk(worldSeed, depth, chunkX, chunkY, profile = null) {
  const seed = chunkSeed(worldSeed, depth, chunkX, chunkY);
  const rng = createRng(seed);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

  // BSP: build tree, place rooms, carve, connect
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng, profile);
  placeRooms(tree, rng, profile);
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, rng, profile);

  // Post-process: mutate tiles before edge gates are carved.
  // Edge gates always run after, so they are never blocked by post-processing.
  if (profile?.postProcess) profile.postProcess(tiles, rng, CHUNK_SIZE);

  // Collect rooms in world coordinates
  const localRooms = collectLeafRooms(tree);
  const ox = chunkX * CHUNK_SIZE;
  const oy = chunkY * CHUNK_SIZE;
  const rooms = localRooms.map(r => ({
    x: r.x + ox, y: r.y + oy, w: r.w, h: r.h,
  }));

  // Edge gates: carve corridors to chunk edges for cross-chunk connectivity
  _carveEdgeGates(tiles, worldSeed, depth, chunkX, chunkY, localRooms, rng);

  // Detect door positions
  const doorChance = profile?.doorChance ?? 0.6;
  const doors = findDoorPositions(tiles, CHUNK_SIZE, rng, doorChance).map(d => ({
    x: d.x + ox, y: d.y + oy,
  }));

  // Mark doors in the tile array
  for (const d of doors) {
    const lx = d.x - ox, ly = d.y - oy;
    tiles[ly * CHUNK_SIZE + lx] = TILE_DOOR;
  }

  return { chunkX, chunkY, depth, seed, tiles, rooms, doors, spawns: [] };
}

/**
 * Compute the deterministic gate position along a shared edge between two chunks.
 * Returns a position in [2, CHUNK_SIZE-3] along the edge.
 * @param {number} worldSeed
 * @param {number} depth
 * @param {number} cxA
 * @param {number} cyA
 * @param {number} cxB
 * @param {number} cyB
 * @returns {number} position along the shared edge
 */
export function edgeGate(worldSeed, depth, cxA, cyA, cxB, cyB) {
  const seed = edgeSeed(worldSeed, depth, cxA, cyA, cxB, cyB);
  const rng = createRng(seed);
  return 2 + rng.int(0, CHUNK_SIZE - 5);
}

/**
 * Find door candidates: floor tiles with exactly 2 opposing wall/void neighbors.
 * @param {Uint8Array} tiles
 * @param {number} stride
 * @param {Object} rng
 * @param {number} doorChance
 * @returns {Array<{x:number, y:number}>} chunk-local positions
 */
export function findDoorPositions(tiles, stride, rng, doorChance) {
  // Collect all valid candidates first
  const candidates = [];
  for (let y = 1; y < stride - 1; y++) {
    for (let x = 1; x < stride - 1; x++) {
      if (tiles[y * stride + x] !== TILE_FLOOR) continue;

      const n = tiles[(y - 1) * stride + x];
      const s = tiles[(y + 1) * stride + x];
      const e = tiles[y * stride + (x + 1)];
      const w = tiles[y * stride + (x - 1)];

      const isWallOrVoid = t => t === TILE_WALL || t === TILE_VOID;
      const nsWalls = isWallOrVoid(n) && isWallOrVoid(s);
      const ewWalls = isWallOrVoid(e) && isWallOrVoid(w);

      // XOR: exactly one pair of opposing neighbors is wall
      if ((nsWalls && !ewWalls) || (!nsWalls && ewWalls)) {
        if (rng.next() < doorChance) {
          candidates.push({ x, y });
        }
      }
    }
  }

  // Filter out consecutive doors: enforce minimum spacing of 3 tiles
  const MIN_DOOR_SPACING = 3;
  const doors = [];
  for (const c of candidates) {
    let tooClose = false;
    for (const d of doors) {
      if (Math.abs(c.x - d.x) + Math.abs(c.y - d.y) < MIN_DOOR_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) doors.push(c);
  }
  return doors;
}

// --- Edge gate internals ---

/**
 * Carve corridors from the nearest room to each chunk edge gate.
 * Each edge connects to the adjacent chunk's matching gate position.
 */
function _carveEdgeGates(tiles, worldSeed, depth, cx, cy, localRooms, rng) {
  if (localRooms.length === 0) return;

  // 4 neighbors: east, west, north, south
  const neighbors = [
    { dx: 1, dy: 0, edgeX: CHUNK_SIZE - 1, edgeAxis: 'y', ncx: cx + 1, ncy: cy },
    { dx: -1, dy: 0, edgeX: 0, edgeAxis: 'y', ncx: cx - 1, ncy: cy },
    { dx: 0, dy: 1, edgeY: CHUNK_SIZE - 1, edgeAxis: 'x', ncx: cx, ncy: cy + 1 },
    { dx: 0, dy: -1, edgeY: 0, edgeAxis: 'x', ncx: cx, ncy: cy - 1 },
  ];

  for (const nb of neighbors) {
    const gatePos = edgeGate(worldSeed, depth, cx, cy, nb.ncx, nb.ncy);
    let gx, gy;

    if (nb.edgeAxis === 'y') {
      // East or west edge: gate is at (edgeX, gatePos)
      gx = nb.edgeX;
      gy = gatePos;
    } else {
      // North or south edge: gate is at (gatePos, edgeY)
      gx = gatePos;
      gy = nb.edgeY;
    }

    // Find nearest room center to this gate
    let bestRoom = localRooms[0];
    let bestDist = Infinity;
    for (const room of localRooms) {
      const rcx = room.x + Math.floor(room.w / 2);
      const rcy = room.y + Math.floor(room.h / 2);
      const d = Math.abs(rcx - gx) + Math.abs(rcy - gy);
      if (d < bestDist) { bestDist = d; bestRoom = room; }
    }

    // Carve L-shaped corridor from room center to gate
    const rcx = bestRoom.x + Math.floor(bestRoom.w / 2);
    const rcy = bestRoom.y + Math.floor(bestRoom.h / 2);
    _carveCorridor(tiles, CHUNK_SIZE, rcx, rcy, gx, gy);

    // Ensure the gate tile itself is floor
    if (gx >= 0 && gx < CHUNK_SIZE && gy >= 0 && gy < CHUNK_SIZE) {
      tiles[gy * CHUNK_SIZE + gx] = TILE_FLOOR;
    }
  }
}

/**
 * Carve an L-shaped corridor between two points.
 */
function _carveCorridor(tiles, stride, x1, y1, x2, y2) {
  // Horizontal then vertical
  const xLo = Math.min(x1, x2), xHi = Math.max(x1, x2);
  for (let x = xLo; x <= xHi; x++) {
    _setFloor(tiles, stride, x, y1);
    _setWallIfVoid(tiles, stride, x, y1 - 1);
    _setWallIfVoid(tiles, stride, x, y1 + 1);
  }
  const yLo = Math.min(y1, y2), yHi = Math.max(y1, y2);
  for (let y = yLo; y <= yHi; y++) {
    _setFloor(tiles, stride, x2, y);
    _setWallIfVoid(tiles, stride, x2 - 1, y);
    _setWallIfVoid(tiles, stride, x2 + 1, y);
  }
}

function _setFloor(tiles, stride, x, y) {
  if (x < 0 || y < 0 || x >= stride || y >= stride) return;
  tiles[y * stride + x] = TILE_FLOOR;
}

function _setWallIfVoid(tiles, stride, x, y) {
  if (x < 0 || y < 0 || x >= stride || y >= stride) return;
  const idx = y * stride + x;
  if (tiles[idx] === TILE_VOID) tiles[idx] = TILE_WALL;
}
