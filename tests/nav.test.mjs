// tests/nav.test.mjs
// Navigation / connectivity tests for full dungeon floors.
//
// These tests verify:
//   1. All stair tiles are reachable from the player spawn position.
//   2. No stair tile is a dead-end (the player can always step off).
//   3. All walkable tiles belong to a single connected component (no isolated blobs).
//
// Tests run across several world seeds at depths 1 and 4 to catch edge cases.

import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import {
  clearAll, isWalkable, forEachLoadedTile,
} from '../src/rules/environment/dungeon/tileMap.js';
import { generateFloor } from '../src/rules/environment/dungeon/index.js';
import { TILE_STAIR_DOWN, TILE_STAIR_UP } from '../src/rules/environment/dungeon/constants.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Flood-fill across the multi-chunk tile map using world coordinates.
 * Uses isWalkable() so it respects all tile types (floor, door, stairs, etc.).
 * Returns a Set of "x,y" string keys reachable from (sx, sy).
 */
function floodFillWorld(sx, sy) {
  const visited = new Set();
  const queue = [[sx, sy]];
  visited.add(`${sx},${sy}`);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx, ny = cy + dy;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      if (isWalkable(nx, ny)) {
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

/** Collect all stair tiles across all loaded chunks. */
function collectStairs() {
  const stairs = [];
  forEachLoadedTile((x, y, tile) => {
    if (tile === TILE_STAIR_DOWN || tile === TILE_STAIR_UP) {
      stairs.push({ x, y, kind: tile === TILE_STAIR_DOWN ? 'down' : 'up' });
    }
  });
  return stairs;
}

/** Collect all walkable tile positions across all loaded chunks. */
function collectWalkable() {
  const out = new Set();
  forEachLoadedTile((x, y) => {
    if (isWalkable(x, y)) out.add(`${x},${y}`);
  });
  return out;
}

function collectWalkableComponents() {
  const allWalkable = collectWalkable();
  const remaining = new Set(allWalkable);
  const components = [];

  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    const [sx, sy] = start.split(',').map(Number);
    const component = floodFillWorld(sx, sy);
    for (const key of component) remaining.delete(key);
    components.push(component);
  }

  return components;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SEEDS = [42, 123, 777, 9999, 31337];
const DEPTHS = [1, 4];

Deno.test("all stair tiles are reachable from spawn", () => {
  for (const depth of DEPTHS) {
    for (const seed of SEEDS) {
      clearAll();
      const world = new World({ seed });
      const { spawnX, spawnY } = generateFloor(world, seed, depth);

      assert(isWalkable(spawnX, spawnY),
        `depth ${depth} seed ${seed}: spawn (${spawnX},${spawnY}) must be walkable`);

      const reachable = floodFillWorld(spawnX, spawnY);
      const stairs = collectStairs();

      assert(stairs.length > 0,
        `depth ${depth} seed ${seed}: floor must contain at least one stair`);

      for (const { x, y, kind } of stairs) {
        assert(reachable.has(`${x},${y}`),
          `depth ${depth} seed ${seed}: ${kind}-stair at (${x},${y}) unreachable from spawn (${spawnX},${spawnY})`);
      }
    }
  }
});

Deno.test("every stair tile has at least one walkable neighbour (player can step off)", () => {
  for (const depth of DEPTHS) {
    for (const seed of SEEDS) {
      clearAll();
      const world = new World({ seed });
      generateFloor(world, seed, depth);

      for (const { x, y, kind } of collectStairs()) {
        const walkableNeighbours = CARDINALS.filter(([dx, dy]) => isWalkable(x + dx, y + dy));
        assert(walkableNeighbours.length > 0,
          `depth ${depth} seed ${seed}: ${kind}-stair at (${x},${y}) is isolated — no walkable neighbour`);
      }
    }
  }
});

Deno.test("all walkable tiles form one connected component", () => {
  for (const depth of DEPTHS) {
    for (const seed of SEEDS) {
      clearAll();
      const world = new World({ seed });
      const { spawnX, spawnY } = generateFloor(world, seed, depth);
      const components = collectWalkableComponents();

      if (depth === 1) {
        assert(
          components.length === 2,
          `depth ${depth} seed ${seed}: expected main dungeon + detached pocket, got ${components.length} components`,
        );
        const sizes = components.map((component) => component.size).sort((a, b) => a - b);
        assert(
          sizes[0] === 16,
          `depth ${depth} seed ${seed}: detached pocket should be a 4x4 room (16 tiles), got ${sizes[0]}`,
        );
        assert(
          components.some((component) => component.has(`${spawnX},${spawnY}`)),
          `depth ${depth} seed ${seed}: spawn component missing`,
        );
        continue;
      }

      assert(
        components.length === 1,
        `depth ${depth} seed ${seed}: walkable graph should be fully connected, got ${components.length} components`,
      );
    }
  }
});

Deno.test("forced up-stairs stay connected after descent (positional-identity)", () => {
  // Simulate the actual game path: overworld → depth 1.
  // The overworld's down-stair position becomes a forced up-stair on depth 1.
  // This up-stair may land on TILE_WALL or TILE_VOID, so a corridor must be carved.
  for (const seed of [...SEEDS, 0xC0FFEE]) {
    // Generate overworld to collect down-stair positions
    clearAll();
    const w0 = new World({ seed });
    const ow = generateFloor(w0, seed, 0);

    // Generate depth 1 via descent (with priorDownStairPositions)
    clearAll();
    const w1 = new World({ seed });
    const d1 = generateFloor(w1, seed, 1, null, null, ow.downStairPositions);

    // Every forced up-stair must be walkable and have walkable neighbors
    for (const sp of ow.downStairPositions) {
      assert(isWalkable(sp.x, sp.y),
        `seed ${seed}: forced up-stair at (${sp.x},${sp.y}) must be walkable`);
      const wn = CARDINALS.filter(([dx, dy]) => isWalkable(sp.x + dx, sp.y + dy));
      assert(wn.length > 0,
        `seed ${seed}: forced up-stair at (${sp.x},${sp.y}) must have walkable neighbors`);
    }

    const components = collectWalkableComponents();
    assert(
      components.some((component) => component.size === 16),
      `seed ${seed}: detached 4x4 pocket should remain present`,
    );
  }
});
