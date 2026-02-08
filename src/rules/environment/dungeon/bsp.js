// rules/environment/dungeon/bsp.js
// BSP (Binary Space Partition) tree for dungeon room generation.
// Operates on a Uint8Array tile grid — no ECS dependency.

import {
  TILE_VOID, TILE_FLOOR, TILE_WALL,
  MIN_LEAF_SIZE, MIN_ROOM_SIZE, ROOM_MARGIN,
  SPLIT_RATIO_MIN, SPLIT_RATIO_MAX, BSP_MAX_DEPTH,
} from './constants.js';

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
 * @param {number} [depth=0] - current recursion depth
 * @returns {BSPNode}
 */
export function buildBSP(x, y, w, h, rng, depth = 0) {
  const node = { x, y, w, h, left: null, right: null, room: null, splitH: false };

  // Stop splitting if too small or max depth reached
  const canSplitH = h >= 2 * MIN_LEAF_SIZE;
  const canSplitV = w >= 2 * MIN_LEAF_SIZE;

  if (depth >= BSP_MAX_DEPTH || (!canSplitH && !canSplitV)) {
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
  const ratio = rng.float(SPLIT_RATIO_MIN, SPLIT_RATIO_MAX);
  const split = Math.floor(dim * ratio);
  // Clamp: each half must have at least MIN_LEAF_SIZE
  const clamped = Math.max(MIN_LEAF_SIZE, Math.min(dim - MIN_LEAF_SIZE, split));

  if (splitH) {
    node.left  = buildBSP(x, y, w, clamped, rng, depth + 1);
    node.right = buildBSP(x, y + clamped, w, h - clamped, rng, depth + 1);
  } else {
    node.left  = buildBSP(x, y, clamped, h, rng, depth + 1);
    node.right = buildBSP(x + clamped, y, w - clamped, h, rng, depth + 1);
  }

  return node;
}

/**
 * Place a room inside each leaf node. Room is randomly sized and positioned
 * within the leaf bounds, respecting ROOM_MARGIN.
 * @param {BSPNode} node
 * @param {Object} rng
 */
export function placeRooms(node, rng) {
  if (node.left || node.right) {
    // Internal node: recurse
    if (node.left)  placeRooms(node.left, rng);
    if (node.right) placeRooms(node.right, rng);
    return;
  }

  // Leaf: place a room
  const maxW = node.w - 2 * ROOM_MARGIN;
  const maxH = node.h - 2 * ROOM_MARGIN;

  if (maxW < MIN_ROOM_SIZE || maxH < MIN_ROOM_SIZE) return; // too small

  const rw = rng.int(MIN_ROOM_SIZE, maxW);
  const rh = rng.int(MIN_ROOM_SIZE, maxH);

  // Random position within the leaf
  const rx = node.x + ROOM_MARGIN + (maxW > rw ? rng.int(0, maxW - rw) : 0);
  const ry = node.y + ROOM_MARGIN + (maxH > rh ? rng.int(0, maxH - rh) : 0);

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
 */
export function connectRooms(node, tiles, stride, rng) {
  if (!node.left || !node.right) return;

  // Recurse first (bottom-up)
  connectRooms(node.left, tiles, stride, rng);
  connectRooms(node.right, tiles, stride, rng);

  // Find a room in each subtree
  const roomL = _findRoom(node.left);
  const roomR = _findRoom(node.right);
  if (!roomL || !roomR) return;

  // Connect centers with an L-shaped corridor
  const cx1 = roomL.x + Math.floor(roomL.w / 2);
  const cy1 = roomL.y + Math.floor(roomL.h / 2);
  const cx2 = roomR.x + Math.floor(roomR.w / 2);
  const cy2 = roomR.y + Math.floor(roomR.h / 2);

  // Randomly choose horizontal-first or vertical-first
  if (rng.next() < 0.5) {
    _carveCorridorH(tiles, stride, cx1, cy1, cx2, cy1); // horizontal
    _carveCorridorV(tiles, stride, cx2, cy1, cx2, cy2); // vertical
  } else {
    _carveCorridorV(tiles, stride, cx1, cy1, cx1, cy2); // vertical
    _carveCorridorH(tiles, stride, cx1, cy2, cx2, cy2); // horizontal
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
 * Sets floor tiles and adds wall borders above and below.
 */
function _carveCorridorH(tiles, stride, x1, y, x2, _y) {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  for (let x = lo; x <= hi; x++) {
    _setFloor(tiles, stride, x, y);
    // Walls above and below
    _setWallIfVoid(tiles, stride, x, y - 1);
    _setWallIfVoid(tiles, stride, x, y + 1);
  }
}

/**
 * Carve a vertical corridor from (x,y1) to (x,y2).
 * Sets floor tiles and adds wall borders left and right.
 */
function _carveCorridorV(tiles, stride, x, y1, _x, y2) {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  for (let y = lo; y <= hi; y++) {
    _setFloor(tiles, stride, x, y);
    // Walls left and right
    _setWallIfVoid(tiles, stride, x - 1, y);
    _setWallIfVoid(tiles, stride, x + 1, y);
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
