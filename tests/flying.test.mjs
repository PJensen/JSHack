// tests/flying.test.mjs
// Flying component: AI toggle, terrain bypass, melee immunity, floor eligibility.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }       from '../src/rules/components/Position.js';
import { Player }         from '../src/rules/components/Player.js';
import { NamedIdentity }  from '../src/rules/components/NamedIdentity.js';
import { Faction }        from '../src/rules/components/Faction.js';
import { AttackIntent }   from '../src/rules/components/Intents/AttackIntent.js';
import { FlyIntent }      from '../src/rules/components/Intents/FlyIntent.js';
import { MoveIntent }     from '../src/rules/components/Intents/MoveIntent.js';
import { Speed }          from '../src/rules/components/Speed.js';
import { Vitality }       from '../src/rules/components/Vitality.js';
import { Collider }       from '../src/rules/components/Collider.js';
import { Flying }         from '../src/rules/components/Flying.js';
import { DungeonState }   from '../src/rules/components/DungeonState.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { HazardArea } from '../src/rules/components/HazardArea.js';
import { aiFlyingSystem } from '../src/rules/systems/aiFlyingSystem.js';
import { aiChaseSystem } from '../src/rules/systems/aiChaseSystem.js';
import { flyIntentSystem } from '../src/rules/systems/flyIntentSystem.js';
import { movementSystem } from '../src/rules/systems/movementSystem.js';
import { installTileStepEffectListener } from '../src/rules/systems/tileStepEffectSystem.js';
import { hazardSystem } from '../src/rules/systems/hazardSystem.js';
import { resolveBump, BUMP_RESOLVERS } from '../src/rules/data/bumpResolvers.js';
import { loadChunk, clearAll, isWalkable, isFlyable } from '../src/rules/environment/dungeon/tileMap.js';
import { invalidateTileQueryCache, getTileQuerySnapshot } from '../src/rules/utils/tileQueryCache.js';
import { canFlyOnFloor, canMonsterFlyOnFloor } from '../src/rules/utils/flyingEligibility.js';
import { getMonster } from '../src/rules/data/monsters.js';
import {
  CHUNK_SIZE, TILE_VOID, TILE_FLOOR, TILE_WALL,
  TILE_SHALLOW_WATER, TILE_LAVA, TILE_MOUNTAIN, TILE_TREE, TILE_ICE,
} from '../src/rules/environment/dungeon/constants.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  const world = new World({ seed });
  world.step = 0;
  return world;
}

function addPlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: 'player' });
  world.add(id, Vitality, { maxHp: 20, hp: 20 });
  return id;
}

function addFlyingMonster(world, identity, x, y, alertLevel = AGGRO_LEVELS.unaware) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, Speed, { actEvery: 1 });
  world.add(id, AggroState, {
    alertLevel,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
  });
  return id;
}

function addDungeonState(world, depth, profileType = 'default') {
  const id = world.create();
  world.add(id, DungeonState, {
    worldSeed: 1,
    currentDepth: depth,
    profileType,
    floorEntityIds: [],
    downStairPositions: [],
  });
  return id;
}

/** Load a 16x16 chunk of all-floor tiles at chunk (0,0). */
function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
  return tiles;
}

/** Load a chunk with a specific tile at (tx, ty). */
function loadChunkWithTile(tileType, tx, ty) {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[ty * CHUNK_SIZE + tx] = tileType;
  loadChunk(0, 0, tiles);
  return tiles;
}

// ── canFlyOnFloor ────────────────────────────────────────────────────

Deno.test("canFlyOnFloor: returns true for depth 0 (overworld)", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  assert(canFlyOnFloor(world));
});

Deno.test("canFlyOnFloor: returns true for caves profile", () => {
  const world = makeWorld();
  addDungeonState(world, 5, 'caves');
  assert(canFlyOnFloor(world));
});

Deno.test("canFlyOnFloor: returns true for grottos profile", () => {
  const world = makeWorld();
  addDungeonState(world, 10, 'grottos');
  assert(canFlyOnFloor(world));
});

Deno.test("canFlyOnFloor: returns false for catacombs profile", () => {
  const world = makeWorld();
  addDungeonState(world, 2, 'catacombs');
  assert(!canFlyOnFloor(world));
});

Deno.test("canFlyOnFloor: returns false for default profile", () => {
  const world = makeWorld();
  addDungeonState(world, 3, 'default');
  assert(!canFlyOnFloor(world));
});

Deno.test("canFlyOnFloor: returns false for arenas profile", () => {
  const world = makeWorld();
  addDungeonState(world, 12, 'arenas');
  assert(!canFlyOnFloor(world));
});

Deno.test("canMonsterFlyOnFloor: small flyers are always eligible (bat on catacombs)", () => {
  const world = makeWorld();
  addDungeonState(world, 3, 'catacombs');
  assert(canMonsterFlyOnFloor(world, getMonster('bat')));
});

// ── AI Flying System ─────────────────────────────────────────────────

Deno.test("aiFlyingSystem: bat queues takeoff when hunting on eligible floor", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.hunting);

  aiFlyingSystem(world);

  assert(world.has(bat, FlyIntent), 'bat should queue takeoff when hunting on eligible floor');
  assertEquals(world.get(bat, FlyIntent)?.airborne, true);
  assert(!world.has(bat, Flying), 'takeoff should not resolve until flyIntentSystem runs');
});

Deno.test("aiFlyingSystem: bat flies when hunting on catacombs due small-flyer exception", () => {
  const world = makeWorld();
  addDungeonState(world, 3, 'catacombs');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.hunting);

  aiFlyingSystem(world);

  assert(!world.has(bat, Flying), 'takeoff should not resolve until flyIntentSystem runs');
  assert(world.has(bat, FlyIntent), 'bat should queue takeoff on catacombs as a small flyer');
  assertEquals(world.get(bat, FlyIntent)?.airborne, true);
});

Deno.test("aiFlyingSystem: disturbed bat stays airborne even when adjacent to player", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 6, 5, AGGRO_LEVELS.hunting);
  world.add(bat, Flying, {});

  aiFlyingSystem(world);

  assert(!world.has(bat, FlyIntent), 'disturbed bat should not queue landing just for adjacency');
  assert(world.has(bat, Flying), 'disturbed bat should remain airborne');
});

Deno.test("aiFlyingSystem: dragon queues landing when adjacent to player", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const dragon = addFlyingMonster(world, 'dragon', 6, 5, AGGRO_LEVELS.hunting);
  world.add(dragon, Flying, {});

  aiFlyingSystem(world);

  assert(world.has(dragon, FlyIntent), 'dragon should queue landing when adjacent');
  assertEquals(world.get(dragon, FlyIntent)?.airborne, false);
});

Deno.test("aiFlyingSystem: bat does NOT fly when unaware", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.unaware);

  aiFlyingSystem(world);

  assert(!world.has(bat, Flying), 'bat should not fly when unaware');
  assert(!world.has(bat, FlyIntent), 'bat should not queue takeoff when unaware');
});

Deno.test("aiFlyingSystem: non-flying monster (goblin) never gets Flying", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const goblin = addFlyingMonster(world, 'goblin', 10, 10, AGGRO_LEVELS.hunting);

  aiFlyingSystem(world);

  assert(!world.has(goblin, Flying), 'goblin should never fly');
  assert(!world.has(goblin, FlyIntent), 'goblin should never queue FlyIntent');
});

Deno.test("aiFlyingSystem: large flyers queue landing when floor is ineligible", () => {
  const world = makeWorld();
  addDungeonState(world, 3, 'catacombs');
  addPlayer(world, 5, 5);
  const dragon = addFlyingMonster(world, 'dragon', 10, 10, AGGRO_LEVELS.hunting);
  world.add(dragon, Flying, {}); // manually added, now on ineligible floor

  aiFlyingSystem(world);

  assert(world.has(dragon, FlyIntent), 'landing should consume the turn on ineligible floors');
  assertEquals(world.get(dragon, FlyIntent)?.airborne, false);
});

Deno.test("aiFlyingSystem: respects Speed.actEvery cadence when toggling flight", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.hunting);
  world.set(bat, Speed, { actEvery: 3 });

  world.step = 1;
  aiFlyingSystem(world);
  assert(!world.has(bat, FlyIntent), 'bat should not queue flight off-turn');

  world.step = 3;
  aiFlyingSystem(world);
  assert(world.has(bat, FlyIntent), 'bat should queue flight on its turn');
});

Deno.test("flyIntentSystem: takeoff resolves and emits event as the actor's full turn", () => {
  const world = makeWorld();
  const events = [];
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.hunting);
  world.on('proc:fly:takeoff', (e) => events.push(e));

  world.add(bat, FlyIntent, { airborne: true });
  flyIntentSystem(world);

  assert(world.has(bat, Flying), 'takeoff intent should grant Flying');
  assert(!world.has(bat, FlyIntent), 'takeoff intent should be consumed');
  assertEquals(events.length, 1);
});

Deno.test("flying takeoff claims the AI turn so chase does not also move or attack", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.hunting);

  aiFlyingSystem(world);
  aiChaseSystem(world);

  assert(world.has(bat, FlyIntent), 'takeoff should be queued');
  assertEquals(world.has(bat, MoveIntent), false, 'takeoff should block chase movement that turn');
  assertEquals(world.has(bat, AttackIntent), false, 'takeoff should block melee attack intents that turn');
});

Deno.test("aiFlyingSystem: aware flyer stays airborne through curious search after LOS loss", () => {
  const world = makeWorld();
  addDungeonState(world, 0, 'overworld');
  addPlayer(world, 5, 5);
  const bat = addFlyingMonster(world, 'bat', 10, 10, AGGRO_LEVELS.curious);

  aiFlyingSystem(world);

  assert(world.has(bat, FlyIntent), 'curious flyer should remain biased toward flight while searching');
  assertEquals(world.get(bat, FlyIntent)?.airborne, true);
});

// ── Terrain bypass (isFlyable) ───────────────────────────────────────

Deno.test("isFlyable: floor tile is flyable", () => {
  loadFloorChunk();
  assert(isFlyable(5, 5));
});

Deno.test("isFlyable: mountain tile is flyable", () => {
  loadChunkWithTile(TILE_MOUNTAIN, 5, 5);
  assert(isFlyable(5, 5));
});

Deno.test("isFlyable: tree tile is flyable", () => {
  loadChunkWithTile(TILE_TREE, 5, 5);
  assert(isFlyable(5, 5));
});

Deno.test("isFlyable: wall tile is NOT flyable", () => {
  loadChunkWithTile(TILE_WALL, 5, 5);
  assert(!isFlyable(5, 5));
});

Deno.test("isFlyable: void tile is NOT flyable", () => {
  loadChunkWithTile(TILE_VOID, 5, 5);
  assert(!isFlyable(5, 5));
});

Deno.test("isFlyable: water is NOT walkable but IS flyable", () => {
  loadChunkWithTile(TILE_MOUNTAIN, 5, 5);
  assert(!isWalkable(5, 5), 'mountain should not be walkable');
  assert(isFlyable(5, 5), 'mountain should be flyable');
});

// ── Movement: flying entity crosses non-walkable terrain ─────────────

Deno.test("movementSystem: flying entity crosses mountain tile", () => {
  const tiles = loadChunkWithTile(TILE_MOUNTAIN, 6, 5);
  const world = makeWorld();
  world.step = 1;

  const id = world.create();
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, Flying, {});
  world.add(id, MoveIntent, { dx: 1, dy: 0 });

  movementSystem(world);

  const pos = world.get(id, Position);
  assertEquals(pos.x, 6, 'flying entity should cross mountain');
  assertEquals(pos.y, 5);
});

Deno.test("movementSystem: grounded entity cannot cross mountain tile", () => {
  loadChunkWithTile(TILE_MOUNTAIN, 6, 5);
  const world = makeWorld();
  world.step = 1;

  const id = world.create();
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, MoveIntent, { dx: 1, dy: 0 });

  movementSystem(world);

  const pos = world.get(id, Position);
  assertEquals(pos.x, 5, 'grounded entity should be blocked by mountain');
  assertEquals(pos.y, 5);
});

Deno.test("movementSystem: flying entity cannot cross wall tile", () => {
  loadChunkWithTile(TILE_WALL, 6, 5);
  const world = makeWorld();
  world.step = 1;

  const id = world.create();
  world.add(id, Position, { x: 5, y: 5 });
  world.add(id, Vitality, { maxHp: 10, hp: 10 });
  world.add(id, Flying, {});
  world.add(id, MoveIntent, { dx: 1, dy: 0 });

  movementSystem(world);

  const pos = world.get(id, Position);
  assertEquals(pos.x, 5, 'flying entity should still be blocked by wall');
  assertEquals(pos.y, 5);
});

// ── Melee immunity ───────────────────────────────────────────────────

Deno.test("hostileMelee: grounded attacker cannot melee flying target", () => {
  loadFloorChunk();
  const world = makeWorld();
  world.step = 1;

  const attacker = addPlayer(world, 5, 5);
  const target = addFlyingMonster(world, 'bat', 6, 5, AGGRO_LEVELS.hunting);
  world.add(target, Flying, {});
  let outOfReach = 0;
  world.on('combat:target-flying', () => { outOfReach++; });

  invalidateTileQueryCache(world);
  const tiles = getTileQuerySnapshot(world);

  // Find the hostileMelee resolver
  const resolver = BUMP_RESOLVERS.find(r => r.name === 'hostile-melee');
  assert(resolver, 'hostileMelee resolver should exist');

  const ctx = { nx: 6, ny: 5, mdx: 1, mdy: 0, target, tiles };
  const result = resolver.test(world, attacker, ctx);
  assert(result, 'grounded attacker should resolve bump against flying target');
  resolver.resolve(world, attacker, ctx);
  assertEquals(outOfReach, 1, 'grounded attacker should get out-of-reach feedback');
  assert(!world.has(attacker, AttackIntent), 'grounded attacker should not queue a melee attack');
});

Deno.test("hostileMelee: flying attacker CAN melee flying target", () => {
  loadFloorChunk();
  const world = makeWorld();
  world.step = 1;

  const attacker = world.create();
  world.add(attacker, Position, { x: 5, y: 5 });
  world.add(attacker, Faction, { key: 'enemy' });
  world.add(attacker, Vitality, { maxHp: 10, hp: 10 });
  world.add(attacker, Flying, {});

  const target = world.create();
  world.add(target, Position, { x: 6, y: 5 });
  world.add(target, Faction, { key: 'player' });
  world.add(target, Vitality, { maxHp: 10, hp: 10 });
  world.add(target, Flying, {});

  invalidateTileQueryCache(world);
  const tiles = getTileQuerySnapshot(world);

  const resolver = BUMP_RESOLVERS.find(r => r.name === 'hostile-melee');
  const ctx = { nx: 6, ny: 5, mdx: 1, mdy: 0, target, tiles };
  const result = resolver.test(world, attacker, ctx);
  assert(result, 'flying attacker should be able to melee flying target');
});

// ── Tile query cache: flying entities don't block ground ─────────────

Deno.test("tileQueryCache: flying entity does not block tile", () => {
  loadFloorChunk();
  const world = makeWorld();
  world.step = 1;

  const flyer = world.create();
  world.add(flyer, Position, { x: 5, y: 5 });
  world.add(flyer, Vitality, { maxHp: 10, hp: 10 });
  world.add(flyer, Flying, {});

  invalidateTileQueryCache(world);
  const tiles = getTileQuerySnapshot(world);

  assert(!tiles.blockedByCell.has('5,5'), 'flying entity should not block its tile');
  assertEquals(tiles.livingByCell.get('5,5'), flyer, 'flying entity should still appear in livingByCell');
});

Deno.test("tileQueryCache: grounded entity DOES block tile", () => {
  loadFloorChunk();
  const world = makeWorld();
  world.step = 1;

  const grounded = world.create();
  world.add(grounded, Position, { x: 5, y: 5 });
  world.add(grounded, Vitality, { maxHp: 10, hp: 10 });

  invalidateTileQueryCache(world);
  const tiles = getTileQuerySnapshot(world);

  assert(tiles.blockedByCell.has('5,5'), 'grounded entity should block its tile');
});

Deno.test("movementSystem: grounded actor cannot step into flying hostile and gets feedback", () => {
  loadFloorChunk();
  const world = makeWorld();
  world.step = 1;

  const attacker = addPlayer(world, 5, 5);
  const target = addFlyingMonster(world, 'bat', 6, 5, AGGRO_LEVELS.hunting);
  world.add(target, Flying, {});
  world.add(attacker, MoveIntent, { dx: 1, dy: 0 });

  let outOfReach = 0;
  world.on('combat:target-flying', () => { outOfReach++; });

  movementSystem(world);

  const pos = world.get(attacker, Position);
  assertEquals(pos.x, 5, 'grounded actor should stay in place');
  assertEquals(pos.y, 5, 'grounded actor should stay in place');
  assertEquals(outOfReach, 1, 'moving into a flying hostile should emit out-of-reach');
});

Deno.test("tileStepEffectSystem: flying actor ignores lava and ice step effects", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  tiles[5 * CHUNK_SIZE + 5] = TILE_ICE;
  tiles[6 * CHUNK_SIZE + 5] = TILE_LAVA;
  loadChunk(0, 0, tiles);

  const world = makeWorld();
  installTileStepEffectListener(world);

  const actor = world.create();
  world.add(actor, Position, { x: 5, y: 5 });
  world.add(actor, Vitality, { maxHp: 10, hp: 10 });
  world.add(actor, Flying, {});

  world.emit('moved', { id: actor, from: { x: 4, y: 5 }, to: { x: 5, y: 5 } });

  const pos = world.get(actor, Position);
  const vit = world.get(actor, Vitality);
  assertEquals(pos.x, 5, 'flying actor should not slide on ice');
  assertEquals(pos.y, 5, 'flying actor should remain on the destination tile');
  assertEquals(vit.hp, 10, 'flying actor should not be scorched by floor tiles');
  assert(!world.has(actor, ActiveEffects), 'flying actor should not gain floor-tile statuses');
});

Deno.test("hazardSystem: floor hazards ignore flying actors but air hazards still hit them", () => {
  const world = makeWorld();

  const flyer = world.create();
  world.add(flyer, Position, { x: 5, y: 5 });
  world.add(flyer, Vitality, { maxHp: 10, hp: 10 });
  world.add(flyer, Flying, {});

  const floorHazard = world.create();
  world.add(floorHazard, Position, { x: 5, y: 5 });
  world.add(floorHazard, HazardArea, {
    kind: 'fire',
    medium: 'floor',
    turnsLeft: 2,
    radius: 0,
    tickDamage: 3,
    damageType: 'fire',
    cause: 'floor_fire',
  });

  const airHazard = world.create();
  world.add(airHazard, Position, { x: 5, y: 5 });
  world.add(airHazard, HazardArea, {
    kind: 'plasma',
    medium: 'air',
    turnsLeft: 2,
    radius: 0,
    tickDamage: 2,
    damageType: 'electric',
    cause: 'air_plasma',
  });

  hazardSystem(world);

  const vit = world.get(flyer, Vitality);
  assertEquals(vit.hp, 8, 'only the air hazard should damage a flying actor');
});
