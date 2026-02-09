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
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const cx = Math.floor(xi / CHUNK_SIZE);
  const cy = Math.floor(yi / CHUNK_SIZE);
  const tiles = _chunks.get(_key(cx, cy));
  if (!tiles) return TILE_VOID;
  const lx = xi - cx * CHUNK_SIZE;
  const ly = yi - cy * CHUNK_SIZE;
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
  if (x1 < x0) { const t = x0; x0 = x1; x1 = t; }
  if (y1 < y0) { const t = y0; y0 = y1; y1 = t; }

  const ix0 = Math.floor(x0);
  const iy0 = Math.floor(y0);
  const ix1 = Math.floor(x1);
  const iy1 = Math.floor(y1);

  const cx0 = Math.floor(ix0 / CHUNK_SIZE);
  const cy0 = Math.floor(iy0 / CHUNK_SIZE);
  const cx1 = Math.floor(ix1 / CHUNK_SIZE);
  const cy1 = Math.floor(iy1 / CHUNK_SIZE);

  for (let cy = cy0; cy <= cy1; cy++) {
    const wy0 = cy * CHUNK_SIZE;
    const ly0 = (cy === cy0) ? (iy0 - cy * CHUNK_SIZE) : 0;
    const ly1 = (cy === cy1) ? (iy1 - cy * CHUNK_SIZE) : (CHUNK_SIZE - 1);

    for (let cx = cx0; cx <= cx1; cx++) {
      const tiles = _chunks.get(_key(cx, cy));
      if (!tiles) continue;

      const wx0 = cx * CHUNK_SIZE;
      const lx0 = (cx === cx0) ? (ix0 - cx * CHUNK_SIZE) : 0;
      const lx1 = (cx === cx1) ? (ix1 - cx * CHUNK_SIZE) : (CHUNK_SIZE - 1);

      for (let ly = ly0; ly <= ly1; ly++) {
        const row = ly * CHUNK_SIZE;
        const wy = wy0 + ly;
        for (let lx = lx0; lx <= lx1; lx++) {
          const tile = tiles[row + lx];
          if (tile !== TILE_VOID) callback(wx0 + lx, wy, tile);
        }
      }
    }
  }
}

/**
 * Iterate every non-void tile across all loaded chunks.
 * @param {(x: number, y: number, tile: number) => void} callback
 */
export function forEachLoadedTile(callback) {
  for (const [key, tiles] of _chunks) {
    const [cxStr, cyStr] = key.split(',');
    const ox = (+cxStr) * CHUNK_SIZE;
    const oy = (+cyStr) * CHUNK_SIZE;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const row = ly * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (tiles[row + lx] !== TILE_VOID) callback(ox + lx, oy + ly, tiles[row + lx]);
      }
    }
  }
}

/** @returns {number} number of loaded chunks */
export function loadedChunkCount() {
  return _chunks.size;
}
