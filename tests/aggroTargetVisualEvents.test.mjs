import "./helpers/installContentMonsters.mjs";

import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Pet } from "../src/rules/components/Pet.js";
import { PetState } from "../src/rules/components/PetState.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { aiChaseSystem } from "../src/rules/systems/aiChaseSystem.js";
import { petBehaviorSystem } from "../src/rules/systems/petBehaviorSystem.js";
import { installTauntListener, tauntSteeringSystem } from "../src/rules/systems/tauntSystem.js";

function addBaseEquipment(world, id, overrides = {}) {
  world.add(id, Equipment, {
    weapon: null, armor: null, head: null, neck: null, belt: null,
    gloves: null, offhand: null, ring1: null, ring2: null,
    legs: null, ammo: null, ranged: null, feet: null,
    accuracyDerived: 0, damagePowerDerived: 0, evadeDerived: 0,
    maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
    manaRegenDerived: 0, maxManaDerived: 0,
    staminaRegenDerived: 0, maxStaminaDerived: 0,
    kineticDRDerived: 0, fireResistDerived: 0, poisonResistDerived: 0,
    acidResistDerived: 0, radiationResistDerived: 0, electricOhmsDerived: 0,
    bluntResistDerived: 0, slashResistDerived: 0, pierceResistDerived: 0,
    luckDerived: 0, visionRangeDerived: 0, hungerRateDerived: 0,
    naturalDamageDice: "1d4", naturalScript: null,
    ...overrides,
  });
}

function makeWorld() {
  const world = new World({ seed: 123 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Faction, { key: "player" });
  addBaseEquipment(world, player);
  return { world, player };
}

function addEnemy(world, x, y, identity = "lich") {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: "enemy" });
  world.add(id, Vitality, { hp: 20, maxHp: 20 });
  world.add(id, Brain, { visionRange: 8, intelligence: 10, learnedSpellIds: [] });
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.unaware,
    targetId: 0,
    searchTurnsLeft: 0,
  });
  return id;
}

Deno.test("aiChaseSystem emits aggro target changes only when the selected target changes", () => {
  const { world, player } = makeWorld();
  const enemy = addEnemy(world, 8, 5);
  const events = [];
  world.on("aggro:targetChanged", (ev) => events.push(ev));

  aiChaseSystem(world);
  world.remove(enemy, MoveIntent);
  aiChaseSystem(world);

  assertEquals(events.length, 1);
  assertEquals(events[0].sourceId, enemy);
  assertEquals(events[0].targetId, player);
  assertEquals(events[0].targetKind, "player");
  assertEquals(world.get(enemy, AggroState).targetId, player);
});

Deno.test("conflict aggro target change identifies NPC-vs-NPC relationships", () => {
  const { world, player } = makeWorld();
  const conflictRing = world.create();
  world.add(conflictRing, ItemInfo, { tags: ["conflict"] });
  world.mutate(player, Equipment, (eq) => { eq.ring1 = conflictRing; });

  const enemy = addEnemy(world, 8, 5);
  const rival = addEnemy(world, 7, 5, "goblin");
  const events = [];
  world.on("aggro:targetChanged", (ev) => events.push(ev));

  aiChaseSystem(world);

  assertEquals(events.length, 1);
  assertEquals(events[0].sourceId, enemy);
  assertEquals(events[0].targetId, rival);
  assertEquals(events[0].targetKind, "npc");
  assertEquals(events[0].reason, "conflict");
  assertEquals(world.get(enemy, AggroState).targetId, rival);
});

Deno.test("taunt steering shifts aggro target visuals to the taunter", () => {
  const { world, player } = makeWorld();
  const enemy = addEnemy(world, 8, 5);
  const pet = world.create();
  world.add(pet, Position, { x: 7, y: 5 });
  world.add(pet, Faction, { key: "pet" });

  world.mutate(enemy, AggroState, (aggro) => {
    aggro.alertLevel = AGGRO_LEVELS.hunting;
    aggro.targetId = player;
  });
  world.add(enemy, ActiveEffects, {
    effects: [{ key: "taunt", turnsLeft: 2, potency: 1, sourceId: pet }],
  });
  world.add(enemy, MoveIntent, { dx: -1, dy: 0 });

  const events = [];
  world.on("aggro:targetChanged", (ev) => events.push(ev));

  tauntSteeringSystem(world);

  assertEquals(events.length, 1);
  assertEquals(events[0].sourceId, enemy);
  assertEquals(events[0].targetId, pet);
  assertEquals(events[0].targetKind, "ally");
  assertEquals(events[0].reason, "taunt");
  assertEquals(world.get(enemy, AggroState).targetId, pet);
});

Deno.test("guarding pet applies protective taunt when an enemy threatens its owner", () => {
  const { world, player } = makeWorld();
  installTauntListener(world);

  const pet = world.create();
  world.add(pet, Pet);
  world.add(pet, Position, { x: 6, y: 5 });
  world.add(pet, Faction, { key: "pet" });
  world.add(pet, Vitality, { hp: 20, maxHp: 20 });
  world.add(pet, PetState, {
    state: "guarding",
    targetX: 6,
    targetY: 5,
    targetItemId: 0,
    stateEnteredTurn: 0,
    lastPlayerX: 5,
    lastPlayerY: 5,
    commandCooldown: 0,
    rangedCooldown: 0,
  });

  const enemy = addEnemy(world, 7, 5);
  world.mutate(enemy, AggroState, (aggro) => {
    aggro.alertLevel = AGGRO_LEVELS.hunting;
    aggro.targetId = player;
    aggro.targetReason = "sight";
  });

  petBehaviorSystem(world);

  const taunt = world.get(enemy, ActiveEffects)?.effects?.find((effect) => effect.key === "taunt");
  assertEquals(taunt?.sourceId, pet);

  world.add(enemy, MoveIntent, { dx: -1, dy: 0 });
  tauntSteeringSystem(world);

  assertEquals(world.get(enemy, AggroState).targetId, pet);
  assertEquals(world.get(enemy, AggroState).targetReason, "taunt");
});
