import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { ChunkMeta } from '../src/rules/components/ChunkMeta.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { chunkManagementSystem } from '../src/rules/systems/chunkManagementSystem.js';
import { CHUNK_SIZE } from '../src/rules/environment/dungeon/constants.js';
import { loadedChunkCount, clearAll, getTile, isWalkable } from '../src/rules/environment/dungeon/tileMap.js';

function makePlayerAt(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

function makeDungeonState(world, seed = 42, depth = 1) {
  const id = world.create();
  world.add(id, DungeonState, {
    worldSeed: seed,
    currentDepth: depth,
    playerChunkX: 0,
    playerChunkY: 0,
    chunkLoadRadius: 2,
  });
  return id;
}

function countChunks(world) {
  let count = 0;
  for (const [_id] of world.query(ChunkMeta)) count++;
  return count;
}

Deno.test("chunkManagementSystem loads chunks around player", () => {
  clearAll();
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);

  // With radius 2, should load (2*2+1)^2 = 25 chunks
  const chunks = countChunks(world);
  assert(chunks === 25, `expected 25 chunks, got ${chunks}`);

  // TileMap should have tile data loaded
  assert(loadedChunkCount() > 0, `expected loaded tileMap chunks, got ${loadedChunkCount()}`);
});

Deno.test("chunkManagementSystem is idempotent (no duplicates on re-run)", () => {
  clearAll();
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);
  const chunks1 = countChunks(world);
  const tileChunks1 = loadedChunkCount();

  chunkManagementSystem(world);
  const chunks2 = countChunks(world);
  const tileChunks2 = loadedChunkCount();

  assert(chunks1 === chunks2, `chunk count stable: ${chunks1} vs ${chunks2}`);
  assert(tileChunks1 === tileChunks2, `tileMap chunk count stable: ${tileChunks1} vs ${tileChunks2}`);
});

Deno.test("moving player loads new chunks", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const pid = makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);
  const chunks1 = countChunks(world);

  // Move player to a new chunk
  world.set(pid, Position, { x: CHUNK_SIZE * 5, y: 0 });
  chunkManagementSystem(world);

  // Should have 25 chunks loaded around new position, some old ones may persist within unload radius
  const chunks2 = countChunks(world);
  assert(chunks2 >= 25, `at least 25 chunks after move: ${chunks2}`);
  assert(chunks2 > 0, 'still has chunks');
});

Deno.test("distant chunks are unloaded", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const pid = makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);

  // Move player far away
  world.set(pid, Position, { x: CHUNK_SIZE * 10, y: CHUNK_SIZE * 10 });
  chunkManagementSystem(world);

  // Verify no chunks remain from the old position (0,0)
  // Unload uses Chebyshev distance with radius = loadRadius + 1 = 3
  for (const [_id, meta] of world.query(ChunkMeta)) {
    const dist = Math.max(Math.abs(meta.chunkX - 10), Math.abs(meta.chunkY - 10));
    assert(dist <= 3, `chunk (${meta.chunkX},${meta.chunkY}) within unload radius of player chunk (10,10), dist=${dist}`);
  }
});

Deno.test("regenerated chunk produces identical layout", () => {
  clearAll();
  const world1 = new World({ seed: 42 });
  makePlayerAt(world1, 0, 0);
  makeDungeonState(world1, 42, 1);
  chunkManagementSystem(world1);

  // Collect walkable positions from chunk (0,0) via tileMap
  const walkable1 = new Set();
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (isWalkable(lx, ly)) walkable1.add(`${lx},${ly}`);
    }
  }

  // Create a fresh world and generate the same dungeon
  clearAll();
  const world2 = new World({ seed: 42 });
  makePlayerAt(world2, 0, 0);
  makeDungeonState(world2, 42, 1);
  chunkManagementSystem(world2);

  const walkable2 = new Set();
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (isWalkable(lx, ly)) walkable2.add(`${lx},${ly}`);
    }
  }

  assert(walkable1.size === walkable2.size, `same walkable count: ${walkable1.size} vs ${walkable2.size}`);
  for (const k of walkable1) {
    assert(walkable2.has(k), `walkable at ${k} exists in both`);
  }
});

Deno.test("no action when no DungeonState exists", () => {
  clearAll();
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  // No DungeonState — system should do nothing
  chunkManagementSystem(world);
  assert(countChunks(world) === 0, 'no chunks loaded without DungeonState');
});

Deno.test("no action when no player exists", () => {
  clearAll();
  const world = new World({ seed: 42 });
  makeDungeonState(world, 42, 1);
  // No player — system should do nothing
  chunkManagementSystem(world);
  assert(countChunks(world) === 0, 'no chunks loaded without player');
});
