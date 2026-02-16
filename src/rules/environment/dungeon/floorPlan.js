// rules/environment/dungeon/floorPlan.js
// Per-depth metadata: stair positions, theme, difficulty.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { floorSeed } from './seed.js';
import { CHUNK_SIZE } from './constants.js';
import { dungeonConfig } from './dungeonConfig.js';
import { OVERWORLD_EXTENT } from './overworld.js';

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
  if (depth === 0) {
    return {
      depth,
      seed: floorSeed(worldSeed, depth),
      downStairs: [{
        chunkX: 0,
        chunkY: 0,
        localX: Math.floor(CHUNK_SIZE * 0.75),
        localY: Math.floor(CHUNK_SIZE * 0.5),
      }],
      upStairs: [],
      extent: { ...OVERWORLD_EXTENT },
      difficultyMult: 0,
      theme: 'overworld',
    };
  }

  const seed = floorSeed(worldSeed, depth);
  const rng = createRng(seed);

  // Down stairs: placed in the starting chunk (0,0)
  const downStairs = [{
    chunkX: 0,
    chunkY: 0,
    localX: rng.int(4, CHUNK_SIZE - 5),
    localY: rng.int(4, CHUNK_SIZE - 5),
  }];

  // Up stairs: 1 near origin, except on floor 1
  const upStairs = [];
  if (depth >= 1) {
    upStairs.push({
      chunkX: 0,
      chunkY: 0,
      localX: rng.int(4, CHUNK_SIZE - 5),
      localY: rng.int(4, CHUNK_SIZE - 5),
    });
  }

  // Derive chunk extent from stair positions + 1 chunk padding
  const allChunkPositions = [...downStairs, ...upStairs, { chunkX: 0, chunkY: 0 }];
  const extent = {
    minCX: Math.min(...allChunkPositions.map(s => s.chunkX)) - 1,
    maxCX: Math.max(...allChunkPositions.map(s => s.chunkX)) + 1,
    minCY: Math.min(...allChunkPositions.map(s => s.chunkY)) - 1,
    maxCY: Math.max(...allChunkPositions.map(s => s.chunkY)) + 1,
  };

  return {
    depth,
    seed,
    downStairs,
    upStairs,
    extent,
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
