import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { CHUNK_SIZE } from '../src/rules/environment/dungeon/constants.js';
import { loadedChunkCount, clearAll, getTile, isWalkable } from '../src/rules/environment/dungeon/tileMap.js';
import { initDungeon, generateFloor } from '../src/rules/environment/dungeon/index.js';
import { generateFloorPlan } from '../src/rules/environment/dungeon/floorPlan.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';

Deno.test("initDungeon generates floor with tile data", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);

  assert(loadedChunkCount() > 0, `expected loaded tileMap chunks, got ${loadedChunkCount()}`);
  assert(typeof spawn.x === 'number' && typeof spawn.y === 'number', 'spawn position returned');
});

Deno.test("initDungeon creates DungeonState with floorEntityIds", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);

  let ds = null;
  for (const [_id, state] of world.query(DungeonState)) {
    ds = state;
    break;
  }
  assert(ds !== null, 'DungeonState created');
  assert(Array.isArray(ds.floorEntityIds), 'floorEntityIds is array');
  assert(ds.floorEntityIds.length > 0, 'floorEntityIds is not empty');
});

Deno.test("spawn position is on a walkable tile", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);

  assert(isWalkable(spawn.x, spawn.y), `spawn (${spawn.x},${spawn.y}) should be walkable`);
});

Deno.test("generateFloor is deterministic", () => {
  clearAll();
  const world1 = new World({ seed: 42 });
  const result1 = generateFloor(world1, 42, 1);

  const walkable1 = new Set();
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      if (isWalkable(lx, ly)) walkable1.add(`${lx},${ly}`);
    }
  }

  clearAll();
  const world2 = new World({ seed: 42 });
  const result2 = generateFloor(world2, 42, 1);

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
  assert(result1.spawnX === result2.spawnX, 'same spawn X');
  assert(result1.spawnY === result2.spawnY, 'same spawn Y');
});

Deno.test("floor loads exactly the chunks described by the floor extent", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const plan = generateFloorPlan(world.seed >>> 0, 1);
  initDungeon(world);

  const expectedChunks = (plan.extent.maxCX - plan.extent.minCX + 1)
    * (plan.extent.maxCY - plan.extent.minCY + 1);
  assert(loadedChunkCount() === expectedChunks, `expected ${expectedChunks} loaded chunks, got ${loadedChunkCount()}`);
});

Deno.test("floor boundary does not expose walkable tiles into unloaded void", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const plan = generateFloorPlan(world.seed >>> 0, 1);
  generateFloor(world, 42, 1);

  const minX = plan.extent.minCX * CHUNK_SIZE;
  const maxX = (plan.extent.maxCX + 1) * CHUNK_SIZE - 1;
  const minY = plan.extent.minCY * CHUNK_SIZE;
  const maxY = (plan.extent.maxCY + 1) * CHUNK_SIZE - 1;

  for (let x = minX; x <= maxX; x++) {
    assert(!isWalkable(x, minY), `top boundary tile (${x},${minY}) should not be walkable`);
    assert(!isWalkable(x, maxY), `bottom boundary tile (${x},${maxY}) should not be walkable`);
  }
  for (let y = minY; y <= maxY; y++) {
    assert(!isWalkable(minX, y), `left boundary tile (${minX},${y}) should not be walkable`);
    assert(!isWalkable(maxX, y), `right boundary tile (${maxX},${y}) should not be walkable`);
  }
});

Deno.test("generateFloor emits monotonic chunk progress callbacks", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const calls = [];

  generateFloor(world, 42, 1, null, (progress) => {
    if (progress?.phase === 'chunks') calls.push(progress);
  });

  assert(calls.length > 1, 'expected chunk progress callbacks');
  const total = Number(calls[0]?.total || 0);
  assert(total > 0, 'expected chunk total > 0');
  assert(Number(calls[0]?.processed ?? -1) === 0, 'first callback starts at processed=0');
  assert(calls.length === total + 1, `expected ${total + 1} callbacks, got ${calls.length}`);

  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    assert(c.total === total, `callback ${i} total mismatch`);
    assert(c.processed === i, `callback ${i} expected processed=${i}, got ${c.processed}`);
  }
});

Deno.test("initDungeon forwards chunk progress callback", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const calls = [];

  initDungeon(world, {
    onProgress: (progress) => {
      if (progress?.phase === 'chunks') calls.push(progress);
    },
  });

  assert(calls.length > 1, 'expected forwarded chunk progress callbacks');
  assert(Number(calls[0]?.processed ?? -1) === 0, 'first callback starts at processed=0');
  const last = calls[calls.length - 1];
  assert(last.processed === last.total, 'last callback reaches total');
});
