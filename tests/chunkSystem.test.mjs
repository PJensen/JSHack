import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { ChunkMeta } from '../src/rules/components/ChunkMeta.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { chunkManagementSystem } from '../src/rules/systems/chunkManagementSystem.js';
import { CHUNK_SIZE } from '../src/rules/environment/dungeon/constants.js';

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

function countTerrain(world) {
  let count = 0;
  for (const [id] of world.query(Position)) {
    if (world.has(id, Terrain)) count++;
  }
  return count;
}

Deno.test("chunkManagementSystem loads chunks around player", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);

  // With radius 2, should load (2*2+1)^2 = 25 chunks
  const chunks = countChunks(world);
  assert(chunks === 25, `expected 25 chunks, got ${chunks}`);

  // Should have terrain entities
  const terrain = countTerrain(world);
  assert(terrain > 0, `expected terrain entities, got ${terrain}`);
});

Deno.test("chunkManagementSystem is idempotent (no duplicates on re-run)", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);
  const chunks1 = countChunks(world);
  const terrain1 = countTerrain(world);

  chunkManagementSystem(world);
  const chunks2 = countChunks(world);
  const terrain2 = countTerrain(world);

  assert(chunks1 === chunks2, `chunk count stable: ${chunks1} vs ${chunks2}`);
  assert(terrain1 === terrain2, `terrain count stable: ${terrain1} vs ${terrain2}`);
});

Deno.test("moving player loads new chunks", () => {
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
  const world1 = new World({ seed: 42 });
  makePlayerAt(world1, 0, 0);
  makeDungeonState(world1, 42, 1);
  chunkManagementSystem(world1);

  // Collect floor positions from chunk (0,0)
  const floors1 = new Set();
  for (const [id, pos] of world1.query(Position)) {
    const ter = world1.get(id, Terrain);
    if (ter && ter.walkable) floors1.add(`${pos.x},${pos.y}`);
  }

  // Create a fresh world and generate the same dungeon
  const world2 = new World({ seed: 42 });
  makePlayerAt(world2, 0, 0);
  makeDungeonState(world2, 42, 1);
  chunkManagementSystem(world2);

  const floors2 = new Set();
  for (const [id, pos] of world2.query(Position)) {
    const ter = world2.get(id, Terrain);
    if (ter && ter.walkable) floors2.add(`${pos.x},${pos.y}`);
  }

  assert(floors1.size === floors2.size, `same floor count: ${floors1.size} vs ${floors2.size}`);
  for (const k of floors1) {
    assert(floors2.has(k), `floor at ${k} exists in both`);
  }
});

Deno.test("no action when no DungeonState exists", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  // No DungeonState — system should do nothing
  chunkManagementSystem(world);
  assert(countChunks(world) === 0, 'no chunks loaded without DungeonState');
});

Deno.test("no action when no player exists", () => {
  const world = new World({ seed: 42 });
  makeDungeonState(world, 42, 1);
  // No player — system should do nothing
  chunkManagementSystem(world);
  assert(countChunks(world) === 0, 'no chunks loaded without player');
});
