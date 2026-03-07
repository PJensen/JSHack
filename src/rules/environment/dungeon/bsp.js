// rules/environment/dungeon/bsp.js
// BSP (Binary Space Partition) tree for dungeon room generation.
// Operates on a Uint8Array tile grid — no ECS dependency.

import { TILE_VOID, TILE_FLOOR, TILE_WALL } from './constants.js';

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

  if (node.left || node.right) {
    // Internal node: recurse
    if (node.left)  placeRooms(node.left, rng, profile);
    if (node.right) placeRooms(node.right, rng, profile);
    return;
  }

  // Leaf: place a room
  const maxW = node.w - 2 * roomMargin;
  const maxH = node.h - 2 * roomMargin;

  if (maxW < minRoomSize || maxH < minRoomSize) return; // too small

  const rw = rng.int(minRoomSize, Math.min(maxW, maxRoomSize));
  const rh = rng.int(minRoomSize, Math.min(maxH, maxRoomSize));

  // Random position within the leaf
  const rx = node.x + roomMargin + (maxW > rw ? rng.int(0, maxW - rw) : 0);
  const ry = node.y + roomMargin + (maxH > rh ? rng.int(0, maxH - rh) : 0);

  node.room = { x: rx, y: ry, w: rw, h: rh };
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
  const { x, y, w, h } = node.room;

  // Perimeter walls (only if currently VOID — don't overwrite existing floors)
  for (let py = y - 1; py <= y + h; py++) {
    for (let px = x - 1; px <= x + w; px++) {
      if (px < 0 || py < 0 || px >= stride || py >= stride) continue;
      const idx = py * stride + px;
      const isEdge = (px === x - 1 || px === x + w || py === y - 1 || py === y + h);
      if (isEdge) {
        if (tiles[idx] === TILE_VOID) tiles[idx] = TILE_WALL;
      } else {
        tiles[idx] = TILE_FLOOR;
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

/**
 * Carve a horizontal corridor from (x1,y) to (x2,y).
 * width=1: single tile row. width=2: two tile rows (y and y+1).
 */
function _carveCorridorH(tiles, stride, x1, y, x2, width = 1) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  for (let x = lo; x <= hi; x++) {
    _setFloor(tiles, stride, x, y);
    _setWallIfVoid(tiles, stride, x, y - 1);
    if (width >= 2) {
      _setFloor(tiles, stride, x, y + 1);
      _setWallIfVoid(tiles, stride, x, y + 2);
    } else {
      _setWallIfVoid(tiles, stride, x, y + 1);
    }
  }
}

/**
 * Carve a vertical corridor from (x,y1) to (x,y2).
 * width=1: single tile column. width=2: two tile columns (x and x+1).
 */
function _carveCorridorV(tiles, stride, x, y1, y2, width = 1) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  for (let y = lo; y <= hi; y++) {
    _setFloor(tiles, stride, x, y);
    _setWallIfVoid(tiles, stride, x - 1, y);
    if (width >= 2) {
      _setFloor(tiles, stride, x + 1, y);
      _setWallIfVoid(tiles, stride, x + 2, y);
    } else {
      _setWallIfVoid(tiles, stride, x + 1, y);
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
