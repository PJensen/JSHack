import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { transitionToDepth, clearFloorCache } from '../src/rules/environment/dungeon/transition.js';
import { initDungeon, generateFloor } from '../src/rules/environment/dungeon/index.js';
import { loadedChunkCount, clearAll, getTile, isWalkable, forEachLoadedTile } from '../src/rules/environment/dungeon/tileMap.js';
import { dungeonConfig } from '../src/rules/environment/dungeon/dungeonConfig.js';
import { TILE_STAIR_UP } from '../src/rules/environment/dungeon/constants.js';
import { spawnPlasmaCloud } from "../src/rules/utils/spawnPlasmaCloud.js";
import { markExplored, isExplored, clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { exploredFloorRepository } from "../src/rules/environment/dungeon/floorMemory.js";

function makePlayerAt(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

Deno.test("transitionToDepth clears and regenerates floor", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);
  makePlayerAt(world, spawn.x, spawn.y);

  const chunksFloor1 = loadedChunkCount();
  assert(chunksFloor1 > 0, 'floor 1 has tile data');

  transitionToDepth(world, 2, { x: 10, y: 10 });

  const chunksFloor2 = loadedChunkCount();
  assert(chunksFloor2 > 0, 'floor 2 has tile data after transition');
});

Deno.test("transitionToDepth updates DungeonState.currentDepth", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);
  makePlayerAt(world, 0, 0);

  transitionToDepth(world, 5, { x: 0, y: 0 });

  for (const [_id, ds] of world.query(DungeonState)) {
    assert(ds.currentDepth === 5, `depth updated to 5, got ${ds.currentDepth}`);
  }
});

Deno.test("transitionToDepth moves player to destination", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);
  makePlayerAt(world, 0, 0);

  transitionToDepth(world, 2, { x: 100, y: -50 });

  for (const [id] of world.query(Player)) {
    const pos = world.get(id, Position);
    assert(pos.x === 100 && pos.y === -50, `player at (100,-50), got (${pos.x},${pos.y})`);
  }
});

Deno.test("transitionToDepth emits dungeon:transitioned event", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);
  makePlayerAt(world, 0, 0);

  const events = [];
  world.on('dungeon:transitioned', e => events.push(e));

  transitionToDepth(world, 3, { x: 5, y: 5 });

  assert(events.length === 1, 'event emitted');
  assert(events[0].depth === 3, 'correct depth');
  assert(events[0].pos.x === 5 && events[0].pos.y === 5, 'correct pos');
});

Deno.test("transitionToDepth updates floorEntityIds", () => {
  clearAll();
  const world = new World({ seed: 42 });
  initDungeon(world);
  makePlayerAt(world, 0, 0);

  transitionToDepth(world, 2, { x: 0, y: 0 });

  for (const [_id, ds] of world.query(DungeonState)) {
    assert(Array.isArray(ds.floorEntityIds), 'floorEntityIds is array');
    assert(ds.floorEntityIds.length > 0, 'new floor has entities');
  }
});

Deno.test("transitionToDepth destroys tracked hazards from prior floor", () => {
  clearAll();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);
  makePlayerAt(world, spawn.x, spawn.y);

  const cloudId = spawnPlasmaCloud(world, {
    x: spawn.x + 1,
    y: spawn.y,
    turnsLeft: 3,
    radius: 1,
    damage: 2,
  });
  assert(cloudId > 0, "plasma cloud should spawn");
  assert(world.isAlive(cloudId), "cloud should be alive before transition");

  let tracked = false;
  for (const [, ds] of world.query(DungeonState)) {
    tracked = Array.isArray(ds.floorEntityIds) && ds.floorEntityIds.includes(cloudId);
    break;
  }
  assert(tracked, "spawned cloud should be tracked on current floor");

  transitionToDepth(world, 2, { x: spawn.x, y: spawn.y });

  let plasmaHazards = 0;
  for (const [, hazard, ident] of world.query(HazardArea, NamedIdentity)) {
    const kind = String(hazard?.kind || "").toLowerCase();
    const identity = String(ident?.identity || "");
    if (kind === "plasma" || identity === "plasma_cloud") plasmaHazards++;
  }
  assert(plasmaHazards === 0, "tracked cloud hazards should not survive transition");
});

Deno.test("transition caches and restores explored tiles through repository", () => {
  clearAll();
  clearExplored();
  clearFloorCache();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);
  makePlayerAt(world, spawn.x, spawn.y);

  markExplored(spawn.x, spawn.y);
  assert(isExplored(spawn.x, spawn.y), "tile should start explored");

  transitionToDepth(world, 2, { x: spawn.x, y: spawn.y });
  assert(exploredFloorRepository.getSnapshot(1) instanceof Map, "depth 1 explored snapshot should be cached");
  assert(!isExplored(spawn.x, spawn.y), "depth 2 starts with different explored state");

  transitionToDepth(world, 1, { x: spawn.x, y: spawn.y });
  assert(isExplored(spawn.x, spawn.y), "returning restores explored tiles from repository cache");
});

Deno.test("clearFloorCache clears explored repository snapshots", () => {
  clearAll();
  clearExplored();
  clearFloorCache();
  const world = new World({ seed: 42 });
  const spawn = initDungeon(world);
  makePlayerAt(world, spawn.x, spawn.y);

  markExplored(spawn.x, spawn.y);
  transitionToDepth(world, 2, { x: spawn.x, y: spawn.y });
  assert(exploredFloorRepository.listDepths().length === 1, "precondition: one cached explored depth");

  clearFloorCache();
  assert(exploredFloorRepository.listDepths().length === 0, "clearFloorCache should clear explored repository");
});

Deno.test("inherited up stairs preserve exact world coordinates across dungeon scales", () => {
  const previousScale = dungeonConfig.dungeonScale;
  const scales = [0.1, 0.3, 1.0, 2.0];
  const seeds = [42, 777, 9999];

  try {
    for (const scale of scales) {
      dungeonConfig.dungeonScale = scale;
      for (const seed of seeds) {
        clearAll();
        const upperWorld = new World({ seed });
        const upperFloor = generateFloor(upperWorld, seed, 1);
        const priorDownStairPositions = upperFloor.downStairPositions.slice();

        clearAll();
        const lowerWorld = new World({ seed });
        const lowerFloor = generateFloor(lowerWorld, seed, 2, null, null, priorDownStairPositions);

        const reachable = new Set();
        const queue = [[lowerFloor.spawnX, lowerFloor.spawnY]];
        reachable.add(`${lowerFloor.spawnX},${lowerFloor.spawnY}`);
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            const key = `${nx},${ny}`;
            if (reachable.has(key)) continue;
            if (!isWalkable(nx, ny)) continue;
            reachable.add(key);
            queue.push([nx, ny]);
          }
        }

        for (const pos of priorDownStairPositions) {
          const tile = getTile(pos.x, pos.y);
          assert(tile === TILE_STAIR_UP, `scale ${scale} seed ${seed}: expected up stair at (${pos.x},${pos.y}), got tile ${tile}`);
          assert(isWalkable(pos.x, pos.y), `scale ${scale} seed ${seed}: inherited up stair at (${pos.x},${pos.y}) must be walkable`);
          assert(reachable.has(`${pos.x},${pos.y}`), `scale ${scale} seed ${seed}: inherited up stair at (${pos.x},${pos.y}) must be reachable`);
        }

        let inheritedCount = 0;
        forEachLoadedTile((x, y, tile) => {
          if (tile !== TILE_STAIR_UP) return;
          if (priorDownStairPositions.some((pos) => pos.x === x && pos.y === y)) inheritedCount++;
        });
        assert(inheritedCount === priorDownStairPositions.length, `scale ${scale} seed ${seed}: expected ${priorDownStairPositions.length} inherited up stairs, got ${inheritedCount}`);
      }
    }
  } finally {
    dungeonConfig.dungeonScale = previousScale;
    clearAll();
  }
});
