// rules/environment/dungeon/floorPlan.js
// Per-depth metadata: stair positions, theme, difficulty.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { floorSeed } from './seed.js';
import { CHUNK_SIZE } from './constants.js';

/**
 * @typedef {Object} StairPlacement
 * @property {number} chunkX
 * @property {number} chunkY
 * @property {number} localX - chunk-local tile X
 * @property {number} localY - chunk-local tile Y
 */

/**
 * @typedef {Object} FloorPlan
 * @property {number} depth
 * @property {number} seed
 * @property {StairPlacement[]} downStairs
 * @property {StairPlacement[]} upStairs
 * @property {number} difficultyMult
 * @property {string} theme
 */

/**
 * Generate the floor plan for a given depth.
 * Called once when entering a new floor.
 * @param {number} worldSeed
 * @param {number} depth
 * @returns {FloorPlan}
 */
export function generateFloorPlan(worldSeed, depth) {
  const seed = floorSeed(worldSeed, depth);
  const rng = createRng(seed);

  // Down stairs: always at least 1, deeper floors occasionally get 2
  const downStairCount = 1 + (depth >= 5 && rng.next() < 0.3 ? 1 : 0);
  const downStairs = [];
  for (let i = 0; i < downStairCount; i++) {
    downStairs.push({
      chunkX: rng.int(1, 3) * (i % 2 === 0 ? 1 : -1),
      chunkY: rng.int(1, 3) * (i < 2 ? 1 : -1),
      localX: rng.int(4, CHUNK_SIZE - 5),
      localY: rng.int(4, CHUNK_SIZE - 5),
    });
  }

  // Up stairs: 1 near origin, except on floor 1
  const upStairs = [];
  if (depth > 1) {
    upStairs.push({
      chunkX: 0,
      chunkY: 0,
      localX: rng.int(4, CHUNK_SIZE - 5),
      localY: rng.int(4, CHUNK_SIZE - 5),
    });
  }

  return {
    depth,
    seed,
    downStairs,
    upStairs,
    difficultyMult: 1.0 + (depth - 1) * 0.15,
    theme: _pickTheme(rng, depth),
  };
}

/**
 * Get the world-coordinate position of a stair placement.
 * @param {StairPlacement} stair
 * @returns {{x: number, y: number}}
 */
export function stairWorldPos(stair) {
  return {
    x: stair.chunkX * CHUNK_SIZE + stair.localX,
    y: stair.chunkY * CHUNK_SIZE + stair.localY,
  };
}

function _pickTheme(rng, depth) {
  if (depth <= 3) return 'crypt';
  if (depth <= 8) return rng.choice(['crypt', 'cave', 'sewer']);
  if (depth <= 15) return rng.choice(['cave', 'mine', 'temple']);
  return rng.choice(['abyss', 'temple', 'mine', 'hell']);
}
