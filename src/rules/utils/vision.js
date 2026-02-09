// rules/utils/vision.js
// ECS-aware vision query helpers.

import { Position } from '../components/Position.js';
import { Collider } from '../components/Collider.js';
import { isOpaque } from '../environment/dungeon/tileMap.js';
import { CHUNK_SIZE } from '../environment/dungeon/constants.js';
import { forEachInRect } from './spatialIndex.js';

/**
 * Build a chunked mask of tiles that block vision (doors, etc.).
 * Walls are handled by TileMap.isOpaque() — this only covers Collider.blocksSight.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {Map<string, Uint8Array>}
 */
export function buildBlocksVisionMap(world, bounds = null) {
  const blocked = new Map();
  if (bounds && typeof bounds === 'object') {
    const { x0, y0, x1, y1 } = bounds;
    forEachInRect(world, x0, y0, x1, y1, (id, pos) => {
      const col = world.get(id, Collider);
      if (col && col.blocksSight) _set(blocked, pos.x, pos.y);
    });
    return blocked;
  }
  for (const [id, pos, col] of world.query(Position, Collider)) {
    if (col && col.blocksSight) _set(blocked, pos.x, pos.y);
  }
  return blocked;
}

/**
 * Returns an isBlocked callback suitable for hasLOS / computeFOV.
 * Composes TileMap opacity (walls) with entity-based blocksSight (closed doors).
 * @param {Map<string, Uint8Array>} blockedMap
 * @returns {(x:number, y:number) => boolean}
 */
export function blockedCallback(blockedMap) {
  return (x, y) => isOpaque(x, y) || _has(blockedMap, x, y);
}

function _key(cx, cy) { return `${cx},${cy}`; }

function _getChunk(map, cx, cy, create) {
  const key = _key(cx, cy);
  let chunk = map.get(key);
  if (!chunk && create) {
    chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    map.set(key, chunk);
  }
  return chunk;
}

function _set(map, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
  const chunk = _getChunk(map, cx, cy, true);
  chunk[ly * CHUNK_SIZE + lx] = 1;
}

function _has(map, x, y) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const lx = x - cx * CHUNK_SIZE;
  const ly = y - cy * CHUNK_SIZE;
  if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return false;
  const chunk = _getChunk(map, cx, cy, false);
  return !!(chunk && chunk[ly * CHUNK_SIZE + lx]);
}
