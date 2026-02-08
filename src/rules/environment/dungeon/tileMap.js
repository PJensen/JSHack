// rules/environment/dungeon/tileMap.js
// Singleton analytic tile grid backed by loaded chunk Uint8Arrays.
// Systems query this directly for walkability/opacity instead of iterating ECS entities.

import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
  TILE_STAIR_DOWN, TILE_STAIR_UP,
} from './constants.js';

// chunk key: "cx,cy" -> Uint8Array (the chunk.tiles reference)
const _chunks = new Map();

// Precomputed walkability per tile type (indexed by TILE_* constants)
const _walkable = new Uint8Array(6);
_walkable[TILE_FLOOR]      = 1;
_walkable[TILE_DOOR]       = 1; // floor underneath; door entity Collider overrides
_walkable[TILE_STAIR_DOWN] = 1;
_walkable[TILE_STAIR_UP]   = 1;

// Precomputed opacity per tile type
const _opaque = new Uint8Array(6);
_opaque[TILE_WALL] = 1;

/** @param {number} cx @param {number} cy */
function _key(cx, cy) { return `${cx},${cy}`; }

/**
 * Register a chunk's tile data.
 * @param {number} cx
 * @param {number} cy
 * @param {Uint8Array} tiles
 */
export function loadChunk(cx, cy, tiles) {
  _chunks.set(_key(cx, cy), tiles);
}

/**
 * Remove a chunk's tile data.
 * @param {number} cx
 * @param {number} cy
 */
export function unloadChunk(cx, cy) {
  _chunks.delete(_key(cx, cy));
}

/** Remove all chunk data (for depth transitions). */
export function clearAll() {
  _chunks.clear();
}

/**
 * Get the tile type at world coordinates.
 * @param {number} x
 * @param {number} y
 * @returns {number} tile type constant (TILE_VOID if unloaded)
 */
export function getTile(x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const tiles = _chunks.get(_key(cx, cy));
  if (!tiles) return TILE_VOID;
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  return tiles[ly * CHUNK_SIZE + lx];
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isWalkable(x, y) {
  return _walkable[getTile(x, y)] === 1;
}

/**
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isOpaque(x, y) {
  return _opaque[getTile(x, y)] === 1;
}

/**
 * Iterate all non-void tiles within a rectangle (inclusive bounds).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {(x: number, y: number, tile: number) => void} callback
 */
export function forEachTileInRect(x0, y0, x1, y1, callback) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = getTile(x, y);
      if (tile !== TILE_VOID) {
        callback(x, y, tile);
      }
    }
  }
}

/** @returns {number} number of loaded chunks */
export function loadedChunkCount() {
  return _chunks.size;
}
