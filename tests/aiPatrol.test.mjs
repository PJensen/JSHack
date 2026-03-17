// tests/aiPatrol.test.mjs
// Directed patrol behavior: high-intelligence (> 3) unaware enemies maintain a
// persistent patrol heading rather than scurrying randomly.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }     from '../src/rules/components/Position.js';
import { Player }       from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction }      from '../src/rules/components/Faction.js';
import { Speed }        from '../src/rules/components/Speed.js';
import { MoveIntent }   from '../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { aiScurrySystem } from '../src/rules/systems/aiScurrySystem.js';
import { loadChunk, clearAll as clearTileMap } from '../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../src/rules/environment/dungeon/constants.js';

function loadFloorChunk() {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeWorld(seed = 1) {
  const world = new World({ seed });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  return world;
}

function addIdleEnemy(world, x, y, identity) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Speed, { actEvery: 1 });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
  });
  return id;
}

// ── Field existence ───────────────────────────────────────────────────────────

Deno.test("AggroState.patrolDx and patrolDy default to 0", () => {
  const world = new World({ seed: 1 });
  const id = world.create();
  world.add(id, AggroState, { alertLevel: AGGRO_LEVELS.unaware });
  const aggro = world.get(id, AggroState);
  assertEquals(aggro.patrolDx, 0, "patrolDx should default to 0");
  assertEquals(aggro.patrolDy, 0, "patrolDy should default to 0");
});

// ── Patrol when walkable tiles are available ──────────────────────────────────

Deno.test("smart enemy (goblin, intel 4) patrols when rand > 0.25 on open tiles", () => {
  clearTileMap();
  loadFloorChunk();
  try {
    const world = makeWorld(1);
    const goblin = addIdleEnemy(world, 8, 5, 'goblin');

    // 0.5 ≥ 0.25 → won't rest; 0.0 → DIRS[0] = {dx:0, dy:-1}
    let call = 0;
    world.rand = () => [0.5, 0.0][call++ % 2];

    aiScurrySystem(world);

    assert(world.has(goblin, MoveIntent), 'goblin should get a MoveIntent when patrolling');
    const aggro = world.get(goblin, AggroState);
    assert(aggro.patrolDx !== 0 || aggro.patrolDy !== 0, 'patrol direction should be stored');
  } finally {
    clearTileMap();
  }
});

Deno.test("smart enemy (goblin) does NOT patrol when rand < 0.25 (rest turn)", () => {
  clearTileMap();
  loadFloorChunk();
  try {
    const world = makeWorld(2);
    const goblin = addIdleEnemy(world, 8, 5, 'goblin');

    world.rand = () => 0.1; // 0.1 < 0.25 → rest

    aiScurrySystem(world);

    assert(!world.has(goblin, MoveIntent), 'goblin should rest when rand < 0.25');
  } finally {
    clearTileMap();
  }
});

// ── Patrol direction persistence ──────────────────────────────────────────────

Deno.test("patrol continues in the stored direction", () => {
  clearTileMap();
  loadFloorChunk();
  try {
    const world = makeWorld(3);
    const goblin = world.create();
    world.add(goblin, Position, { x: 8, y: 5 });
    world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
    world.add(goblin, Faction, { key: 'enemy' });
    world.add(goblin, Speed, { actEvery: 1 });
    world.add(goblin, AggroState, {
      alertLevel: AGGRO_LEVELS.unaware,
      lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
      patrolDx: 1, patrolDy: 0, // pre-set heading east
    });

    world.rand = () => 0.5; // never rest

    aiScurrySystem(world);

    const intent = world.get(goblin, MoveIntent);
    assert(intent, 'goblin should get MoveIntent');
    assertEquals(intent.dx, 1, 'goblin should continue east (pre-set patrol direction)');
    assertEquals(intent.dy, 0, 'goblin should continue east');
  } finally {
    clearTileMap();
  }
});

// ── Patrol bounces off walls ──────────────────────────────────────────────────

Deno.test("patrol turns away from a wall in the patrol direction", () => {
  clearTileMap();
  // Floor everywhere, wall column at x=9
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  for (let y = 0; y < CHUNK_SIZE; y++) tiles[y * CHUNK_SIZE + 9] = TILE_WALL;
  loadChunk(0, 0, tiles);
  try {
    const world = makeWorld(4);
    const goblin = world.create();
    world.add(goblin, Position, { x: 8, y: 5 });
    world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
    world.add(goblin, Faction, { key: 'enemy' });
    world.add(goblin, Speed, { actEvery: 1 });
    world.add(goblin, AggroState, {
      alertLevel: AGGRO_LEVELS.unaware,
      lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
      patrolDx: 1, patrolDy: 0, // heading east into the wall
    });

    // No rest; pick first alt direction
    let call = 0;
    world.rand = () => call++ === 0 ? 0.5 : 0.0;

    aiScurrySystem(world);

    assert(world.has(goblin, MoveIntent), 'goblin should still move after wall bounce');
    const intent = world.get(goblin, MoveIntent);
    assert(!(intent.dx === 1 && intent.dy === 0), 'goblin should NOT head east (wall there)');

    const aggro = world.get(goblin, AggroState);
    assert(!(aggro.patrolDx === 1 && aggro.patrolDy === 0), 'patrol direction should have changed');
  } finally {
    clearTileMap();
  }
});

// ── Low-intelligence creatures still scurry randomly ─────────────────────────

Deno.test("low-intelligence (rat, intel 2) still scurries randomly", () => {
  clearTileMap();
  loadFloorChunk();
  try {
    const world = makeWorld(5);
    const rat = addIdleEnemy(world, 6, 5, 'rat');

    // 0.9 ≥ 0.5 → won't rest; 0.0 → DIRS[0]
    let call = 0;
    world.rand = () => [0.9, 0.0][call++ % 2];

    aiScurrySystem(world);

    assert(world.has(rat, MoveIntent), 'rat should still scurry');

    // Scurry should NOT store patrolDx/patrolDy (only patrol does)
    const aggro = world.get(rat, AggroState);
    assertEquals(aggro.patrolDx, 0, 'scurry should not set patrolDx');
    assertEquals(aggro.patrolDy, 0, 'scurry should not set patrolDy');
  } finally {
    clearTileMap();
  }
});
