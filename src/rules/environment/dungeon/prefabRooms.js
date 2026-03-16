// rules/environment/dungeon/prefabRooms.js
// Load prefab room definitions and stamp them into dungeon chunks.

import boulderPuzzleDef from "../../data/rooms/room_boulder_puzzle.json" with { type: "json" };
import lavaDeadEndDef from "../../data/rooms/room_lava_puzzle_dead_end.json" with { type: "json" };
import {
  TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR, TILE_LAVA,
} from './constants.js';

const TILE_MAP = { floor: TILE_FLOOR, wall: TILE_WALL, door: TILE_DOOR, lava: TILE_LAVA };

const PREFAB_REGISTRY = {
  room_boulder_puzzle: boulderPuzzleDef,
  room_lava_puzzle_dead_end: lavaDeadEndDef,
};

/**
 * Load a prefab room definition by ID.
 * @param {string} roomId
 * @returns {object|null}
 */
export function loadPrefabRoom(roomId) {
  return PREFAB_REGISTRY[roomId] ?? null;
}

/**
 * Stamp a prefab room into a chunk's tile array, replacing one BSP room.
 * Connects entrance/exit waypoints to the existing corridor network.
 *
 * @param {Uint8Array} tiles       - chunk tile array (CHUNK_SIZE²)
 * @param {Array<{x:number,y:number,w:number,h:number}>} localRooms - chunk-local room rects
 * @param {object} roomDef         - parsed room JSON
 * @param {number} stride          - CHUNK_SIZE
 * @returns {{targetIdx: number, anchorX: number, anchorY: number}|null}
 *   Info about the replaced room, or null if no suitable room found.
 */
export function stampPrefabInChunk(tiles, localRooms, roomDef, stride) {
  const bounds = getPrefabBounds(roomDef);
  const floorBounds = getPrefabFloorBounds(roomDef);
  const prefabWidth = bounds.maxDx - bounds.minDx + 1;
  const prefabHeight = bounds.maxDy - bounds.minDy + 1;

  // Prefer a BSP room large enough to host the prefab footprint.
  // If none exists, fall back to the largest room in the chunk and let the
  // prefab overwrite surrounding BSP geometry. Larger authored set pieces
  // should still be viable even when they exceed the local room envelope.
  let bestIdx = -1;
  let bestArea = 0;
  let largestIdx = -1;
  let largestArea = 0;
  for (let i = 0; i < localRooms.length; i++) {
    const r = localRooms[i];
    const a = r.w * r.h;
    if (a > largestArea) { largestArea = a; largestIdx = i; }
    if (r.w >= prefabWidth - 2 && r.h >= prefabHeight - 2) {
      if (a > bestArea) { bestArea = a; bestIdx = i; }
    }
  }
  if (bestIdx < 0) bestIdx = largestIdx;
  if (bestIdx < 0) return null;

  const target = localRooms[bestIdx];
  const cx = target.x + Math.floor(target.w / 2);
  const cy = target.y + Math.floor(target.h / 2);

  // Center the prefab bounding box on the BSP room center, then clamp to the chunk.
  const centerDx = (bounds.minDx + bounds.maxDx) / 2;
  const centerDy = (bounds.minDy + bounds.maxDy) / 2;
  let anchorX = Math.round(cx - centerDx);
  let anchorY = Math.round(cy - centerDy);
  anchorX = Math.max(-bounds.minDx, Math.min(stride - 1 - bounds.maxDx, anchorX));
  anchorY = Math.max(-bounds.minDy, Math.min(stride - 1 - bounds.maxDy, anchorY));

  // --- Stamp tiles ---
  for (const { dx, dy, tile } of roomDef.tiles) {
    const lx = anchorX + dx;
    const ly = anchorY + dy;
    if (lx < 0 || ly < 0 || lx >= stride || ly >= stride) continue;
    const tileId = TILE_MAP[tile];
    if (tileId !== undefined) tiles[ly * stride + lx] = tileId;
  }

  // --- Remove any doors that ended up inside the prefab bounding rect ---
  const minX = anchorX + bounds.minDx, maxX = anchorX + bounds.maxDx;
  const minY = anchorY + bounds.minDy, maxY = anchorY + bounds.maxDy;
  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (px < 0 || py < 0 || px >= stride || py >= stride) continue;
      if (tiles[py * stride + px] === TILE_DOOR) {
        tiles[py * stride + px] = TILE_FLOOR;
      }
    }
  }

  // --- Connect waypoints to corridor network ---
  if (roomDef.waypoints) {
    for (const wp of roomDef.waypoints) {
      if (!_isConnectorWaypoint(wp)) continue;
      const wx = anchorX + wp.dx;
      const wy = anchorY + wp.dy;
      _connectWaypoint(tiles, wx, wy, wp.dx, wp.dy, stride);
    }
  }

  // --- Update the room entry ---
  const floorX = anchorX + floorBounds.minDx;
  const floorY = anchorY + floorBounds.minDy;
  localRooms[bestIdx] = {
    x: floorX,
    y: floorY,
    w: floorBounds.maxDx - floorBounds.minDx + 1,
    h: floorBounds.maxDy - floorBounds.minDy + 1,
    prefab: true,
    prefabAnchorX: anchorX,
    prefabAnchorY: anchorY,
    prefabSpawns: (roomDef.spawns || []).map(s => ({
      dx: s.dx, dy: s.dy,
      kind: s.kind,
      params: s.params || {},
    })),
  };

  return { targetIdx: bestIdx, anchorX, anchorY };
}

/**
 * Connect a waypoint opening to the nearest existing floor tile by scanning
 * outward in the facing direction, then carving a corridor.
 */
function _connectWaypoint(tiles, wx, wy, dx, dy, stride) {
  // Determine facing direction from the waypoint's position on the prefab boundary.
  let dirX = 0, dirY = 0;
  if (dx === 0)  dirX = 1;   // rightmost column → face east
  if (dx === -(/* roomDef.width - 1 */ 5)) dirX = -1; // leftmost → face west
  if (dy === 0)  dirY = 1;   // bottom row → face south
  if (dy === -5) dirY = -1;  // top row → face north

  // If facing direction couldn't be determined, skip
  if (dirX === 0 && dirY === 0) return;

  // Scan outward for existing TILE_FLOOR
  let found = false;
  for (let dist = 1; dist <= 12; dist++) {
    const sx = wx + dirX * dist;
    const sy = wy + dirY * dist;
    if (sx < 0 || sy < 0 || sx >= stride || sy >= stride) break;
    if (tiles[sy * stride + sx] === TILE_FLOOR) {
      // Carve corridor from waypoint to this tile
      _carveLinear(tiles, stride, wx, wy, sx, sy);
      found = true;
      break;
    }
  }

  if (!found) {
    // No floor found — carve straight to chunk edge so edge gates can connect.
    const edgeX = dirX > 0 ? stride - 1 : dirX < 0 ? 0 : wx;
    const edgeY = dirY > 0 ? stride - 1 : dirY < 0 ? 0 : wy;
    _carveLinear(tiles, stride, wx, wy, edgeX, edgeY);
  }
}

function _isConnectorWaypoint(wp) {
  if (!wp || typeof wp !== "object") return false;
  if (wp.connect === true) return true;
  const name = String(wp.name || "");
  return name === "entrance" || name === "exit";
}

function getPrefabBounds(roomDef) {
  let minDx = Infinity;
  let minDy = Infinity;
  let maxDx = -Infinity;
  let maxDy = -Infinity;
  for (const tile of roomDef.tiles || []) {
    minDx = Math.min(minDx, tile.dx);
    minDy = Math.min(minDy, tile.dy);
    maxDx = Math.max(maxDx, tile.dx);
    maxDy = Math.max(maxDy, tile.dy);
  }
  if (!Number.isFinite(minDx)) return { minDx: 0, minDy: 0, maxDx: 0, maxDy: 0 };
  return { minDx, minDy, maxDx, maxDy };
}

function getPrefabFloorBounds(roomDef) {
  let minDx = Infinity;
  let minDy = Infinity;
  let maxDx = -Infinity;
  let maxDy = -Infinity;
  for (const tile of roomDef.tiles || []) {
    if (tile.tile !== "floor") continue;
    minDx = Math.min(minDx, tile.dx);
    minDy = Math.min(minDy, tile.dy);
    maxDx = Math.max(maxDx, tile.dx);
    maxDy = Math.max(maxDy, tile.dy);
  }
  if (!Number.isFinite(minDx)) return getPrefabBounds(roomDef);
  return { minDx, minDy, maxDx, maxDy };
}


/**
 * Carve an L-shaped corridor between two points with wall borders.
 * Horizontal first, then vertical (consistent with chunk.js).
 */
function _carveLinear(tiles, stride, x1, y1, x2, y2) {
  // Horizontal segment
  const xLo = Math.min(x1, x2), xHi = Math.max(x1, x2);
  for (let x = xLo; x <= xHi; x++) {
    _setFloor(tiles, stride, x, y1);
    _setWallIfVoid(tiles, stride, x, y1 - 1);
    _setWallIfVoid(tiles, stride, x, y1 + 1);
  }
  // Vertical segment
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
