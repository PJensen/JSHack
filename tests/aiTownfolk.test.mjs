// tests/aiTownfolk.test.mjs
// Townfolk NPC AI: state machine transitions, tile effects, depth gating.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position }       from "../src/rules/components/Position.js";
import { Player }         from "../src/rules/components/Player.js";
import { NamedIdentity }  from "../src/rules/components/NamedIdentity.js";
import { Faction }        from "../src/rules/components/Faction.js";
import { MoveIntent }     from "../src/rules/components/Intents/MoveIntent.js";
import { DungeonState }   from "../src/rules/components/DungeonState.js";
import { TownfolkJob, TOWNFOLK_STATES, TOWNFOLK_ROLES } from "../src/rules/components/TownfolkJob.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { aiTownfolkSystem } from "../src/rules/systems/aiTownfolkSystem.js";
import { aiChaseSystem }    from "../src/rules/systems/aiChaseSystem.js";
import { clearAll, loadChunk, getTile, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import {
  CHUNK_SIZE, TILE_FLOOR, TILE_TREE, TILE_GRASS, TILE_STAIR_DOWN,
} from "../src/rules/environment/dungeon/constants.js";
import { markDestroyedTile } from "../src/rules/utils/destroyedTiles.js";

// ── helpers ────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);

  const world = new World({ seed });
  // Add DungeonState at depth 0 (overworld)
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: seed,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  // Add player
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });

  return world;
}

function addTownfolk(world, x, y, role, opts = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: role, identity: `townfolk_${role}` });
  world.add(id, Faction, { key: "townfolk" });
  world.add(id, TownfolkJob, {
    role,
    state:        opts.state        ?? TOWNFOLK_STATES.idle,
    homeX:        opts.homeX        ?? x,
    homeY:        opts.homeY        ?? y,
    targetX:      opts.targetX      ?? x,
    targetY:      opts.targetY      ?? y,
    workTurns:    opts.workTurns    ?? 0,
    idleTurns:    opts.idleTurns    ?? 0,
    workSiteKind: opts.workSiteKind ?? "",
    stuckTurns:   opts.stuckTurns   ?? 0,
  });
  return id;
}

// ── tests ──────────────────────────────────────────────────────────

Deno.test("townfolk NPC is NOT targeted by enemy AI chase system", () => {
  const world = makeWorld(1);

  const npc = addTownfolk(world, 6, 5, "villager");
  // Also add AggroState since aiChaseSystem queries for it
  world.add(npc, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
  });

  aiChaseSystem(world);

  assert(!world.has(npc, MoveIntent), "townfolk should not be moved by enemy AI");
});

Deno.test("idle townfolk transitions to walking when idleTurns reaches 0", () => {
  const world = makeWorld(2);
  world.rand = () => 0.5;

  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.idle,
    idleTurns: 0,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.walking, "should transition to walking");
});

Deno.test("idle townfolk does NOT transition when idleTurns > 0", () => {
  const world = makeWorld(3);

  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.idle,
    idleTurns: 10,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.idle, "should stay idle");
  assertEquals(job.idleTurns, 9, "idleTurns should decrement by 1");
});

Deno.test("walking townfolk issues MoveIntent toward target", () => {
  const world = makeWorld(4);

  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.walking,
    targetX: 10,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  assert(world.has(npc, MoveIntent), "walking NPC should get a MoveIntent");
  const intent = world.get(npc, MoveIntent);
  assertEquals(intent.dx, 1, "should move east toward target");
  assertEquals(intent.dy, 0, "should not move vertically");
});

Deno.test("walking townfolk transitions to working when at target", () => {
  const world = makeWorld(5);
  world.rand = () => 0.5;

  const npc = addTownfolk(world, 8, 5, "villager", {
    state: TOWNFOLK_STATES.walking,
    targetX: 8,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.working, "should transition to working at target");
  assert(job.workTurns > 0, "workTurns should be set");
});

Deno.test("working townfolk transitions to returning when workTurns reaches 0", () => {
  const world = makeWorld(6);

  const npc = addTownfolk(world, 8, 5, "villager", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "wander",
    homeX: 6,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning, "should transition to returning");
  assertEquals(job.targetX, 6, "target should be set to homeX");
});

Deno.test("returning townfolk transitions to idle when near home", () => {
  const world = makeWorld(7);
  world.rand = () => 0.5;

  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.returning,
    homeX: 6,
    homeY: 5,
    targetX: 6,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.idle, "should transition to idle at home");
  assert(job.idleTurns > 0, "idleTurns should be set for next cycle");
});

Deno.test("woodcutter chops adjacent tree tile on work completion", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  // Place a tree at (8, 5)
  tiles[5 * CHUNK_SIZE + 8] = TILE_TREE;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 8 });
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: 8, currentDepth: 0, profileType: "overworld",
    floorEntityIds: [], downStairPositions: [],
  });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });

  // Woodcutter at (7, 5), adjacent to tree at (8, 5)
  const npc = addTownfolk(world, 7, 5, "woodcutter", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "chop",
    targetX: 7,
    targetY: 5,
    homeX: 3,
    homeY: 5,
  });

  let chopped = false;
  world.on("townfolk:chopped", () => { chopped = true; });

  aiTownfolkSystem(world);

  assertEquals(getTile(8, 5), TILE_GRASS, "tree should be replaced with grass");
  assert(chopped, "townfolk:chopped event should fire");
  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning, "should be returning with wood");
});

Deno.test("mason repairs destroyed tile on work completion", () => {
  const world = makeWorld(9);

  // Mark a tile as destroyed
  markDestroyedTile(world, {
    x: 8, y: 5,
    originalTile: TILE_TREE,
    currentTile: TILE_FLOOR,
    burnedKind: "tree",
    cause: "fire",
  });
  // Set the tile to match the destroyed record
  setTile(8, 5, TILE_FLOOR);

  const npc = addTownfolk(world, 8, 5, "mason", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "repair",
    targetX: 8,
    targetY: 5,
  });

  let repaired = false;
  world.on("townfolk:repaired", () => { repaired = true; });

  aiTownfolkSystem(world);

  assertEquals(getTile(8, 5), TILE_TREE, "tile should be restored to original");
  assert(repaired, "townfolk:repaired event should fire");
});

Deno.test("townfolk system does nothing on non-overworld depth", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 10 });
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: 10, currentDepth: 3, profileType: "caves",
    floorEntityIds: [], downStairPositions: [],
  });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });

  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.walking,
    targetX: 10,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  assert(!world.has(npc, MoveIntent), "no action on dungeon floor");
  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.walking, "state should be unchanged");
});

Deno.test("walking townfolk refuses to step onto stair tile", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  // Place stair at (7, 5) — directly between NPC and target
  tiles[5 * CHUNK_SIZE + 7] = TILE_STAIR_DOWN;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 11 });
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: 11, currentDepth: 0, profileType: "overworld",
    floorEntityIds: [], downStairPositions: [],
  });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });

  // NPC at (6, 5) wants to walk east to (10, 5) — stair at (7, 5) blocks
  const npc = addTownfolk(world, 6, 5, "villager", {
    state: TOWNFOLK_STATES.walking,
    targetX: 10,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  if (world.has(npc, MoveIntent)) {
    const intent = world.get(npc, MoveIntent);
    // Should NOT step east onto the stair
    const nextX = 6 + intent.dx;
    const nextY = 5 + intent.dy;
    assert(
      getTile(nextX, nextY) !== TILE_STAIR_DOWN,
      "NPC should not step onto stair tile"
    );
  }
  // It's also valid for the NPC to have no MoveIntent (stuck)
});

Deno.test("mason idle picks up destroyed tile as target", () => {
  const world = makeWorld(12);
  world.rand = () => 0.5;

  markDestroyedTile(world, {
    x: 10, y: 5,
    originalTile: TILE_TREE,
    currentTile: TILE_FLOOR,
    burnedKind: "tree",
  });

  const npc = addTownfolk(world, 8, 5, "mason", {
    state: TOWNFOLK_STATES.idle,
    idleTurns: 0,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.walking, "mason should start walking to repair site");
  assertEquals(job.targetX, 10, "targetX should be the destroyed tile X");
  assertEquals(job.targetY, 5, "targetY should be the destroyed tile Y");
  assertEquals(job.workSiteKind, "repair", "workSiteKind should be repair");
});

Deno.test("miner returns home carrying ore after work", () => {
  const world = makeWorld(13);

  let mined = false;
  let carrying = false;
  world.on("townfolk:mined", () => { mined = true; });
  world.on("townfolk:carrying", ({ resource }) => { carrying = resource === "ore"; });

  const npc = addTownfolk(world, 10, 5, "miner", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "mine",
    homeX: 5,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  assert(mined, "townfolk:mined event should fire");
  assert(carrying, "townfolk:carrying event should fire with resource 'ore'");
  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning, "miner should be returning home");
  assertEquals(job.targetX, 5, "target should be homeX");
});
