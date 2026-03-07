// rules/environment/dungeon/floorPlan.js
// Per-depth metadata: stair positions, theme, difficulty.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { floorSeed } from './seed.js';
import { CHUNK_SIZE } from './constants.js';
import { dungeonConfig } from './dungeonConfig.js';
import { OVERWORLD_EXTENT } from './overworld.js';
import { pickProfile } from './profiles/index.js';

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
 * @property {import('./profiles/default.js').DungeonProfile} profile
 */

/**
 * Generate the floor plan for a given depth.
 * Called once when entering a new floor.
 * @param {number} worldSeed
 * @param {number} depth
 * @param {{x:number,y:number}[]|null} [priorDownStairPositions]
 *   Actual world positions of down-stairs on the floor above.
 *   When provided, up-stairs are placed at those exact positions (positional-identity
 *   contract) rather than being independently computed.
 * @returns {FloorPlan}
 */
export function generateFloorPlan(worldSeed, depth, priorDownStairPositions = null) {
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

  const scale = dungeonConfig.dungeonScale;

  // Progressive dungeon size: place down-stairs further from origin on
  // deeper floors.  dungeonScale modulates the growth rate —
  // 0.3 (compact/mobile) grows slowly, 1.0 grows every ~3 floors.
  const stairOffset = Math.min(3, Math.floor(depth * scale / 3));

  // Down stairs: generate minDownStairs–maxDownStairs per floor, each with an independent
  // chunk offset so they spread across the floor on deeper levels.
  // At shallow depths (stairOffset = 0) they share chunk (0,0) and land in different rooms.
  const count = rng.int(dungeonConfig.minDownStairs, dungeonConfig.maxDownStairs);
  const downStairs = [];
  for (let i = 0; i < count; i++) {
    let cX = 0, cY = 0;
    if (stairOffset > 0) {
      cX = rng.int(1, stairOffset) * (rng.next() < 0.5 ? 1 : -1);
      cY = rng.int(0, stairOffset) * (rng.next() < 0.5 ? 1 : -1);
    }
    downStairs.push({
      chunkX: cX,
      chunkY: cY,
      localX: rng.int(4, CHUNK_SIZE - 5),
      localY: rng.int(4, CHUNK_SIZE - 5),
    });
  }

  // Up stairs: inherit the prior floor's down-stair positions (positional-identity
  // contract) when available, otherwise place independently near origin.
  const upStairs = [];
  if (depth >= 1) {
    if (Array.isArray(priorDownStairPositions) && priorDownStairPositions.length > 0) {
      for (const { x, y } of priorDownStairPositions) {
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkY = Math.floor(y / CHUNK_SIZE);
        upStairs.push({
          chunkX,
          chunkY,
          localX: x - chunkX * CHUNK_SIZE,
          localY: y - chunkY * CHUNK_SIZE,
          forced: true,
        });
      }
    } else {
      upStairs.push({
        chunkX: 0,
        chunkY: 0,
        localX: rng.int(4, CHUNK_SIZE - 5),
        localY: rng.int(4, CHUNK_SIZE - 5),
      });
    }
  }

  // Derive chunk extent from stair positions + 1 chunk padding
  const padding = Math.max(1, Math.round(scale));
  const allChunkPositions = [...downStairs, ...upStairs, { chunkX: 0, chunkY: 0 }];
  const extent = {
    minCX: Math.min(...allChunkPositions.map(s => s.chunkX)) - padding,
    maxCX: Math.max(...allChunkPositions.map(s => s.chunkX)) + padding,
    minCY: Math.min(...allChunkPositions.map(s => s.chunkY)) - padding,
    maxCY: Math.max(...allChunkPositions.map(s => s.chunkY)) + padding,
  };

  const profile = pickProfile(rng, depth);

  return {
    depth,
    seed,
    downStairs,
    upStairs,
    extent,
    difficultyMult: 1.0 + (depth - 1) * 0.017,
    theme: profile.theme,
    profile,
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
