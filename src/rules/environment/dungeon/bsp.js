// rules/environment/dungeon/bsp.js
// BSP (Binary Space Partition) tree for dungeon room generation.
// Operates on a Uint8Array tile grid — no ECS dependency.

import { TILE_VOID, TILE_FLOOR, TILE_WALL } from './constants.js';
import { dungeonConfig } from './dungeonConfig.js';

// Fallback BSP parameters used when no profile is provided.
// These mirror the values previously imported from constants.js.
const _DEF_BSP_MAX_DEPTH   = 5;
const _DEF_MIN_LEAF_SIZE   = 5;
const _DEF_MIN_ROOM_SIZE   = 3;
const _DEF_MAX_ROOM_SIZE   = 7;
const _DEF_ROOM_MARGIN     = 1;
const _DEF_SPLIT_RATIO_MIN = 0.40;
const _DEF_SPLIT_RATIO_MAX = 0.60;

/**
 * @typedef {Object} BSPNode
 * @property {number} x      - Left edge (chunk-local)
 * @property {number} y      - Top edge (chunk-local)
 * @property {number} w      - Width
 * @property {number} h      - Height
 * @property {BSPNode|null} left
 * @property {BSPNode|null} right
 * @property {{x:number, y:number, w:number, h:number}|null} room
 * @property {boolean} splitH - true = horizontal split (top/bottom)
 */

/**
 * Recursively partition a rectangle into a BSP tree.
 * @param {number} x - left edge (chunk-local)
 * @param {number} y - top edge (chunk-local)
 * @param {number} w - width
 * @param {number} h - height
 * @param {Object} rng - createRng() instance (needs .next(), .float(), .int())
 * @param {import('./profiles/default.js').DungeonProfile|null} [profile]
 * @param {number} [_recursionDepth=0] - internal recursion counter; do not pass externally
 * @returns {BSPNode}
 */
export function buildBSP(x, y, w, h, rng, profile = null, _recursionDepth = 0) {
  const minLeafSize   = profile?.minLeafSize   ?? _DEF_MIN_LEAF_SIZE;
  const bspMaxDepth   = profile?.bspMaxDepth   ?? _DEF_BSP_MAX_DEPTH;
  const splitRatioMin = profile?.splitRatioMin ?? _DEF_SPLIT_RATIO_MIN;
  const splitRatioMax = profile?.splitRatioMax ?? _DEF_SPLIT_RATIO_MAX;

  const node = { x, y, w, h, left: null, right: null, room: null, splitH: false };

  // Stop splitting if too small or max depth reached
  const canSplitH = h >= 2 * minLeafSize;
  const canSplitV = w >= 2 * minLeafSize;

  if (_recursionDepth >= bspMaxDepth || (!canSplitH && !canSplitV)) {
    return node; // leaf
  }

  // Choose split direction: prefer the longer dimension
  let splitH;
  if (canSplitH && canSplitV) {
    if (w > h * 1.25)      splitH = false; // split vertically (wide)
    else if (h > w * 1.25) splitH = true;  // split horizontally (tall)
    else                    splitH = rng.next() < 0.5;
  } else {
    splitH = canSplitH;
  }

  node.splitH = splitH;

  // Pick split position
  const dim = splitH ? h : w;
  const ratio = rng.float(splitRatioMin, splitRatioMax);
  const split = Math.floor(dim * ratio);
  // Clamp: each half must have at least minLeafSize
  const clamped = Math.max(minLeafSize, Math.min(dim - minLeafSize, split));

  if (splitH) {
    node.left  = buildBSP(x, y, w, clamped, rng, profile, _recursionDepth + 1);
    node.right = buildBSP(x, y + clamped, w, h - clamped, rng, profile, _recursionDepth + 1);
  } else {
    node.left  = buildBSP(x, y, clamped, h, rng, profile, _recursionDepth + 1);
    node.right = buildBSP(x + clamped, y, w - clamped, h, rng, profile, _recursionDepth + 1);
  }

  return node;
}

/**
 * Place a room inside each leaf node. Room is randomly sized and positioned
 * within the leaf bounds, respecting roomMargin from the profile.
 * @param {BSPNode} node
 * @param {Object} rng
 * @param {import('./profiles/default.js').DungeonProfile|null} [profile]
 */
export function placeRooms(node, rng, profile = null) {
  const minRoomSize = profile?.minRoomSize ?? _DEF_MIN_ROOM_SIZE;
  const maxRoomSize = profile?.maxRoomSize ?? _DEF_MAX_ROOM_SIZE;
  const roomMargin  = profile?.roomMargin  ?? _DEF_ROOM_MARGIN;
  const configuredSparsity = profile?.roomSparsity ?? dungeonConfig.roomSparsity ?? 0;
  const roomSparsity = Math.max(0, Math.min(1, configuredSparsity));

  const leaves = [];
  _collectLeaves(node, leaves);

  const eligibleLeaves = leaves.filter(leaf => {
    const maxW = leaf.w - 2 * roomMargin;
    const maxH = leaf.h - 2 * roomMargin;
    return maxW >= minRoomSize && maxH >= minRoomSize;
  });
  if (eligibleLeaves.length === 0) return;

  const keepRatio = 1 - roomSparsity;
  const minimumRooms = eligibleLeaves.length >= 2 ? 2 : 1;
  const keepCount = Math.max(
    minimumRooms,
    Math.min(eligibleLeaves.length, Math.round(eligibleLeaves.length * keepRatio)),
  );

  const chosenLeaves = _pickLeafSubset(eligibleLeaves, keepCount, rng);
  for (const leaf of chosenLeaves) {
    _placeRoomInLeaf(leaf, rng, minRoomSize, maxRoomSize, roomMargin, profile);
  }
}

/**
 * Carve rooms into the tile array: floors inside, walls on perimeter.
 * @param {BSPNode} node
 * @param {Uint8Array} tiles - CHUNK_SIZE * CHUNK_SIZE flat array
 * @param {number} stride - tiles per row (CHUNK_SIZE)
 */
export function carveRooms(node, tiles, stride) {
  if (node.left)  carveRooms(node.left, tiles, stride);
  if (node.right) carveRooms(node.right, tiles, stride);

  if (!node.room) return;
  const { x, y, w, h, shape } = node.room;

  // Perimeter walls (only if currently VOID — don't overwrite existing floors)
  for (let py = y - 1; py <= y + h; py++) {
    for (let px = x - 1; px <= x + w; px++) {
      if (px < 0 || py < 0 || px >= stride || py >= stride) continue;
      const idx = py * stride + px;
      const isEdge = (px === x - 1 || px === x + w || py === y - 1 || py === y + h);
      if (isEdge) {
        if (tiles[idx] === TILE_VOID) tiles[idx] = TILE_WALL;
      } else {
        if (_shouldCarveRoomTile(px, py, { x, y, w, h, shape })) {
          tiles[idx] = TILE_FLOOR;
        } else if (tiles[idx] === TILE_VOID) {
          // Seal jagged notches as walls so floor remains enclosed.
          tiles[idx] = TILE_WALL;
        }
      }
    }
  }
}

/**
 * Connect sibling subtrees with L-shaped corridors. Walks the BSP tree
 * bottom-up; for each internal node, connects the closest rooms in
 * left and right children.
 * @param {BSPNode} node
 * @param {Uint8Array} tiles
 * @param {number} stride
 * @param {Object} rng
 * @param {import('./profiles/default.js').DungeonProfile|null} [profile]
 */
export function connectRooms(node, tiles, stride, rng, profile = null) {
  if (!node.left || !node.right) return;

  // Recurse first (bottom-up)
  connectRooms(node.left, tiles, stride, rng, profile);
  connectRooms(node.right, tiles, stride, rng, profile);

  // Find a room in each subtree
  const roomL = _findRoom(node.left);
  const roomR = _findRoom(node.right);
  if (!roomL || !roomR) return;

  // Connect centers with an L-shaped corridor
  const cx1 = roomL.x + Math.floor(roomL.w / 2);
  const cy1 = roomL.y + Math.floor(roomL.h / 2);
  const cx2 = roomR.x + Math.floor(roomR.w / 2);
  const cy2 = roomR.y + Math.floor(roomR.h / 2);

  const corridorWidth = profile?.corridorWidth ?? 1;

  // Randomly choose horizontal-first or vertical-first
  if (rng.next() < 0.5) {
    _carveCorridorH(tiles, stride, cx1, cy1, cx2, corridorWidth);
    _carveCorridorV(tiles, stride, cx2, cy1, cy2, corridorWidth);
  } else {
    _carveCorridorV(tiles, stride, cx1, cy1, cy2, corridorWidth);
    _carveCorridorH(tiles, stride, cx1, cy2, cx2, corridorWidth);
  }
}

/**
 * Collect all rooms from leaf nodes.
 * @param {BSPNode} node
 * @returns {Array<{x:number, y:number, w:number, h:number}>}
 */
export function collectLeafRooms(node) {
  const rooms = [];
  _collectRooms(node, rooms);
  return rooms;
}

// --- internals ---

function _findRoom(node) {
  if (node.room) return node.room;
  // Try left first, then right
  if (node.left) {
    const r = _findRoom(node.left);
    if (r) return r;
  }
  if (node.right) {
    const r = _findRoom(node.right);
    if (r) return r;
  }
  return null;
}

function _collectRooms(node, out) {
  if (node.room) out.push(node.room);
  if (node.left) _collectRooms(node.left, out);
  if (node.right) _collectRooms(node.right, out);
}

function _collectLeaves(node, out) {
  if (!node.left && !node.right) {
    out.push(node);
    return;
  }
  if (node.left) _collectLeaves(node.left, out);
  if (node.right) _collectLeaves(node.right, out);
}

function _pickLeafSubset(leaves, keepCount, rng) {
  const pool = leaves.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, keepCount);
}

function _weightedInt(rng, min, max, bias = 1) {
  if (max <= min) return min;
  const t = Math.pow(rng.next(), 1 / Math.max(0.1, bias));
  return min + Math.floor(t * (max - min + 1));
}

function _pickRoomShape(profile, rng) {
  const weights = profile?.roomShapeWeights;
  if (!weights) return 'rect';

  const rect = Math.max(0, Number(weights.rect ?? 0));
  const square = Math.max(0, Number(weights.square ?? 0));
  const jagged = Math.max(0, Number(weights.jagged ?? 0));
  const total = rect + square + jagged;
  if (total <= 0) return 'rect';

  const pick = rng.next() * total;
  if (pick < rect) return 'rect';
  if (pick < rect + square) return 'square';
  return 'jagged';
}

function _shouldCarveRoomTile(px, py, room) {
  if (room.shape !== 'jagged') return true;
  const edge = (px === room.x || px === room.x + room.w - 1 || py === room.y || py === room.y + room.h - 1);
  if (!edge) return true;

  const cx = room.x + Math.floor(room.w / 2);
  const cy = room.y + Math.floor(room.h / 2);
  if (px === cx || py === cy) return true;

  const h = _hash2d(px, py, room.x, room.y, room.w, room.h);
  return (h % 6) !== 0;
}

function _hash2d(a, b, c, d, e, f) {
  let x = ((a | 0) * 1103515245) ^ ((b | 0) * 12345);
  x ^= ((c | 0) * 2654435761) >>> 0;
  x ^= ((d | 0) * 2246822519) >>> 0;
  x ^= ((e | 0) * 3266489917) >>> 0;
  x ^= ((f | 0) * 668265263) >>> 0;
  return x >>> 0;
}

function _placeRoomInLeaf(node, rng, minRoomSize, maxRoomSize, roomMargin, profile = null) {
  const maxW = node.w - 2 * roomMargin;
  const maxH = node.h - 2 * roomMargin;
  if (maxW < minRoomSize || maxH < minRoomSize) return;

  const roomSizeBias = Math.max(0.1, Number(profile?.roomSizeBias ?? 1));
  const shape = _pickRoomShape(profile, rng);
  const widthHi = Math.min(maxW, maxRoomSize);
  const heightHi = Math.min(maxH, maxRoomSize);

  let rw;
  let rh;
  if (shape === 'square') {
    const sideHi = Math.min(widthHi, heightHi);
    const side = _weightedInt(rng, minRoomSize, sideHi, roomSizeBias);
    rw = side;
    rh = side;
  } else {
    rw = _weightedInt(rng, minRoomSize, widthHi, roomSizeBias);
    rh = _weightedInt(rng, minRoomSize, heightHi, roomSizeBias);
  }

  const rx = node.x + roomMargin + (maxW > rw ? rng.int(0, maxW - rw) : 0);
  const ry = node.y + roomMargin + (maxH > rh ? rng.int(0, maxH - rh) : 0);
  node.room = { x: rx, y: ry, w: rw, h: rh, shape };
}

/**
 * Carve a horizontal corridor from (x1,y) to (x2,y).
 * width=1: single tile row. width=2: two tile rows (y and y+1).
 */
function _carveCorridorH(tiles, stride, x1, y, x2, width = 1) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const corridorTiles = [];
  for (let x = lo; x <= hi; x++) {
    corridorTiles.push([x, y]);
    if (width >= 2) corridorTiles.push([x, y + 1]);
  }
  _paintCorridor(tiles, stride, corridorTiles);
}

/**
 * Carve a vertical corridor from (x,y1) to (x,y2).
 * width=1: single tile column. width=2: two tile columns (x and x+1).
 */
function _carveCorridorV(tiles, stride, x, y1, y2, width = 1) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  const corridorTiles = [];
  for (let y = lo; y <= hi; y++) {
    corridorTiles.push([x, y]);
    if (width >= 2) corridorTiles.push([x + 1, y]);
  }
  _paintCorridor(tiles, stride, corridorTiles);
}

function _paintCorridor(tiles, stride, corridorTiles) {
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

function _setFloor(tiles, stride, x, y) {
  if (x < 0 || y < 0 || x >= stride || y >= stride) return;
  tiles[y * stride + x] = TILE_FLOOR;
}

function _setWallIfVoid(tiles, stride, x, y) {
  if (x < 0 || y < 0 || x >= stride || y >= stride) return;
  const idx = y * stride + x;
  if (tiles[idx] === TILE_VOID) tiles[idx] = TILE_WALL;
}
