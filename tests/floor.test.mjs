import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { CHUNK_SIZE } from '../src/rules/environment/dungeon/constants.js';
import { loadedChunkCount, clearAll, getTile, isWalkable } from '../src/rules/environment/dungeon/tileMap.js';
import { initDungeon, generateFloor } from '../src/rules/environment/dungeon/index.js';
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

Deno.test("floor generates multiple chunks within extent", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);

  // With stairs at chunk coords 1-3 from origin + padding,
  // we should have significantly more than 1 chunk loaded
  assert(loadedChunkCount() > 1, `expected multiple chunks, got ${loadedChunkCount()}`);
});
