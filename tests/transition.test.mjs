import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { DungeonState } from '../src/rules/components/DungeonState.js';
import { transitionToDepth } from '../src/rules/environment/dungeon/transition.js';
import { initDungeon } from '../src/rules/environment/dungeon/index.js';
import { loadedChunkCount, clearAll } from '../src/rules/environment/dungeon/tileMap.js';

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
