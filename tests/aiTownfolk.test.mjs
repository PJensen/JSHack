import "./helpers/installContentCatalog.mjs";
// tests/aiTownfolk.test.mjs
// Townfolk NPC AI: state machine transitions, tile effects, depth gating.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position }       from "../src/rules/components/Position.js";
import { Player }         from "../src/rules/components/Player.js";
import { NamedIdentity }  from "../src/rules/components/NamedIdentity.js";
import { Faction }        from "../src/rules/components/Faction.js";
import { Collider }       from "../src/rules/components/Collider.js";
import { DoorState }      from "../src/rules/components/DoorState.js";
import { DoorLock }       from "../src/rules/components/DoorLock.js";
import { DoorKey }        from "../src/rules/components/DoorKey.js";
import { Interactable }   from "../src/rules/components/Interactable.js";
import { MoveIntent }     from "../src/rules/components/Intents/MoveIntent.js";
import { AttackIntent }   from "../src/rules/components/Intents/AttackIntent.js";
import { DungeonState }   from "../src/rules/components/DungeonState.js";
import { ObjectState } from "../src/rules/components/ObjectState.js";
import { TownfolkJob, TOWNFOLK_STATES, TOWNFOLK_ROLES } from "../src/rules/components/TownfolkJob.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Brain } from "../src/rules/components/Brain.js";
import { NamedIdentity as ItemNamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { aiTownfolkSystem, installTownfolkDoorListener, installBellListener } from "../src/rules/systems/aiTownfolkSystem.js";
import { aiChaseSystem }    from "../src/rules/systems/aiChaseSystem.js";
import { clearAll, loadChunk, getTile, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import {
  CHUNK_SIZE, TILE_FLOOR, TILE_TREE, TILE_GRASS, TILE_STAIR_DOWN, TILE_WALL, TILE_DOOR, TILE_WATER,
} from "../src/rules/environment/dungeon/constants.js";
import { markDestroyedTile } from "../src/rules/utils/destroyedTiles.js";
import { addToInventory, inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { HarvestNode } from "../src/rules/components/HarvestNode.js";
import { Material } from "../src/rules/components/Material.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";

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
  world.add(id, Inventory, { capacity: 6 });
  world.add(id, Equipment, {});
  world.add(id, Brain, { intelligence: opts.intelligence ?? 10, visionRange: opts.visionRange ?? 8 });
  world.add(id, TownfolkJob, {
    role,
    state:        opts.state        ?? TOWNFOLK_STATES.idle,
    scheduleEnabled: opts.scheduleEnabled ?? false,
    homeX:        opts.homeX        ?? x,
    homeY:        opts.homeY        ?? y,
    bedX:         opts.bedX         ?? x,
    bedY:         opts.bedY         ?? y,
    workX:        opts.workX        ?? x,
    workY:        opts.workY        ?? y,
    workAuxX:     opts.workAuxX     ?? x,
    workAuxY:     opts.workAuxY     ?? y,
    pubX:         opts.pubX         ?? x,
    pubY:         opts.pubY         ?? y,
    targetX:      opts.targetX      ?? x,
    targetY:      opts.targetY      ?? y,
    workTurns:    opts.workTurns    ?? 0,
    idleTurns:    opts.idleTurns    ?? 0,
    workSiteKind: opts.workSiteKind ?? "",
    routineKind:  opts.routineKind  ?? "",
    lastPhase:    opts.lastPhase    ?? "",
    carrying:     opts.carrying     ?? "",
    carryCount:   opts.carryCount   ?? 0,
    carryMax:     opts.carryMax     ?? (role === "farmer" ? 4 : role === "herbalist" ? 3 : 0),
    deliverX:     opts.deliverX     ?? 0,
    deliverY:     opts.deliverY     ?? 0,
    stuckTurns:   opts.stuckTurns   ?? 0,
  });
  if (role === "miner") {
    const pickId = createItemById(world, "iron_pickaxe");
    addToInventory(world, id, pickId);
    world.set(id, Equipment, { ...world.get(id, Equipment), weapon: pickId });
  }
  if (role === "woodcutter") {
    const hatchetId = createItemById(world, "tool_hatchet");
    addToInventory(world, id, hatchetId);
    world.set(id, Equipment, { ...world.get(id, Equipment), weapon: hatchetId });
  }
  return id;
}

function addBell(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Town Bell", identity: "bell" });
  world.add(id, Collider, { solid: true, blocksSight: false });
  world.add(id, Interactable, { action: "ringBell", params: null });
  return id;
}

function addEnemy(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Cave Bear", identity: "cave_bear" });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, Collider, { solid: true, blocksSight: false });
  return id;
}

function countInventory(world, ownerId, identity) {
  let total = 0;
  for (const itemId of inventoryItems(world, ownerId)) {
    const ni = world.get(itemId, ItemNamedIdentity);
    if (ni?.identity === identity) total++;
  }
  return total;
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

Deno.test("town breach sighting assigns a witness to physically run to the bell", () => {
  const world = makeWorld(400);
  addBell(world, 12, 5);
  const witness = addTownfolk(world, 6, 5, "villager", { idleTurns: 20 });
  const enemy = addEnemy(world, 6, 7);

  const bellEvents = [];
  world.on("bell:rung", (ev) => bellEvents.push(ev));

  aiTownfolkSystem(world);

  const job = world.get(witness, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.alarming, "witness should become the bell runner");
  assertEquals(job.targetX, 12, "bell runner should target the existing bell");
  assertEquals(job.targetY, 5, "bell runner should target the existing bell");
  assert(world.has(witness, MoveIntent), "bell runner should walk toward the bell");
  assertEquals(bellEvents.length, 0, "sighting should not ring the bell until the NPC reaches it");
  assert(enemy > 0, "enemy exists for sighting");
});

Deno.test("town breach sighting requires townfolk Brain perception", () => {
  const world = makeWorld(4001);
  addBell(world, 12, 5);
  const witness = addTownfolk(world, 6, 5, "villager", { idleTurns: 20 });
  addEnemy(world, 6, 7);
  world.remove(witness, Brain);

  aiTownfolkSystem(world);

  const job = world.get(witness, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.idle, "townfolk without Brain should not become a bell runner");
  assert(!world.has(witness, MoveIntent), "townfolk without Brain perception should not move to the bell");
});

Deno.test("town breach sighting uses Brain vision range as the range authority", () => {
  const world = makeWorld(4002);
  addBell(world, 12, 5);
  const witness = addTownfolk(world, 6, 5, "villager", { idleTurns: 20, visionRange: 0 });
  addEnemy(world, 6, 7);

  aiTownfolkSystem(world);

  const job = world.get(witness, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.idle, "enemy outside Brain vision range should not trigger breach sighting");
  assert(!world.has(witness, MoveIntent), "short-sighted townfolk should not move to the bell");
});

Deno.test("bell runner rings on arrival and alarmed townsfolk fight or flee instead of freezing", () => {
  const world = makeWorld(401);
  installBellListener(world);
  addBell(world, 12, 5);
  const witness = addTownfolk(world, 6, 5, "villager", { idleTurns: 20 });
  const miner = addTownfolk(world, 7, 7, "miner", { idleTurns: 20 });
  const enemy = addEnemy(world, 8, 7);

  const alarms = [];
  world.on("town:alarm", (ev) => alarms.push(ev));

  aiTownfolkSystem(world);
  assertEquals(world.get(witness, TownfolkJob).state, TOWNFOLK_STATES.alarming, "precondition: witness is running to bell");
  try { world.remove(witness, MoveIntent); } catch {}
  world.set(witness, Position, { x: 11, y: 5 });

  aiTownfolkSystem(world);

  assertEquals(alarms.length, 1, "arrival at bell should ring the town alarm");
  assertEquals(world.get(witness, TownfolkJob).state, TOWNFOLK_STATES.armed, "bell runner should rally after ringing");

  const minerJob = world.get(miner, TownfolkJob);
  assertEquals(minerJob.state, TOWNFOLK_STATES.armed, "tool-carrying miner should rally");
  try { world.remove(miner, MoveIntent); } catch {}
  aiTownfolkSystem(world);
  assert(world.has(miner, AttackIntent), "armed adjacent miner should attack a visible town hostile");
  assertEquals(world.get(miner, AttackIntent).targetId, enemy, "miner should target the sighted hostile");
});

Deno.test("hiding keyed townfolk closes and locks owned doors during alarm", () => {
  const world = makeWorld(402);
  const vendor = addTownfolk(world, 6, 5, "general_vendor", {
    state: TOWNFOLK_STATES.hiding,
    homeX: 6,
    homeY: 5,
    targetX: 6,
    targetY: 5,
    guardTurnsLeft: 20,
  });
  const door = world.create();
  world.add(door, Position, { x: 7, y: 5 });
  world.add(door, DoorState, { open: true, locked: false });
  world.add(door, DoorLock, { lockId: "shop:test" });
  world.add(door, Collider, { solid: false, blocksSight: false });
  const key = world.create();
  world.add(key, DoorKey, { lockId: "shop:test" });
  world.add(key, ItemInfo, { type: "key", count: 1 });
  addToInventory(world, vendor, key);

  aiTownfolkSystem(world);

  const state = world.get(door, DoorState);
  assertEquals(state.open, false, "hiding vendor should close owned door");
  assertEquals(state.locked, true, "hiding vendor should lock owned keyed door");
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

Deno.test("woodcutter chops adjacent TreeNode entity on work completion", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
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

  // Place a TreeNode entity at (8, 5)
  const tree = world.create();
  world.add(tree, Position, { x: 8, y: 5 });
  world.add(tree, NamedIdentity, { name: "Tree", identity: "tree_harvest" });
  world.add(tree, Material, { kind: "wood" });
  world.add(tree, Collider, { solid: true, blocksSight: true });
  world.add(tree, HarvestNode, {
    kind: "tree", ready: true, regrowTurns: 350, regrowCountdown: 0,
    yield: "material_lumber", yieldMin: 1, yieldMax: 1, requiresTool: "chop",
  });

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

  const node = world.get(tree, HarvestNode);
  assertEquals(node.ready, false, "tree should be depleted");
  const col = world.get(tree, Collider);
  assertEquals(col.solid, false, "chopped tree stump should be walkable");
  assert(chopped, "townfolk:chopped event should fire");
  assertEquals(countInventory(world, npc, "material_lumber"), 1, "woodcutter should carry lumber");
  assertEquals(countInventory(world, npc, "fuel_firewood"), 1, "woodcutter should carry firewood");
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

  const lumberChest = world.create();
  world.add(lumberChest, Position, { x: 9, y: 5 });
  world.add(lumberChest, Inventory, { capacity: 30 });
  world.add(lumberChest, ItemNamedIdentity, { name: "Lumber Chest", identity: "lumber_chest" });
  addToInventory(world, lumberChest, createItemById(world, "material_lumber"));

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
  assertEquals(countInventory(world, lumberChest, "material_lumber"), 0, "repair should consume lumber");
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
  assertEquals(countInventory(world, npc, "ore_iron"), 1, "miner should carry mined ore as an item");
  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning, "miner should be returning home");
  assertEquals(job.targetX, 5, "target should be homeX");
});

Deno.test("scheduled townfolk sleeps at home before dawn", () => {
  const world = makeWorld(14);
  world.step = 5;

  const npc = addTownfolk(world, 6, 5, "villager", {
    scheduleEnabled: true,
    homeX: 6, homeY: 5,
    bedX: 7, bedY: 5,
    pubX: 10, pubY: 10,
  });
  world.set(npc, Position, { x: 7, y: 5 });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.sleeping);
  assertEquals(job.targetX, 7);
  assertEquals(job.targetY, 5);
});

Deno.test("scheduled farmer alternates between field and mill during work hours", () => {
  const world = makeWorld(15);
  world.step = 222; // work phase (210-509), workBeat=1 → mill

  const farmer = addTownfolk(world, 8, 8, "farmer", {
    scheduleEnabled: true,
    homeX: 8, homeY: 8,
    bedX: 7, bedY: 8,
    workX: 12, workY: 12,
    workAuxX: 4, workAuxY: 4,
    pubX: 9, pubY: 9,
  });
  world.set(farmer, Position, { x: 4, y: 4 });

  let milled = false;
  world.on("townfolk:milled", () => { milled = true; });

  aiTownfolkSystem(world);

  const job = world.get(farmer, TownfolkJob);
  assertEquals(job.workSiteKind, "mill");
  assert(milled, "farmer should work the mill during the late work beat");
  assertEquals(job.state, TOWNFOLK_STATES.returning, "farmer should leave the mill after processing goods");
});

Deno.test("scheduled farmer can work a solid millstone from an adjacent tile", () => {
  const world = makeWorld(115);
  world.step = 222; // work phase (210-509), workBeat=1 → mill

  const millstone = world.create();
  world.add(millstone, Position, { x: 4, y: 4 });
  world.add(millstone, ItemNamedIdentity, { name: "Millstone", identity: "millstone" });
  world.add(millstone, Collider, { solid: true, blocksSight: false });
  world.add(millstone, Interactable, { action: "millGrain", params: { idleState: "idle", activeState: "working", activeDuration: 4 } });
  world.add(millstone, ObjectState, { state: "idle" });

  const millChest = world.create();
  world.add(millChest, Position, { x: 3, y: 4 });
  world.add(millChest, Inventory, { capacity: 30 });
  world.add(millChest, ItemNamedIdentity, { name: "Mill Chest", identity: "chest" });
  addToInventory(world, millChest, createItemById(world, "food_wheat"));

  const farmer = addTownfolk(world, 4, 5, "farmer", {
    scheduleEnabled: true,
    homeX: 8, homeY: 8,
    bedX: 7, bedY: 8,
    workX: 12, workY: 12,
    workAuxX: 4, workAuxY: 4,
    pubX: 9, pubY: 9,
  });

  let milled = false;
  world.on("townfolk:milled", () => { milled = true; });

  for (let i = 0; i < 5; i++) aiTownfolkSystem(world);

  assert(milled, "farmer should mill grain from beside the millstone");
  assertEquals(countInventory(world, millChest, "food_flour"), 1, "mill chest should receive flour");
  assertEquals(world.get(millstone, ObjectState)?.state, "working", "millstone should animate as active");
});

Deno.test("scheduled townfolk heads to the pub after work", () => {
  const world = makeWorld(16);
  world.step = 516; // pub phase (510-579)

  const npc = addTownfolk(world, 6, 5, "smith", {
    scheduleEnabled: true,
    workX: 3, workY: 3,
    workAuxX: 4, workAuxY: 3,
    pubX: 9, pubY: 9,
  });

  aiTownfolkSystem(world);

  const job = world.get(npc, TownfolkJob);
  assertEquals(job.targetX, 9);
  assertEquals(job.targetY, 9);
  assertEquals(job.routineKind, "pub");
});

Deno.test("scheduled miner keeps the work routine during a long outbound trip", () => {
  const world = makeWorld(116);
  world.step = 222; // work phase (210-509)

  const miner = addTownfolk(world, 5, 5, "miner", {
    scheduleEnabled: true,
    homeX: 5, homeY: 5,
    bedX: 5, bedY: 5,
    workX: 45, workY: 5,
    workAuxX: 45, workAuxY: 5,
    pubX: 9, pubY: 9,
  });

  aiTownfolkSystem(world);

  const job = world.get(miner, TownfolkJob);
  assertEquals(job.routineKind, "mine");
  assertEquals(job.targetX, 45);
  assertEquals(job.targetY, 5);
  assertEquals(job.state, TOWNFOLK_STATES.walking, "miner should still be commuting to work mid-shift");
});

Deno.test("scheduled townfolk opens a closed door on its route and closes it after passing", () => {
  const world = makeWorld(17);
  world.step = 222; // work phase (210-509)
  installTownfolkDoorListener(world);

  const npc = addTownfolk(world, 5, 5, "villager", {
    scheduleEnabled: true,
    homeX: 5, homeY: 5,
    bedX: 5, bedY: 5,
    workX: 8, workY: 5,
    workAuxX: 8, workAuxY: 5,
    pubX: 9, pubY: 9,
  });
  const door = world.create();
  world.add(door, Position, { x: 6, y: 5 });
  world.add(door, DoorState, { open: false, locked: false });
  world.add(door, Collider, { solid: true, blocksSight: true });

  aiTownfolkSystem(world);

  let ds = world.get(door, DoorState);
  assertEquals(ds.open, true, "townfolk should open the door instead of getting stuck");
  assert(!world.has(npc, MoveIntent), "opening the door consumes the turn");

  world.set(npc, Position, { x: 7, y: 5 });
  world.emit("moved", { id: npc, from: { x: 6, y: 5 }, to: { x: 7, y: 5 } });

  ds = world.get(door, DoorState);
  assertEquals(ds.open, false, "door should close after the townfolk passes through");
});

Deno.test("townfolk pathing aligns to a one-door house exit before heading to an offset outdoor target", () => {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);

  for (let y = 4; y <= 8; y++) {
    for (let x = 4; x <= 8; x++) {
      const border = x === 4 || x === 8 || y === 4 || y === 8;
      tiles[y * CHUNK_SIZE + x] = border ? TILE_WALL : TILE_FLOOR;
    }
  }
  tiles[4 * CHUNK_SIZE + 6] = TILE_DOOR;
  loadChunk(0, 0, tiles);

  const world = new World({ seed: 18 });
  const dsId = world.create();
  world.add(dsId, DungeonState, {
    worldSeed: 18,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
    downStairPositions: [],
  });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 6, y: 6 });

  const npc = addTownfolk(world, 6, 6, "villager", {
    state: TOWNFOLK_STATES.walking,
    targetX: 9,
    targetY: 5,
  });

  aiTownfolkSystem(world);

  assert(world.has(npc, MoveIntent), "townfolk should get a move toward the door alignment");
  const intent = world.get(npc, MoveIntent);
  assertEquals(intent.dx, 0, "townfolk should align with the doorway first");
  assertEquals(intent.dy, -1, "townfolk should head north toward the door");
});

Deno.test("alchemist brew consumes herbs and reagents from the herb chest", () => {
  const world = makeWorld(19);

  const chest = world.create();
  world.add(chest, Position, { x: 8, y: 5 });
  world.add(chest, Inventory, { capacity: 30 });
  world.add(chest, ItemNamedIdentity, { name: "Herb Chest", identity: "herb_chest" });

  const herbs = createItemById(world, "food_wild_herbs");
  const venom = createItemById(world, "reagent_venom_frond");
  addToInventory(world, chest, herbs);
  addToInventory(world, chest, venom);

  const npc = addTownfolk(world, 8, 5, "alchemist", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "brew",
    homeX: 6,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  let brewedAntiVenom = false;
  for (const [id, unpaid] of world.query(Unpaid)) {
    if (Number(unpaid.shopkeeperId || 0) !== npc) continue;
    const ni = world.get(id, ItemNamedIdentity);
    if (ni?.identity === "potion_anti_venom") brewedAntiVenom = true;
  }

  assert(brewedAntiVenom, "alchemist should brew an anti-venom potion when venom fronds are available");
});

Deno.test("scheduled herbalist leaves the hut for ready herbs even on the indoor sorting beat", () => {
  const world = makeWorld(191);
  world.step = 222; // work phase (210-509), workBeat=1 (indoor sorting beat)

  const herbNode = world.create();
  world.add(herbNode, Position, { x: 12, y: 5 });
  world.add(herbNode, HarvestNode, {
    kind: "venom_fern",
    ready: true,
    regrowTurns: 20,
    regrowCountdown: 0,
    yield: "reagent_venom_frond",
    yieldMin: 1,
    yieldMax: 1,
  });
  world.add(herbNode, Material, { kind: "wood" });

  const herbalist = addTownfolk(world, 8, 5, "herbalist", {
    scheduleEnabled: true,
    state: TOWNFOLK_STATES.idle,
    homeX: 8,
    homeY: 5,
    bedX: 7,
    bedY: 5,
    workX: 12,
    workY: 5,
    workAuxX: 8,
    workAuxY: 5,
    pubX: 8,
    pubY: 5,
  });

  aiTownfolkSystem(world);

  assert(world.has(herbalist, MoveIntent), "herbalist should head out to gather");
  const intent = world.get(herbalist, MoveIntent);
  assertEquals(intent.dx, 1, "herbalist should move toward the herb patch instead of idling indoors");
  assertEquals(intent.dy, 0);
});

Deno.test("herbalist keeps gathering until the satchel is full before returning home", () => {
  const world = makeWorld(192);

  const herbA = world.create();
  world.add(herbA, Position, { x: 8, y: 5 });
  world.add(herbA, HarvestNode, {
    kind: "herbs",
    ready: true,
    regrowTurns: 20,
    regrowCountdown: 0,
    yield: "food_wild_herbs",
    yieldMin: 1,
    yieldMax: 1,
  });

  const herbB = world.create();
  world.add(herbB, Position, { x: 10, y: 5 });
  world.add(herbB, HarvestNode, {
    kind: "venom_fern",
    ready: true,
    regrowTurns: 20,
    regrowCountdown: 0,
    yield: "reagent_venom_frond",
    yieldMin: 1,
    yieldMax: 1,
  });

  const herbalist = addTownfolk(world, 8, 5, "herbalist", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "harvest_herb",
    workX: 9,
    workY: 5,
    targetX: 8,
    targetY: 5,
    carryMax: 3,
  });

  aiTownfolkSystem(world);

  const job = world.get(herbalist, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.walking, "herbalist should continue to the next patch instead of returning immediately");
  assertEquals(job.targetX, 10);
  assertEquals(job.targetY, 5);
  assertEquals(job.carryCount, 1);
});

Deno.test("villager hauls flour from the mill chest into the tavern chest", () => {
  const world = makeWorld(20);

  const millChest = world.create();
  world.add(millChest, Position, { x: 8, y: 5 });
  world.add(millChest, Inventory, { capacity: 30 });
  world.add(millChest, ItemNamedIdentity, { name: "Mill Chest", identity: "chest" });
  addToInventory(world, millChest, createItemById(world, "food_flour"));

  const tavernChest = world.create();
  world.add(tavernChest, Position, { x: 12, y: 5 });
  world.add(tavernChest, Inventory, { capacity: 30 });
  world.add(tavernChest, ItemNamedIdentity, { name: "Tavern Chest", identity: "tavern_chest" });

  const npc = addTownfolk(world, 8, 5, "villager", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "haul_flour",
    deliverX: 12,
    deliverY: 5,
    homeX: 6,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  assertEquals(countInventory(world, npc, "food_flour"), 1, "villager should carry flour after collecting it");
  let job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.delivering, "villager should head to delivery after pickup");

  world.set(npc, Position, { x: 12, y: 5 });
  aiTownfolkSystem(world);

  assertEquals(countInventory(world, tavernChest, "food_flour"), 1, "tavern chest should receive hauled flour");
  assertEquals(countInventory(world, npc, "food_flour"), 0, "villager inventory should be empty after delivery");
  job = world.get(npc, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning, "villager should head home after delivery");
});

Deno.test("fisher delivers raw fish into the tavern chest", () => {
  const world = makeWorld(120);
  setTile(8, 5, TILE_FLOOR);
  setTile(9, 5, TILE_WATER);

  const tavernChest = world.create();
  world.add(tavernChest, Position, { x: 12, y: 5 });
  world.add(tavernChest, Inventory, { capacity: 30 });
  world.add(tavernChest, ItemNamedIdentity, { name: "Tavern Chest", identity: "tavern_chest" });

  const fisher = addTownfolk(world, 8, 5, "fisher", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "fish",
    deliverX: 12,
    deliverY: 5,
    homeX: 6,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  assertEquals(countInventory(world, fisher, "food_raw_fish"), 1, "fisher should carry a catch");
  let job = world.get(fisher, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.delivering);

  world.set(fisher, Position, { x: 12, y: 5 });
  aiTownfolkSystem(world);

  assertEquals(countInventory(world, tavernChest, "food_raw_fish"), 1, "tavern chest should receive fish");
  assertEquals(countInventory(world, fisher, "food_raw_fish"), 0, "fisher should empty carried fish");
  job = world.get(fisher, TownfolkJob);
  assertEquals(job.state, TOWNFOLK_STATES.returning);
});

Deno.test("barkeep cooks stew from tavern chest ingredients", () => {
  const world = makeWorld(21);

  const tavernChest = world.create();
  world.add(tavernChest, Position, { x: 8, y: 5 });
  world.add(tavernChest, Inventory, { capacity: 30 });
  world.add(tavernChest, ItemNamedIdentity, { name: "Tavern Chest", identity: "tavern_chest" });
  addToInventory(world, tavernChest, createItemById(world, "food_flour"));
  addToInventory(world, tavernChest, createItemById(world, "water_bucket"));
  addToInventory(world, tavernChest, createItemById(world, "fuel_firewood"));
  addToInventory(world, tavernChest, createItemById(world, "tool_kitchen_knife"));

  const barkeep = addTownfolk(world, 8, 5, "barkeep", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "cook",
    homeX: 6,
    homeY: 5,
  });

  aiTownfolkSystem(world);

  assertEquals(countInventory(world, tavernChest, "food_stew"), 1, "barkeep should turn ingredients into stew");
  assertEquals(countInventory(world, tavernChest, "tool_kitchen_knife"), 1, "kitchen knife should remain as a reusable tool");
  assertEquals(countInventory(world, tavernChest, "water_bucket"), 1, "water bucket should remain as reusable kitchen gear");
});

Deno.test("scheduled barkeep can cook beside a solid cooking fire", () => {
  const world = makeWorld(121);
  world.step = 216; // work phase (210-509), workBeat=0 → cook

  const fire = world.create();
  world.add(fire, Position, { x: 8, y: 5 });
  world.add(fire, Collider, { solid: true, blocksSight: false });
  world.add(fire, Interactable, { action: "cookFood", params: null });

  const tavernChest = world.create();
  world.add(tavernChest, Position, { x: 9, y: 5 });
  world.add(tavernChest, Inventory, { capacity: 30 });
  world.add(tavernChest, ItemNamedIdentity, { name: "Tavern Chest", identity: "tavern_chest" });
  addToInventory(world, tavernChest, createItemById(world, "food_flour"));
  addToInventory(world, tavernChest, createItemById(world, "water_bucket"));
  addToInventory(world, tavernChest, createItemById(world, "fuel_firewood"));
  addToInventory(world, tavernChest, createItemById(world, "tool_kitchen_knife"));

  const barkeep = addTownfolk(world, 8, 6, "barkeep", {
    scheduleEnabled: true,
    homeX: 6, homeY: 5,
    bedX: 6, bedY: 5,
    workX: 8, workY: 5,
    workAuxX: 7, workAuxY: 5,
    pubX: 10, pubY: 10,
  });

  let cooked = false;
  world.on("townfolk:cooked", () => { cooked = true; });

  for (let i = 0; i < 5; i++) aiTownfolkSystem(world);

  assert(cooked, "barkeep should cook without standing on the fire tile");
  assertEquals(countInventory(world, tavernChest, "food_stew"), 1, "tavern chest should receive stew");
  assertEquals(countInventory(world, tavernChest, "water_bucket"), 1, "water bucket should still be present after cooking");
});

import { GrowthStage } from "../src/rules/components/GrowthStage.js";

Deno.test("farmer auto-replants crop immediately after harvesting", () => {
  const world = makeWorld(30);

  // Place a ready wheat crop at (8, 5)
  const crop = world.create();
  world.add(crop, Position, { x: 8, y: 5 });
  world.add(crop, NamedIdentity, { name: "Wheat", identity: "crop_wheat" });
  world.add(crop, Material, { kind: "wood" });
  world.add(crop, Collider, { solid: true, blocksSight: false });
  world.add(crop, HarvestNode, {
    kind: "wheat", ready: true, regrowTurns: 200, regrowCountdown: 0,
    yield: "food_wheat", yieldMin: 1, yieldMax: 1,
    replantable: true, needsPlanting: false,
  });
  world.add(crop, GrowthStage, {
    currentStage: 3, maxStage: 3,
    stageIdentities: ["farmland_tilled", "seedling", "herb_growing", "crop_wheat"],
    growInterval: 0, growCountdown: 0,
  });

  // Farmer adjacent to crop, ready to harvest
  const farmer = addTownfolk(world, 7, 5, "farmer", {
    state: TOWNFOLK_STATES.working,
    workTurns: 0,
    workSiteKind: "harvest_crop",
    homeX: 3, homeY: 5,
    workX: 8, workY: 5,
  });

  let harvested = false;
  let planted = false;
  world.on("townfolk:harvested", () => { harvested = true; });
  world.on("townfolk:planted", () => { planted = true; });

  aiTownfolkSystem(world);

  const node = world.get(crop, HarvestNode);
  assert(harvested, "farmer should harvest the crop");
  assert(planted, "farmer should auto-replant immediately after harvest");
  assertEquals(node.ready, false, "crop should not be ready after harvest");
  assertEquals(node.needsPlanting, false, "crop should not need planting after auto-replant");
  assertEquals(node.regrowCountdown, 200, "regrow countdown should be set");
  assertEquals(countInventory(world, farmer, "food_wheat"), 1, "farmer should carry the harvested wheat");
  assertEquals(countInventory(world, farmer, "seed_wheat"), 0, "seed should be consumed by planting");
});
