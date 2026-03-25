import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Brain } from "../src/rules/components/Brain.js";
import { CastSpellIntent } from "../src/rules/components/Intents/CastSpellIntent.js";
import { Channeling } from "../src/rules/components/Channeling.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Faction } from "../src/rules/components/Faction.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Mana } from "../src/rules/components/Mana.js";
import { Status } from "../src/rules/components/Status.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { castSpellSystem } from "../src/rules/systems/castSpellSystem.js";
import { channelingSystem } from "../src/rules/systems/channelingSystem.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { CHUNK_SIZE, TILE_FLOOR, TILE_TREE, TILE_GRASS } from "../src/rules/environment/dungeon/constants.js";
import { clearAll as clearTileMap, getTile, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

function loadFlatFloor() {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function makeStormWorld(seed = 1) {
  const world = new World({ seed });
  world.setScheduler((w) => {
    channelingSystem(w);
    castSpellSystem(w);
  });
  return world;
}

function fillEnemyGrid(world, centerX, centerY, radius, hp = 12) {
  const ids = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const id = world.create();
      world.add(id, Position, { x: centerX + dx, y: centerY + dy });
      world.add(id, Vitality, { maxHp: hp, hp });
      world.add(id, Faction, { key: "enemy" });
      ids.push(id);
    }
  }
  return ids;
}

function addOverworldState(world) {
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, {
    worldSeed: 0xC0FFEE,
    currentDepth: 0,
    profileType: "overworld",
    floorEntityIds: [],
  });
  return dungeonId;
}

Deno.test("blizzard starts as a sustained channel and defers mana spend to channel ticks", () => {
  loadFlatFloor();
  const world = makeStormWorld(7);
  const player = createPlayer(world, { x: 0, y: 0, name: "Mage" });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ["blizzard"];

  const mana = world.get(player, Mana);
  mana.mana = 12;
  mana.maxMana = 12;

  world.add(player, CastSpellIntent, { spellId: "blizzard", x: 4, y: 0 });
  world.tick(1);

  const channel = world.get(player, Channeling);
  assert(channel, "blizzard should enter channeling state");
  assertEquals(channel.mode, "sustain");
  assertEquals(channel.manaPerTick, 3);
  assertEquals(world.get(player, Mana).mana, 12);
});

Deno.test("sustained channels require two ticks worth of mana to start", () => {
  loadFlatFloor();
  const world = makeStormWorld(23);
  const player = createPlayer(world, { x: 0, y: 0, name: "Mage" });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ["blizzard"];

  const mana = world.get(player, Mana);
  mana.mana = 5; // blizzard manaPerTick = 3, required start = 6
  mana.maxMana = 10;

  const ooms = [];
  world.on("spell:oom", (event) => ooms.push(event));

  world.add(player, CastSpellIntent, { spellId: "blizzard", x: 4, y: 0 });
  world.tick(1);

  assert(!world.has(player, Channeling), "blizzard should not start channel below 2x manaPerTick");
  assertEquals(world.get(player, Mana).mana, 5, "mana should not be spent when start gate fails");
  assert(ooms.some((event) => event.spellId === "blizzard" && Number(event.need) === 6), "oom event should report 2x tick requirement");
});

Deno.test("blizzard channel ticks drain mana, respect radius bonuses, and keep burst damage bounded", () => {
  loadFlatFloor();
  const world = makeStormWorld(9);
  const player = createPlayer(world, { x: 0, y: 0, name: "Mage" });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ["blizzard"];
  const mana = world.get(player, Mana);
  mana.mana = 20;
  mana.maxMana = 20;

  const eq = world.get(player, Equipment);
  eq.spellRadiusDerived = 2;

  const center = { x: 4, y: 0 };
  const enemies = fillEnemyGrid(world, center.x, center.y, 5, 12);
  const events = [];
  world.on("spell:blizzard", (event) => events.push(event));

  world.add(player, CastSpellIntent, { spellId: "blizzard", x: center.x, y: center.y });
  world.tick(1);
  world.tick(1);

  assertEquals(world.get(player, Mana).mana, 17);
  assert(events.length >= 1, "blizzard should emit an area event each channel tick");
  assert(events[0].radius >= 2, `blizzard radius should include spellRadius bonus (got ${events[0].radius})`);
  assert(events[0].boltsPerTick >= 1, `blizzard should have at least 1 bolt per tick (got ${events[0].boltsPerTick})`);

  let damaged = 0;
  let maxDamage = 0;
  for (let i = 0; i < enemies.length; i++) {
    const vit = world.get(enemies[i], Vitality);
    const dealt = 12 - Number(vit?.hp || 0);
    if (dealt > 0) damaged += 1;
    if (dealt > maxDamage) maxDamage = dealt;
  }
  assert(damaged > 0, "storm tick should damage at least some occupied tiles");
  assert(maxDamage <= 6, `single-tick storm burst should stay bounded (saw ${maxDamage})`);
});

Deno.test("firestorm applies burning and stops once mana can no longer pay the next tick", () => {
  loadFlatFloor();
  const world = makeStormWorld(13);
  const player = createPlayer(world, { x: 0, y: 0, name: "Pyromancer" });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ["firestorm"];
  const mana = world.get(player, Mana);
  mana.mana = 8;
  mana.maxMana = 8;

  const enemies = fillEnemyGrid(world, 4, 0, 3, 12);
  const cancellations = [];
  const ooms = [];
  world.on("channeling:cancelled", (event) => cancellations.push(event));
  world.on("spell:oom", (event) => ooms.push(event));

  world.add(player, CastSpellIntent, { spellId: "firestorm", x: 4, y: 0 });
  world.tick(1);
  world.tick(1);
  world.tick(1);
  world.tick(1);

  assertEquals(world.get(player, Mana).mana, 0);
  assert(!world.has(player, Channeling), "firestorm should stop when it cannot fund another tick");
  assert(ooms.some((event) => event.spellId === "firestorm"), "firestorm should emit oom when the channel collapses");
  assert(cancellations.some((event) => event.reason === "oom"), "channel cancellation should explain the mana failure");

  let burnedTargets = 0;
  for (let i = 0; i < enemies.length; i++) {
    const effects = world.get(enemies[i], ActiveEffects);
    if (effects?.effects?.some((effect) => effect?.key === "burn")) burnedTargets += 1;
  }
  assert(burnedTargets > 0, "firestorm should leave at least one burning survivor after two paid ticks");
});

Deno.test("sustained channels cancel immediately on canonical interruption statuses", () => {
  loadFlatFloor();

  const cases = [
    { seed: 19, inject: (world, id) => world.add(id, ActiveEffects, { effects: [{ key: "stun", turnsLeft: 2, potency: 1, stacks: 1 }] }), reason: "stunned" },
    { seed: 20, inject: (world, id) => world.add(id, Status, { statuses: [{ type: "mindlocked", duration: 2, potency: 1, stacks: 1 }] }), reason: "mindlocked" },
    { seed: 21, inject: (world, id) => world.add(id, Status, { statuses: [{ type: "silenced", duration: 2, potency: 1, stacks: 1 }] }), reason: "silenced" },
    { seed: 22, inject: (world, id) => world.add(id, Status, { statuses: [{ type: "asleep", duration: 2, potency: 1, stacks: 1 }] }), reason: "asleep" },
  ];

  for (const c of cases) {
    const world = makeStormWorld(c.seed);
    const player = createPlayer(world, { x: 0, y: 0, name: "Mage" });
    const brain = world.get(player, Brain);
    brain.learnedSpellIds = ["blizzard"];
    const mana = world.get(player, Mana);
    mana.mana = 10;
    mana.maxMana = 10;
    const cancelled = [];
    world.on("channeling:cancelled", (event) => cancelled.push(event));

    world.add(player, CastSpellIntent, { spellId: "blizzard", x: 4, y: 0 });
    world.tick(1); // enter sustain channel
    c.inject(world, player);
    world.tick(1); // should cancel before spending mana

    assert(!world.has(player, Channeling), `${c.reason} should immediately cancel sustained channel`);
    assertEquals(world.get(player, Mana).mana, 10, `${c.reason} cancellation should happen before mana drain`);
    assert(cancelled.some((event) => event.reason === c.reason), `should emit channeling:cancelled reason=${c.reason}`);
  }
});

Deno.test("firestorm impacts stamp floor fire hazards that can burn overworld structures", () => {
  clearTileMap();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 7; x++) {
      tiles[y * CHUNK_SIZE + x] = TILE_TREE;
    }
  }
  loadChunk(0, 0, tiles);

  const world = makeStormWorld(17);
  addOverworldState(world);

  const player = createPlayer(world, { x: 0, y: 0, name: "Pyromancer" });
  const brain = world.get(player, Brain);
  brain.learnedSpellIds = ["firestorm"];
  const mana = world.get(player, Mana);
  mana.mana = 12;
  mana.maxMana = 12;

  world.add(player, CastSpellIntent, { spellId: "firestorm", x: 4, y: 0 });
  world.tick(1);
  world.tick(1);

  const stormFires = [];
  for (const [id, pos, hazard] of world.query(Position, HazardArea)) {
    if (String(hazard?.kind || "") !== "fire") continue;
    if (String(hazard?.cause || "") !== "firestorm_fire") continue;
    stormFires.push({ id, pos, hazard });
  }
  assert(stormFires.length > 0, "firestorm should spawn torch-style fire hazards at impact tiles");

  hazardSystem(world);

  let burnedTrees = 0;
  for (let y = 1; y <= 3; y++) {
    for (let x = 1; x <= 7; x++) {
      if (getTile(x, y) === TILE_GRASS) burnedTrees += 1;
    }
  }
  assert(burnedTrees > 0, "firestorm fire hazards should burn flammable overworld tiles");
});
