// rules/environment/dungeon/seed.js
// Deterministic seed derivation for chunks and floors.

import { seedFromString } from '../../../lib/ecs-js/rng.js';

/**
 * Derive a deterministic 32-bit seed for a specific chunk on a specific floor.
 * @param {number} worldSeed - 32-bit integer world seed
 * @param {number} depth     - Floor number (1-based)
 * @param {number} chunkX    - Chunk X coordinate
 * @param {number} chunkY    - Chunk Y coordinate
 * @returns {number} 32-bit unsigned seed
 */
export function chunkSeed(worldSeed, depth, chunkX, chunkY) {
  return seedFromString(`${worldSeed >>> 0}:${depth}:${chunkX}:${chunkY}`);
}

/**
 * Derive a deterministic seed for floor-level decisions
 * (stair placement, theme, difficulty).
 * @param {number} worldSeed
 * @param {number} depth
 * @returns {number} 32-bit unsigned seed
 */
export function floorSeed(worldSeed, depth) {
  return seedFromString(`${worldSeed >>> 0}:floor:${depth}`);
}

/**
 * Derive a deterministic seed for a shared edge between two adjacent chunks.
 * The seed is symmetric: edgeSeed(A,B) === edgeSeed(B,A).
 * @param {number} worldSeed
 * @param {number} depth
 * @param {number} cxA - Chunk A x
 * @param {number} cyA - Chunk A y
 * @param {number} cxB - Chunk B x
 * @param {number} cyB - Chunk B y
 * @returns {number} 32-bit unsigned seed
 */
export function edgeSeed(worldSeed, depth, cxA, cyA, cxB, cyB) {
  // Sort coordinates so order doesn't matter
  const minX = Math.min(cxA, cxB), maxX = Math.max(cxA, cxB);
  const minY = Math.min(cyA, cyB), maxY = Math.max(cyA, cyB);
  return seedFromString(`${worldSeed >>> 0}:edge:${depth}:${minX}:${minY}:${maxX}:${maxY}`);
}
