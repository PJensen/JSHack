// tests/prefabRoom.test.mjs
// Tests for prefab room integration into dungeon generation.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { generateFloorPlan } from '../src/rules/environment/dungeon/floorPlan.js';
import { generateChunk } from '../src/rules/environment/dungeon/chunk.js';
import { populateChunk } from '../src/rules/environment/dungeon/populate.js';
import { loadPrefabRoom, stampPrefabInChunk } from '../src/rules/environment/dungeon/prefabRooms.js';
import { createRng } from '../src/lib/ecs-js/rng.js';
import { buildBSP, placeRooms, carveRooms, connectRooms, collectLeafRooms } from '../src/rules/environment/dungeon/bsp.js';
import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
} from '../src/rules/environment/dungeon/constants.js';
import {
  clearAll, isWalkable, forEachLoadedTile,
} from '../src/rules/environment/dungeon/tileMap.js';
import { generateFloor } from '../src/rules/environment/dungeon/index.js';
import { chunkSeed } from '../src/rules/environment/dungeon/seed.js';
import { dungeonConfig } from '../src/rules/environment/dungeon/dungeonConfig.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CARDINALS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function withDungeonScale(scale, fn) {
  const previous = dungeonConfig.dungeonScale;
  dungeonConfig.dungeonScale = scale;
  try {
    return fn();
  } finally {
    dungeonConfig.dungeonScale = previous;
    clearAll();
  }
}

function floodFillLocal(tiles, sx, sy, stride) {
  const visited = new Set();
  const queue = [[sx, sy]];
  visited.add(`${sx},${sy}`);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx, ny = cy + dy;
      const nk = `${nx},${ny}`;
      if (visited.has(nk)) continue;
      if (nx < 0 || ny < 0 || nx >= stride || ny >= stride) continue;
      const t = tiles[ny * stride + nx];
      if (t === TILE_FLOOR || t === TILE_DOOR) {
        visited.add(nk);
        queue.push([nx, ny]);
      }
    }
  }
  return visited;
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("loadPrefabRoom returns the boulder puzzle definition", () => {
  const def = loadPrefabRoom("room_boulder_puzzle");
  assert(def !== null);
  assertEquals(def.name, "room_boulder_puzzle");
  assertEquals(def.width, 6);
  assertEquals(def.height, 6);
  assert(def.tiles.length > 0);
  assert(def.spawns.length > 0);
  assert(def.waypoints.length === 2);
});

Deno.test("loadPrefabRoom returns the lava dead-end definition", () => {
  const def = loadPrefabRoom("room_lava_puzzle_dead_end");
  assert(def !== null);
  assertEquals(def.name, "lava_puzzle_dead_end");
  assertEquals(def.width, 7);
  assertEquals(def.height, 13);
  assert(def.tiles.length > 0);
  assert(def.spawns.length > 0);
  assert(def.waypoints.length >= 1);
});

Deno.test("floor plan at depth 1 includes authored prefab rooms in non-origin chunks", () => {
  withDungeonScale(2, () => {
    const SEEDS = [42, 123, 777, 9999, 31337];
    for (const seed of SEEDS) {
      const plan = generateFloorPlan(seed, 1);
      assert(Array.isArray(plan.prefabRooms), `seed ${seed}: prefabRooms missing`);
      assertEquals(plan.prefabRooms.length, 2, `seed ${seed}: should have exactly 2 prefabs`);
      const ids = new Set(plan.prefabRooms.map(pr => pr.roomId));
      assert(ids.has("room_boulder_puzzle"), `seed ${seed}: missing boulder puzzle`);
      assert(ids.has("room_lava_puzzle_dead_end"), `seed ${seed}: missing lava dead end`);
      for (const pr of plan.prefabRooms) {
        assert(!(pr.chunkX === 0 && pr.chunkY === 0), `seed ${seed}: prefab should not be in origin chunk`);
      }
    }
  });
});

Deno.test("floor plan at depth 2 has no authored prefabRooms", () => {
  const plan = generateFloorPlan(42, 2);
  assert(Array.isArray(plan.prefabRooms));
  assertEquals(plan.prefabRooms.length, 0);
});

Deno.test("stampPrefabInChunk writes correct tile layout", () => {
  const def = loadPrefabRoom("room_boulder_puzzle");
  // Create a chunk with one large enough BSP room.
  const rng = createRng(42);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng);
  placeRooms(tree, rng);
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, rng);
  const localRooms = collectLeafRooms(tree);

  const result = stampPrefabInChunk(tiles, localRooms, def, CHUNK_SIZE);
  // It's possible no room is large enough — but with default BSP on 24×24, it's very likely.
  if (result === null) return; // graceful fallback, nothing to verify

  const { anchorX, anchorY } = result;

  // Verify all prefab tiles were stamped.
  for (const { dx, dy, tile } of def.tiles) {
    const lx = anchorX + dx;
    const ly = anchorY + dy;
    if (lx < 0 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
    const expected = tile === "wall" ? TILE_WALL : tile === "floor" ? TILE_FLOOR : -1;
    if (expected < 0) continue;
    const actual = tiles[ly * CHUNK_SIZE + lx];
    assertEquals(actual, expected, `tile at (${lx},${ly}) should be ${tile} but got ${actual}`);
  }
});

Deno.test("no TILE_DOOR inside prefab bounding rect", () => {
  const def = loadPrefabRoom("room_boulder_puzzle");
  const rng = createRng(123);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng);
  placeRooms(tree, rng);
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, rng);
  const localRooms = collectLeafRooms(tree);

  const result = stampPrefabInChunk(tiles, localRooms, def, CHUNK_SIZE);
  if (!result) return;

  const { anchorX, anchorY } = result;
  for (let py = anchorY - 5; py <= anchorY; py++) {
    for (let px = anchorX - 5; px <= anchorX; px++) {
      if (px < 0 || py < 0 || px >= CHUNK_SIZE || py >= CHUNK_SIZE) continue;
      assert(
        tiles[py * CHUNK_SIZE + px] !== TILE_DOOR,
        `TILE_DOOR found inside prefab at (${px},${py})`,
      );
    }
  }
});

Deno.test("entrance and exit waypoints connect to corridor network", () => {
  const def = loadPrefabRoom("room_boulder_puzzle");
  const rng = createRng(777);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng);
  placeRooms(tree, rng);
  carveRooms(tree, tiles, CHUNK_SIZE);
  connectRooms(tree, tiles, CHUNK_SIZE, rng);
  const localRooms = collectLeafRooms(tree);

  const result = stampPrefabInChunk(tiles, localRooms, def, CHUNK_SIZE);
  if (!result) return;

  const { anchorX, anchorY } = result;

  // Find the entrance and exit positions.
  const entrance = def.waypoints.find(w => w.name === "entrance");
  const exit = def.waypoints.find(w => w.name === "exit");
  const ex = anchorX + entrance.dx;
  const ey = anchorY + entrance.dy;
  const xx = anchorX + exit.dx;
  const xy = anchorY + exit.dy;

  // Both waypoints should be floor tiles.
  assertEquals(tiles[ey * CHUNK_SIZE + ex], TILE_FLOOR, "entrance should be floor");
  assertEquals(tiles[xy * CHUNK_SIZE + xx], TILE_FLOOR, "exit should be floor");

  // Flood-fill from entrance should reach exit (connectivity).
  const reachable = floodFillLocal(tiles, ex, ey, CHUNK_SIZE);
  assert(reachable.has(`${xx},${xy}`), "exit should be reachable from entrance via flood-fill");

  // Flood-fill should also reach tiles outside the prefab (connected to corridor network).
  let reachesOutside = false;
  for (const key of reachable) {
    const [rx, ry] = key.split(",").map(Number);
    if (rx < anchorX - 5 || rx > anchorX || ry < anchorY - 5 || ry > anchorY) {
      reachesOutside = true;
      break;
    }
  }
  assert(reachesOutside, "prefab should connect to tiles outside its bounding rect");
});

Deno.test("populateChunk uses prefab spawns and skips normal population", () => {
  withDungeonScale(2, () => {
    const seed = 42;
    const plan = generateFloorPlan(seed, 1);
    assert(plan.prefabRooms.length >= 1);
    const pr = plan.prefabRooms.find((room) => room.roomId === "room_boulder_puzzle");
    assert(pr);

    const chunk = generateChunk(seed, 1, pr.chunkX, pr.chunkY, plan.profile, plan);
    const popSeed = chunkSeed(seed, 1, pr.chunkX, pr.chunkY) ^ 0xDEAD;
    const popRng = createRng(popSeed >>> 0);
    const spawns = populateChunk(chunk, plan, popRng);

    const prefabRoom = chunk.rooms.find(r => r.prefab);
    if (!prefabRoom) return;

    const def = loadPrefabRoom("room_boulder_puzzle");
    const expectedKinds = def.spawns.map(s => s.kind);
    for (const kind of expectedKinds) {
      const found = spawns.some(s => s.kind === kind);
      assert(found, `expected spawn kind "${kind}" from prefab room`);
    }

    const prefabSpawnCount = def.spawns.length;
    const roomArea = { minX: prefabRoom.x, maxX: prefabRoom.x + prefabRoom.w - 1,
                       minY: prefabRoom.y, maxY: prefabRoom.y + prefabRoom.h - 1 };
    const inRoomSpawns = spawns.filter(s =>
      s.x >= roomArea.minX && s.x <= roomArea.maxX &&
      s.y >= roomArea.minY && s.y <= roomArea.maxY
    );
    assert(inRoomSpawns.length >= prefabSpawnCount,
      `expected at least ${prefabSpawnCount} spawns in prefab room area, got ${inRoomSpawns.length}`);
  });
});

Deno.test("lava dead-end prefab can author a skeleton archer spawn via explicit monster params", () => {
  withDungeonScale(2, () => {
    const seed = 42;
    const plan = generateFloorPlan(seed, 1);
    const pr = plan.prefabRooms.find((room) => room.roomId === "room_lava_puzzle_dead_end");
    assert(pr, "expected lava dead-end prefab on depth 1");

    const chunk = generateChunk(seed, 1, pr.chunkX, pr.chunkY, plan.profile, plan);
    const prefabRoom = chunk.rooms.find((room) => room.prefab);
    assert(prefabRoom, "expected lava dead-end prefab to stamp into its chunk");
    const popSeed = chunkSeed(seed, 1, pr.chunkX, pr.chunkY) ^ 0xDEAD;
    const popRng = createRng(popSeed >>> 0);
    const spawns = populateChunk(chunk, plan, popRng);

    const archer = spawns.find((spawn) => spawn.kind === "monster" && spawn.params?.identity === "skeleton_archer");
    assert(archer, "expected skeleton archer spawn from prefab monster spawn params");
  });
});

Deno.test("prefab room is reachable from player spawn on full floor", () => {
  withDungeonScale(2, () => {
    const SEEDS = [42, 123, 777];
    for (const seed of SEEDS) {
      clearAll();
      const world = new World({ seed });
      const plan = generateFloorPlan(seed, 1);
      const { spawnX, spawnY } = generateFloor(world, seed, 1);

      assert(plan.prefabRooms.length >= 2, `seed ${seed}: should have authored prefabs`);
      const reachable = floodFillWorld(spawnX, spawnY);

      for (const pr of plan.prefabRooms) {
        const ox = pr.chunkX * CHUNK_SIZE;
        const oy = pr.chunkY * CHUNK_SIZE;
        let prefabFloorReachable = false;
        for (let ly = 0; ly < CHUNK_SIZE && !prefabFloorReachable; ly++) {
          for (let lx = 0; lx < CHUNK_SIZE && !prefabFloorReachable; lx++) {
            const wx = ox + lx, wy = oy + ly;
            if (isWalkable(wx, wy) && reachable.has(`${wx},${wy}`)) {
              prefabFloorReachable = true;
            }
          }
        }
        assert(prefabFloorReachable, `seed ${seed}: prefab chunk ${pr.roomId} should have reachable tiles`);
      }
    }
  });
});
