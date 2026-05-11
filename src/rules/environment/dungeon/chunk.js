// rules/environment/dungeon/chunk.js
// Orchestrates BSP generation for a single chunk, including door detection
// and cross-chunk edge gates.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from './bsp.js';
import { chunkSeed, edgeSeed } from './seed.js';
import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
} from './constants.js';
import { loadPrefabRoom, stampPrefabInChunk } from './prefabRooms.js';
import { manhattanScalar } from '../../utils/distance.js';

/**
 * @typedef {Object} ChunkData
 * @property {number} chunkX
 * @property {number} chunkY
 * @property {number} depth
 * @property {number} seed
 * @property {Uint8Array} tiles        - CHUNK_SIZE * CHUNK_SIZE flat array
 * @property {Array<{x:number,y:number,w:number,h:number}>} rooms - rooms in world coords
 * @property {Array<{x:number,y:number}>} doors  - door positions (world coords)
 * @property {Array<{x:number,y:number,fromRoomId:string,toRoomId:string,difficulty:number,hintKind:string}>} secretDoors
 * @property {Array<{x:number,y:number,kind:string,params:Object}>} spawns
 */

/**
 * Generate a single chunk's tile data.
 * @param {number} worldSeed
 * @param {number} depth
 * @param {number} chunkX
 * @param {number} chunkY
 * @param {import('./profiles/default.js').DungeonProfile|null} [profile]
 * @param {import('./floorPlan.js').FloorPlan|null} [floorPlan]
 * @returns {ChunkData}
 */
export function generateChunk(worldSeed, depth, chunkX, chunkY, profile = null, floorPlan = null) {
  const seed = chunkSeed(worldSeed, depth, chunkX, chunkY);
  const rng = createRng(seed);
  const isDisconnectedPocketChunk = !!floorPlan?.disconnectedPocket
    && floorPlan.disconnectedPocket.chunkX === chunkX
    && floorPlan.disconnectedPocket.chunkY === chunkY;

  let tiles;
  let localRooms; // chunk-local coords; offset to world coords below

  if (isDisconnectedPocketChunk) {
    tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    localRooms = [];
  } else if (profile?.generator) {
    // Custom generator bypasses BSP entirely.
    // Returns { tiles, rooms } where rooms is chunk-local and synthesised for
    // stair / edge-gate placement (the noise field is the real floor area).
    const result = profile.generator(seed, chunkX, chunkY, CHUNK_SIZE);
    tiles      = result.tiles;
    localRooms = result.rooms;
  } else {
    // Standard BSP pipeline
    tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng, profile);
    placeRooms(tree, rng, profile);
    carveRooms(tree, tiles, CHUNK_SIZE);
    connectRooms(tree, tiles, CHUNK_SIZE, rng, profile);
    localRooms = collectLeafRooms(tree);
  }

  // Post-process: mutate tiles before edge gates are carved.
  // Edge gates always run after, so they are never blocked by post-processing.
  if (profile?.postProcess) profile.postProcess(tiles, rng, CHUNK_SIZE);

  // Collect rooms in world coordinates
  const ox = chunkX * CHUNK_SIZE;
  const oy = chunkY * CHUNK_SIZE;
  const rooms = localRooms.map(r => ({
    x: r.x + ox, y: r.y + oy, w: r.w, h: r.h,
  }));

  // Edge gates: carve corridors to chunk edges for cross-chunk connectivity
  _carveEdgeGates(tiles, worldSeed, depth, chunkX, chunkY, localRooms, rng, floorPlan);

  const doors = [];

  // --- Prefab room overlay (post-BSP) ---
  // Check if the floor plan designates a prefab room for this chunk.
  if (floorPlan?.prefabRooms) {
    for (const pr of floorPlan.prefabRooms) {
      if (pr.chunkX !== chunkX || pr.chunkY !== chunkY) continue;
      const roomDef = loadPrefabRoom(pr.roomId);
      if (!roomDef) continue;
      const result = stampPrefabInChunk(tiles, localRooms, roomDef, CHUNK_SIZE);
      if (result) {
        // Rebuild the world-coord room entry for the replaced room.
        const r = localRooms[result.targetIdx];
        rooms[result.targetIdx] = {
          x: r.x + ox, y: r.y + oy, w: r.w, h: r.h,
          prefab: true,
          prefabSpawns: (r.prefabSpawns || []).map(s => ({
            x: result.anchorX + s.dx + ox,
            y: result.anchorY + s.dy + oy,
            kind: s.kind,
            params: s.params || {},
          })),
        };
        // Remove any world-coord doors that fall inside the prefab area.
        const pMinX = result.anchorX - 5 + ox;
        const pMaxX = result.anchorX + ox;
        const pMinY = result.anchorY - 5 + oy;
        const pMaxY = result.anchorY + oy;
        for (let di = doors.length - 1; di >= 0; di--) {
          const d = doors[di];
          if (d.x >= pMinX && d.x <= pMaxX && d.y >= pMinY && d.y <= pMaxY) {
            doors.splice(di, 1);
          }
        }
      }
    }
  }

  if (floorPlan?.extent) {
    _sealExternalEdges(tiles, chunkX, chunkY, floorPlan.extent);
  }

  _ensureConnectedWalkable(tiles, worldSeed, depth, chunkX, chunkY);
  const isolatedPocket = _carveLevelOnePocket(tiles, depth, chunkX, chunkY, floorPlan);
  if (isolatedPocket) {
    rooms.push({
      x: isolatedPocket.x + ox,
      y: isolatedPocket.y + oy,
      w: isolatedPocket.w,
      h: isolatedPocket.h,
      isolated: true,
    });
  }
  sanitizeDoorTiles(tiles, CHUNK_SIZE);

  const secretDoors = _addSecretLeafDoors(tiles, rooms, worldSeed, depth, chunkX, chunkY, rng, floorPlan);

  // Detect door positions after the final floor geometry is settled so doors
  // cannot preserve stale metadata from pre-connectivity/pre-prefab layouts.
  const doorChance = profile?.doorChance ?? 0.6;
  const doorPositions = findDoorPositions(tiles, CHUNK_SIZE, rng, doorChance);
  for (const d of doorPositions) {
    doors.push({ x: d.x + ox, y: d.y + oy });
    tiles[d.y * CHUNK_SIZE + d.x] = TILE_DOOR;
  }

  return { chunkX, chunkY, depth, seed, tiles, rooms, doors, secretDoors, spawns: [] };
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
  const isWalkable = t => t === TILE_FLOOR || t === TILE_DOOR;

  /** @type {Array<Array<{x:number,y:number}>>} */
  const groups = [];
  const paired = new Set();

  // Collect double-door candidates first so they win over single doors.
  for (let y = 1; y < stride - 2; y++) {
    for (let x = 1; x < stride - 1; x++) {
      // Vertical pair: two stacked doors at (x,y) and (x,y+1)
      if (
        tiles[y * stride + x] === TILE_FLOOR &&
        tiles[(y + 1) * stride + x] === TILE_FLOOR &&
        tiles[(y - 1) * stride + x] === TILE_WALL &&
        tiles[(y + 2) * stride + x] === TILE_WALL &&
        isWalkable(tiles[y * stride + (x - 1)]) &&
        isWalkable(tiles[y * stride + (x + 1)]) &&
        isWalkable(tiles[(y + 1) * stride + (x - 1)]) &&
        isWalkable(tiles[(y + 1) * stride + (x + 1)])
      ) {
        const k1 = `${x},${y}`;
        const k2 = `${x},${y + 1}`;
        if (!paired.has(k1) && !paired.has(k2) && rng.next() < doorChance) {
          groups.push([{ x, y }, { x, y: y + 1 }]);
          paired.add(k1);
          paired.add(k2);
        }
      }
    }
  }

  for (let y = 1; y < stride - 1; y++) {
    for (let x = 1; x < stride - 2; x++) {
      // Horizontal pair: two side-by-side doors at (x,y) and (x+1,y)
      if (
        tiles[y * stride + x] === TILE_FLOOR &&
        tiles[y * stride + (x + 1)] === TILE_FLOOR &&
        tiles[y * stride + (x - 1)] === TILE_WALL &&
        tiles[y * stride + (x + 2)] === TILE_WALL &&
        isWalkable(tiles[(y - 1) * stride + x]) &&
        isWalkable(tiles[(y + 1) * stride + x]) &&
        isWalkable(tiles[(y - 1) * stride + (x + 1)]) &&
        isWalkable(tiles[(y + 1) * stride + (x + 1)])
      ) {
        const k1 = `${x},${y}`;
        const k2 = `${x + 1},${y}`;
        if (!paired.has(k1) && !paired.has(k2) && rng.next() < doorChance) {
          groups.push([{ x, y }, { x: x + 1, y }]);
          paired.add(k1);
          paired.add(k2);
        }
      }
    }
  }

  // Collect single-door candidates.
  const candidates = [];
  for (let y = 1; y < stride - 1; y++) {
    for (let x = 1; x < stride - 1; x++) {
      if (tiles[y * stride + x] !== TILE_FLOOR) continue;
      if (paired.has(`${x},${y}`)) continue;

      const n = tiles[(y - 1) * stride + x];
      const s = tiles[(y + 1) * stride + x];
      const e = tiles[y * stride + (x + 1)];
      const w = tiles[y * stride + (x - 1)];

      const isWall = t => t === TILE_WALL;
      const nsWalls = isWall(n) && isWall(s);
      const ewWalls = isWall(e) && isWall(w);
      const nsWalk = isWalkable(n) && isWalkable(s);
      const ewWalk = isWalkable(e) && isWalkable(w);

      // Single-tile chokepoint only: one axis walls, opposite axis walkable.
      // This avoids "floating" doors in wider hall geometry.
      if ((nsWalls && ewWalk) || (ewWalls && nsWalk)) {
        if (rng.next() < doorChance) {
          candidates.push([{ x, y }]);
        }
      }
    }
  }
  groups.push(...candidates);

  // Filter out consecutive doors: enforce minimum spacing of 3 tiles.
  // Double doors are treated as one group and accepted/rejected together.
  const MIN_DOOR_SPACING = 3;
  const doors = [];
  for (const group of groups) {
    let tooClose = false;
    for (const c of group) {
      for (const d of doors) {
        if (manhattanScalar(c.x, c.y, d.x, d.y) < MIN_DOOR_SPACING) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) break;
    }
    if (!tooClose) doors.push(...group);
  }
  return doors;
}

/**
 * Door frame validator shared by chunk post-processing and tests.
 * Valid doors must be a single pinch-point frame or part of a proper
 * two-tile double-door frame.
 * @param {Uint8Array} tiles
 * @param {number} stride
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isDoorFrameAt(tiles, stride, x, y) {
  if (x <= 0 || y <= 0 || x >= stride - 1 || y >= stride - 1) return false;
  if (tiles[y * stride + x] !== TILE_DOOR) return false;

  const n = tiles[(y - 1) * stride + x];
  const s = tiles[(y + 1) * stride + x];
  const e = tiles[y * stride + (x + 1)];
  const w = tiles[y * stride + (x - 1)];
  const nsWalls = (n === TILE_WALL) && (s === TILE_WALL);
  const ewWalls = (e === TILE_WALL) && (w === TILE_WALL);
  const singlePinch = nsWalls !== ewWalls;
  if (singlePinch) return true;

  const doorUp = n === TILE_DOOR;
  const doorDown = s === TILE_DOOR;
  const doorLeft = w === TILE_DOOR;
  const doorRight = e === TILE_DOOR;

  const verticalDouble = (doorUp || doorDown)
    && tiles[Math.max(0, y - 2) * stride + x] === TILE_WALL
    && tiles[Math.min(stride - 1, y + 2) * stride + x] === TILE_WALL;
  if (verticalDouble) return true;

  const horizontalDouble = (doorLeft || doorRight)
    && tiles[y * stride + Math.max(0, x - 2)] === TILE_WALL
    && tiles[y * stride + Math.min(stride - 1, x + 2)] === TILE_WALL;
  if (horizontalDouble) return true;

  return false;
}

/**
 * Remove structurally invalid pre-authored doors (e.g. floating doors left by
 * room overlays) so materialization cannot spawn door entities in open space.
 * @param {Uint8Array} tiles
 * @param {number} stride
 */
export function sanitizeDoorTiles(tiles, stride) {
  for (let y = 0; y < stride; y++) {
    for (let x = 0; x < stride; x++) {
      if (tiles[y * stride + x] !== TILE_DOOR) continue;
      if (isDoorFrameAt(tiles, stride, x, y)) continue;
      tiles[y * stride + x] = TILE_FLOOR;
    }
  }
}

const SECRET_DOOR_HINTS = Object.freeze(["draft", "scratch", "hollow", "moss", "warmth"]);

function _addSecretLeafDoors(tiles, rooms, worldSeed, depth, chunkX, chunkY, rng, floorPlan = null) {
  if (!Array.isArray(rooms) || rooms.length < 3) return [];
  if (floorPlan?.disconnectedPocket?.chunkX === chunkX && floorPlan.disconnectedPocket?.chunkY === chunkY) return [];

  const ox = chunkX * CHUNK_SIZE;
  const oy = chunkY * CHUNK_SIZE;
  const stairRoomCount = (floorPlan?.downStairs || []).filter(s => s.chunkX === chunkX && s.chunkY === chunkY).length;
  const hasUpStair = (floorPlan?.upStairs || []).some(s => s.chunkX === chunkX && s.chunkY === chunkY);
  const protectedRoomIndices = new Set();
  if (chunkX === 0 && chunkY === 0) protectedRoomIndices.add(0);
  if (hasUpStair) protectedRoomIndices.add(0);
  for (let i = 0; i < stairRoomCount; i++) {
    protectedRoomIndices.add(Math.max(0, rooms.length - 1 - i));
  }
  for (const stair of floorPlan?.upStairs || []) {
    if (stair.chunkX !== chunkX || stair.chunkY !== chunkY || !stair.forced) continue;
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (let i = 0; i < rooms.length; i++) {
      if (_roomContainsLocal(rooms[i], ox, oy, stair.localX, stair.localY)) {
        protectedRoomIndices.add(i);
      }
      const rcx = rooms[i].x - ox + Math.floor(rooms[i].w / 2);
      const rcy = rooms[i].y - oy + Math.floor(rooms[i].h / 2);
      const dist = manhattanScalar(rcx, rcy, stair.localX, stair.localY);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }
    if (nearestIndex >= 0) protectedRoomIndices.add(nearestIndex);
  }

  const candidates = [];
  for (let i = 0; i < rooms.length; i++) {
    if (protectedRoomIndices.has(i)) continue;
    const room = rooms[i];
    if (room.prefab || room.isolated) continue;
    const opening = _findSingleRoomOpening(tiles, room, ox, oy);
    if (!opening) continue;
    const area = Math.max(1, room.w * room.h);
    const depthScore = manhattanScalar(
      room.x + Math.floor(room.w / 2),
      room.y + Math.floor(room.h / 2),
      ox + Math.floor(CHUNK_SIZE / 2),
      oy + Math.floor(CHUNK_SIZE / 2),
    );
    candidates.push({ room, roomIndex: i, opening, interestScore: area + depthScore });
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => b.interestScore - a.interestScore);

  const maxSecrets = (depth <= 0) ? 0 : 1;
  const secretDoors = [];
  for (const candidate of candidates) {
    if (secretDoors.length >= maxSecrets) break;
    // A mild deterministic gate keeps the mechanic present without hiding every
    // terminal room on dense chunks.
    if (secretDoors.length === 0 && candidates.length > 1 && rng.next() >= 0.65) continue;

    const { x, y } = candidate.opening;
    tiles[y * CHUNK_SIZE + x] = TILE_WALL;
    const worldX = ox + x;
    const worldY = oy + y;
    const hintIndex = Math.abs((worldSeed + depth * 17 + worldX * 31 + worldY * 43) | 0) % SECRET_DOOR_HINTS.length;
    candidate.room.secret = true;
    candidate.room.interestScore = candidate.interestScore;
    secretDoors.push({
      x: worldX,
      y: worldY,
      fromRoomId: `chunk:${chunkX},${chunkY}:main`,
      toRoomId: `chunk:${chunkX},${chunkY}:room:${candidate.roomIndex}`,
      difficulty: Math.max(1, Math.min(20, 6 + Math.floor(candidate.interestScore / 8))),
      hintKind: SECRET_DOOR_HINTS[hintIndex],
    });
  }

  return secretDoors;
}

function _roomContainsLocal(room, ox, oy, lx, ly) {
  const rx = room.x - ox;
  const ry = room.y - oy;
  return lx >= rx && lx < rx + room.w && ly >= ry && ly < ry + room.h;
}

function _findSingleRoomOpening(tiles, room, ox, oy) {
  const rx = room.x - ox;
  const ry = room.y - oy;
  const rw = room.w;
  const rh = room.h;
  const openings = [];

  function maybeOpening(roomX, roomY, outX, outY) {
    if (outX < 1 || outY < 1 || outX >= CHUNK_SIZE - 1 || outY >= CHUNK_SIZE - 1) return;
    if (!_isWalkableTile(tiles[roomY * CHUNK_SIZE + roomX])) return;
    if (!_isWalkableTile(tiles[outY * CHUNK_SIZE + outX])) return;
    openings.push({ x: outX, y: outY });
  }

  for (let y = ry; y < ry + rh; y++) {
    maybeOpening(rx, y, rx - 1, y);
    maybeOpening(rx + rw - 1, y, rx + rw, y);
  }
  for (let x = rx; x < rx + rw; x++) {
    maybeOpening(x, ry, x, ry - 1);
    maybeOpening(x, ry + rh - 1, x, ry + rh);
  }

  const unique = [];
  const seen = new Set();
  for (const opening of openings) {
    const key = `${opening.x},${opening.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(opening);
  }
  return unique.length === 1 ? unique[0] : null;
}

// --- Edge gate internals ---

/**
 * Carve corridors from the nearest room to each chunk edge gate.
 * Each edge connects to the adjacent chunk's matching gate position.
 */
function _carveEdgeGates(tiles, worldSeed, depth, cx, cy, localRooms, rng, floorPlan = null) {
  const disconnectedPocket = floorPlan?.disconnectedPocket || null;
  const chunkIsDisconnectedPocket = !!disconnectedPocket
    && disconnectedPocket.chunkX === cx
    && disconnectedPocket.chunkY === cy;
  if (chunkIsDisconnectedPocket) return;
  if (localRooms.length === 0) return;

  // 4 neighbors: east, west, north, south
  const neighbors = [
    { dx: 1, dy: 0, edgeX: CHUNK_SIZE - 1, edgeAxis: 'y', ncx: cx + 1, ncy: cy },
    { dx: -1, dy: 0, edgeX: 0, edgeAxis: 'y', ncx: cx - 1, ncy: cy },
    { dx: 0, dy: 1, edgeY: CHUNK_SIZE - 1, edgeAxis: 'x', ncx: cx, ncy: cy + 1 },
    { dx: 0, dy: -1, edgeY: 0, edgeAxis: 'x', ncx: cx, ncy: cy - 1 },
  ];

  for (const nb of neighbors) {
    if (floorPlan?.extent) {
      const { minCX, maxCX, minCY, maxCY } = floorPlan.extent;
      if (nb.ncx < minCX || nb.ncx > maxCX || nb.ncy < minCY || nb.ncy > maxCY) {
        continue;
      }
    }
    if (disconnectedPocket && disconnectedPocket.chunkX === nb.ncx && disconnectedPocket.chunkY === nb.ncy) {
      continue;
    }

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
      const d = manhattanScalar(rcx, rcy, gx, gy);
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
  const corridorTiles = [];
  const xLo = Math.min(x1, x2), xHi = Math.max(x1, x2);
  for (let x = xLo; x <= xHi; x++) {
    corridorTiles.push([x, y1]);
  }
  const yLo = Math.min(y1, y2), yHi = Math.max(y1, y2);
  for (let y = yLo; y <= yHi; y++) {
    corridorTiles.push([x2, y]);
  }

  for (const [x, y] of corridorTiles) {
    _setFloor(tiles, stride, x, y);
  }
  for (const [x, y] of corridorTiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        _setWallIfVoid(tiles, stride, x + dx, y + dy);
      }
    }
  }
}

function _ensureConnectedWalkable(tiles, worldSeed, depth, chunkX, chunkY) {
  while (true) {
    const components = _collectWalkableComponents(tiles);
    if (components.length <= 1) return;

    components.sort((a, b) => b.length - a.length);
    const main = components[0];
    let bestPair = null;
    let bestDistance = Infinity;

    for (const component of components.slice(1)) {
      for (const a of main) {
        for (const b of component) {
          const distance = manhattanScalar(a.x, a.y, b.x, b.y);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestPair = { from: a, to: b };
          }
        }
      }
    }

    if (!bestPair) return;
    _carveCorridor(
      tiles,
      CHUNK_SIZE,
      bestPair.from.x,
      bestPair.from.y,
      bestPair.to.x,
      bestPair.to.y,
    );
  }
}

function _carveLevelOnePocket(tiles, depth, chunkX, chunkY, floorPlan = null) {
  const target = floorPlan?.disconnectedPocket;
  if (
    depth !== 1
    || !target
    || target.chunkX !== chunkX
    || target.chunkY !== chunkY
  ) return null;

  const candidates = [
    { x: Math.floor(CHUNK_SIZE / 2) - 2, y: Math.floor(CHUNK_SIZE / 2) - 2, w: 4, h: 4 },
    { x: 2, y: 2, w: 4, h: 4 },
    { x: CHUNK_SIZE - 6, y: 2, w: 4, h: 4 },
    { x: 2, y: CHUNK_SIZE - 6, w: 4, h: 4 },
    { x: CHUNK_SIZE - 6, y: CHUNK_SIZE - 6, w: 4, h: 4 },
  ];

  for (const room of candidates) {
    if (!_canPlaceDisconnectedPocket(tiles, room)) continue;
    _paintDisconnectedPocket(tiles, room);
    return room;
  }

  return null;
}

function _canPlaceDisconnectedPocket(tiles, room) {
  const minX = room.x - 1;
  const maxX = room.x + room.w;
  const minY = room.y - 1;
  const maxY = room.y + room.h;

  if (minX < 1 || minY < 1 || maxX >= CHUNK_SIZE - 1 || maxY >= CHUNK_SIZE - 1) {
    return false;
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (_isWalkableTile(tiles[y * CHUNK_SIZE + x])) return false;
    }
  }

  return true;
}

function _paintDisconnectedPocket(tiles, room) {
  const minX = room.x - 1;
  const maxX = room.x + room.w;
  const minY = room.y - 1;
  const maxY = room.y + room.h;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const isInterior = x >= room.x
        && x < room.x + room.w
        && y >= room.y
        && y < room.y + room.h;
      tiles[y * CHUNK_SIZE + x] = isInterior ? TILE_FLOOR : TILE_WALL;
    }
  }
}

function _sealExternalEdges(tiles, chunkX, chunkY, extent) {
  const onMinX = chunkX === extent.minCX;
  const onMaxX = chunkX === extent.maxCX;
  const onMinY = chunkY === extent.minCY;
  const onMaxY = chunkY === extent.maxCY;

  if (onMinX) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y * CHUNK_SIZE + 0] = TILE_WALL;
    }
  }
  if (onMaxX) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      tiles[y * CHUNK_SIZE + (CHUNK_SIZE - 1)] = TILE_WALL;
    }
  }
  if (onMinY) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      tiles[x] = TILE_WALL;
    }
  }
  if (onMaxY) {
    const row = (CHUNK_SIZE - 1) * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) {
      tiles[row + x] = TILE_WALL;
    }
  }
}

function _collectWalkableComponents(tiles) {
  const visited = new Set();
  const components = [];

  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const idx = y * CHUNK_SIZE + x;
      if (!_isWalkableTile(tiles[idx])) continue;
      const startKey = `${x},${y}`;
      if (visited.has(startKey)) continue;

      const component = [];
      const queue = [{ x, y }];
      visited.add(startKey);

      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          if (nx < 0 || ny < 0 || nx >= CHUNK_SIZE || ny >= CHUNK_SIZE) continue;
          const nIdx = ny * CHUNK_SIZE + nx;
          if (!_isWalkableTile(tiles[nIdx])) continue;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }

      components.push(component);
    }
  }

  return components;
}

function _isWalkableTile(tile) {
  return tile === TILE_FLOOR || tile === TILE_DOOR;
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
