import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { ChunkMeta } from '../src/rules/components/ChunkMeta.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { chunkManagementSystem } from '../src/rules/systems/chunkManagementSystem.js';
import { transitionToDepth } from '../src/rules/environment/dungeon/transition.js';

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
    chunkLoadRadius: 1, // smaller radius for faster tests
  });
  return id;
}

function countChunks(world) {
  let n = 0;
  for (const [_id] of world.query(ChunkMeta)) n++;
  return n;
}

function countTerrain(world) {
  let n = 0;
  for (const [id] of world.query(Position)) {
    if (world.has(id, Terrain)) n++;
  }
  return n;
}

Deno.test("transitionToDepth unloads all chunks", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  chunkManagementSystem(world);
  assert(countChunks(world) > 0, 'chunks loaded before transition');
  assert(countTerrain(world) > 0, 'terrain exists before transition');

  transitionToDepth(world, 2, { x: 10, y: 10 });

  assert(countChunks(world) === 0, 'all chunks unloaded after transition');
  assert(countTerrain(world) === 0, 'all terrain destroyed after transition');
});

Deno.test("transitionToDepth updates DungeonState.currentDepth", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  transitionToDepth(world, 5, { x: 0, y: 0 });

  for (const [_id, ds] of world.query(DungeonState)) {
    assert(ds.currentDepth === 5, `depth updated to 5, got ${ds.currentDepth}`);
  }
});

Deno.test("transitionToDepth moves player to destination", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  transitionToDepth(world, 2, { x: 100, y: -50 });

  for (const [id] of world.query(Player)) {
    const pos = world.get(id, Position);
    assert(pos.x === 100 && pos.y === -50, `player at (100,-50), got (${pos.x},${pos.y})`);
  }
});

Deno.test("transitionToDepth emits dungeon:transitioned event", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  const events = [];
  world.on('dungeon:transitioned', e => events.push(e));

  transitionToDepth(world, 3, { x: 5, y: 5 });

  assert(events.length === 1, 'event emitted');
  assert(events[0].depth === 3, 'correct depth');
  assert(events[0].pos.x === 5 && events[0].pos.y === 5, 'correct pos');
});

Deno.test("chunks regenerate correctly on new floor after transition", () => {
  const world = new World({ seed: 42 });
  makePlayerAt(world, 0, 0);
  makeDungeonState(world, 42, 1);

  // Load floor 1
  chunkManagementSystem(world);
  const terrainFloor1 = countTerrain(world);

  // Transition to floor 2
  transitionToDepth(world, 2, { x: 0, y: 0 });
  chunkManagementSystem(world);
  const terrainFloor2 = countTerrain(world);

  // Both floors should have terrain, but different layouts
  assert(terrainFloor1 > 0, 'floor 1 has terrain');
  assert(terrainFloor2 > 0, 'floor 2 has terrain');
  assert(countChunks(world) > 0, 'chunks loaded on floor 2');
});
