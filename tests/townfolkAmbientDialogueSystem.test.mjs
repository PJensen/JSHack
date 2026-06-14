import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { TownfolkJob, TOWNFOLK_STATES } from "../src/rules/components/TownfolkJob.js";
import { TownState } from "../src/rules/components/TownState.js";
import { WeatherState } from "../src/rules/components/WeatherState.js";
import { townfolkAmbientDialogueSystem } from "../src/rules/systems/townfolkAmbientDialogueSystem.js";

function addTownfolk(world, { x, y, role, name, state = TOWNFOLK_STATES.socializing }) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: "townfolk" });
  world.add(id, NamedIdentity, { name, identity: `townfolk_${role}` });
  world.add(id, TownfolkJob, {
    role,
    state,
    scheduleEnabled: false,
    homeX: x,
    homeY: y,
    bedX: x,
    bedY: y,
    workX: x,
    workY: y,
    workAuxX: x,
    workAuxY: y,
    pubX: x,
    pubY: y,
    targetX: x,
    targetY: y,
    workTurns: 0,
    idleTurns: 0,
    workSiteKind: "",
    routineKind: "",
    lastPhase: "",
    carrying: "",
    carryCount: 0,
    carryMax: 0,
    deliverX: 0,
    deliverY: 0,
    stuckTurns: 0,
    guardTurnsLeft: 0,
  });
  return id;
}

function makeWorld(seed = 7001, step = 520) {
  const world = new World({ seed });
  world.step = step | 0;

  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, { worldSeed: seed >>> 0, currentDepth: 0, floorEntityIds: [] });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const townStateId = world.create();
  world.add(townStateId, TownState, {
    foodStores: 2,
    materialStores: 3,
    medicineStores: 1,
    repairBacklog: 2,
    threatLevel: 1,
    morale: 43,
    weather: "heavy_rain",
    lowFood: true,
    lowMaterials: false,
    lowMedicine: true,
    nextPulseStep: 0,
    lastPulseStep: -1,
  });

  const weatherId = world.create();
  world.add(weatherId, WeatherState, {
    current: "heavy_rain",
    turnsRemaining: 20,
    transitionCooldown: 5,
  });

  return world;
}

function runOnce(seed = 7001, step = 520) {
  const world = makeWorld(seed, step);
  addTownfolk(world, { x: 9, y: 10, role: "barkeep", name: "Barkeep" });
  addTownfolk(world, { x: 11, y: 10, role: "smith", name: "Smith" });
  addTownfolk(world, { x: 10, y: 12, role: "villager", name: "Villager" });

  const events = [];
  world.on("npc:dialogue", (event) => events.push(event));
  townfolkAmbientDialogueSystem(world);
  return events[0] || null;
}

Deno.test("townfolkAmbientDialogueSystem emits deterministic ambient NPC chatter", () => {
  const a = runOnce(7123, 520);
  const b = runOnce(7123, 520);

  assert(a && b, "ambient chatter should emit in a dense pub scene");
  assertEquals(a.actor, b.actor);
  assertEquals(a.targetId, b.targetId);
  assertEquals(a.text, b.text);
  assertEquals(a.source, "townfolk:ambient");
  assert(a.actor !== a.targetId, "ambient speech should target another NPC");
  assertEquals(typeof a.topic, "string");
  assert(String(a.text).trim().length > 0, "ambient line should contain text");
});

Deno.test("townfolkAmbientDialogueSystem respects cooldowns for the same nearby pair", () => {
  const world = makeWorld(7124, 552);
  addTownfolk(world, { x: 9, y: 10, role: "barkeep", name: "Barkeep" });
  addTownfolk(world, { x: 11, y: 10, role: "smith", name: "Smith" });

  const events = [];
  world.on("npc:dialogue", (event) => events.push(event));

  townfolkAmbientDialogueSystem(world);
  assertEquals(events.length, 1, "first eligible step should emit");

  for (let step = 553; step <= 591; step++) {
    world.step = step;
    townfolkAmbientDialogueSystem(world);
  }

  assertEquals(events.length, 1, "ambient chatter should stay quiet for a long window after speaking");
});

Deno.test("townfolkAmbientDialogueSystem stays silent off the overworld", () => {
  const world = makeWorld(7125, 520);
  addTownfolk(world, { x: 9, y: 10, role: "barkeep", name: "Barkeep" });
  addTownfolk(world, { x: 11, y: 10, role: "smith", name: "Smith" });

  const dungeonId = 1;
  world.set(dungeonId, DungeonState, { worldSeed: 7125, currentDepth: 2, floorEntityIds: [] });

  const events = [];
  world.on("npc:dialogue", (event) => events.push(event));
  townfolkAmbientDialogueSystem(world);

  assertEquals(events.length, 0, "dungeon depths should not emit townfolk banter");
});
