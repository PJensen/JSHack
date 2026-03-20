// rules/environment/dungeon/floorPlan.js
// Per-depth metadata: stair positions, theme, difficulty.

import { createRng } from '../../../lib/ecs-js/rng.js';
import { floorSeed } from './seed.js';
import { CHUNK_SIZE } from './constants.js';
import { dungeonConfig } from './dungeonConfig.js';
import { OVERWORLD_EXTENT } from './overworld.js';
import { pickProfile } from './profiles/index.js';
import { clamp } from '../../../shared/math/math.js';

function resolveBaseFootprintRadius(scale) {
  if (scale <= 0.15) return 0;
  if (scale <= 0.5) return 0;
  return Math.min(12, Math.max(1, Math.round(scale * 2) - 1));
}

function resolveGrowthBudget(scale, depth) {
  const delta = Math.max(0, depth - 1);
  return delta + Math.floor(delta * Math.max(0, scale) * 0.5);
}

function resolveFloorProfile(profile, depth) {
  if (!profile) return profile;
  if (profile.roomSparsity != null) return profile;

  const base = clamp(Number(dungeonConfig.roomSparsity) || 0, 0, 1);

  return {
    ...profile,
    roomSparsity: clamp(base, 0.05, 0.75),
  };
}

function buildExtent(chunkPositions, paddingX, paddingY) {
  return {
    minCX: Math.min(...chunkPositions.map((s) => s.chunkX)) - paddingX,
    maxCX: Math.max(...chunkPositions.map((s) => s.chunkX)) + paddingX,
    minCY: Math.min(...chunkPositions.map((s) => s.chunkY)) - paddingY,
    maxCY: Math.max(...chunkPositions.map((s) => s.chunkY)) + paddingY,
  };
}

function buildSymmetricExtent(paddingX, paddingY) {
  return {
    minCX: -paddingX,
    maxCX: paddingX,
    minCY: -paddingY,
    maxCY: paddingY,
  };
}

function expandExtentToInclude(extent, chunkPositions) {
  return {
    minCX: Math.min(extent.minCX, ...chunkPositions.map((s) => s.chunkX)),
    maxCX: Math.max(extent.maxCX, ...chunkPositions.map((s) => s.chunkX)),
    minCY: Math.min(extent.minCY, ...chunkPositions.map((s) => s.chunkY)),
    maxCY: Math.max(extent.maxCY, ...chunkPositions.map((s) => s.chunkY)),
  };
}

function collectPrefabCandidates(extent) {
  const candidates = [];
  for (let cy = extent.minCY; cy <= extent.maxCY; cy++) {
    for (let cx = extent.minCX; cx <= extent.maxCX; cx++) {
      if (cx === 0 && cy === 0) continue;
      candidates.push({ chunkX: cx, chunkY: cy });
    }
  }
  return candidates;
}

function ensurePrefabCandidates(candidates, needed) {
  const seen = new Set(candidates.map((c) => `${c.chunkX},${c.chunkY}`));
  const fallback = [
    { chunkX: 1, chunkY: 0 },
    { chunkX: -1, chunkY: 0 },
    { chunkX: 0, chunkY: 1 },
    { chunkX: 0, chunkY: -1 },
    { chunkX: 2, chunkY: 0 },
    { chunkX: -2, chunkY: 0 },
    { chunkX: 0, chunkY: 2 },
    { chunkX: 0, chunkY: -2 },
  ];
  for (const candidate of fallback) {
    if (candidates.length >= needed) break;
    const key = `${candidate.chunkX},${candidate.chunkY}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates;
}

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

  const scale = Math.max(0.1, Number(dungeonConfig.dungeonScale) || 0.3);
  const baseRadius = resolveBaseFootprintRadius(scale);
  const growthBudget = resolveGrowthBudget(scale, depth);
  const paddingX = growthBudget <= 0
    ? baseRadius
    : Math.min(12, baseRadius + Math.floor((growthBudget + 2) / 2));
  const paddingY = growthBudget <= 0
    ? baseRadius
    : Math.min(12, baseRadius + Math.floor((growthBudget + 1) / 2));

  // Footprint and stair spread are both driven from dungeonScale so the knob
  // changes the actual floor size instead of only nudging stair placement.
  const stairOffset = Math.floor(growthBudget / 2);

  // Down stairs: generate minDownStairs–maxDownStairs per floor, each with an independent
  // chunk offset so they spread across the floor on deeper levels.
  // At shallow depths (stairOffset = 0) they share chunk (0,0) and land in different rooms.
  const count = rng.int(dungeonConfig.minDownStairs, dungeonConfig.maxDownStairs);
  const downStairs = [];
  const _usedChunks = new Set();
  for (let i = 0; i < count; i++) {
    let cX = 0, cY = 0;
    if (stairOffset > 0) {
      // Retry up to 8 times to avoid placing two down-stairs in the same chunk.
      let attempts = 0;
      do {
        cX = rng.int(1, stairOffset) * (rng.next() < 0.5 ? 1 : -1);
        cY = rng.int(0, stairOffset) * (rng.next() < 0.5 ? 1 : -1);
        attempts++;
      } while (_usedChunks.has(`${cX},${cY}`) && attempts < 8);
      _usedChunks.add(`${cX},${cY}`);
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

  const prefabRules = [];
  if (depth === 1) {
    prefabRules.push("room_boulder_puzzle");
    prefabRules.push("room_lava_puzzle_dead_end");
  }

  // Derive chunk extent from the furthest stair plus a scale-driven footprint
  // radius.
  const allChunkPositions = [...downStairs, ...upStairs, { chunkX: 0, chunkY: 0 }];
  let extent = expandExtentToInclude(buildSymmetricExtent(paddingX, paddingY), allChunkPositions);

  const profile = resolveFloorProfile(pickProfile(rng, depth), depth);

  // Prefab rooms: hand-authored set pieces placed in non-origin chunks.
  const prefabRooms = [];
  if (prefabRules.length > 0) {
    const candidates = ensurePrefabCandidates(collectPrefabCandidates(extent), prefabRules.length);
    const orderedCandidates = candidates
      .slice()
      .sort((a, b) => {
        const da = Math.abs(a.chunkX) + Math.abs(a.chunkY);
        const db = Math.abs(b.chunkX) + Math.abs(b.chunkY);
        if (da !== db) return da - db;
        if (Math.abs(a.chunkY) !== Math.abs(b.chunkY)) return Math.abs(a.chunkY) - Math.abs(b.chunkY);
        if (Math.abs(a.chunkX) !== Math.abs(b.chunkX)) return Math.abs(a.chunkX) - Math.abs(b.chunkX);
        if (a.chunkY !== b.chunkY) return a.chunkY - b.chunkY;
        return a.chunkX - b.chunkX;
      });
    for (let i = 0; i < prefabRules.length && i < orderedCandidates.length; i++) {
      const pick = orderedCandidates[i];
      const roomId = prefabRules[i];
      prefabRooms.push({ chunkX: pick.chunkX, chunkY: pick.chunkY, roomId });
    }
    if (prefabRooms.length > 0) {
      extent = expandExtentToInclude(extent, prefabRooms);
    }
  }

  return {
    depth,
    seed,
    downStairs,
    upStairs,
    extent,
    difficultyMult: 1.0 + (depth - 1) * 0.017,
    theme: profile.theme,
    profile,
    prefabRooms,
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
