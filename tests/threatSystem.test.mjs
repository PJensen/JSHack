import { assertEquals, assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { children } from "../src/lib/ecs-js/hierarchy.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { ThreatEntry } from "../src/rules/components/ThreatEntry.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { addThreat, getThreatValue, forceThreatTarget, resolveThreatTarget } from "../src/rules/utils/threat.js";
import { threatSystem, installThreatListeners } from "../src/rules/systems/threatSystem.js";
import { installTauntListener, tauntSteeringSystem } from "../src/rules/systems/tauntSystem.js";

function addActor(world, x, y, factionKey, extra = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Faction, { key: factionKey });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  if (extra.player) world.add(id, Player);
  if (extra.pet) world.add(id, Pet);
  return id;
}

function addEnemy(world, x = 5, y = 5) {
  const id = addActor(world, x, y, "enemy");
  world.add(id, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    targetId: 0,
    targetReason: "",
    searchTurnsLeft: 10,
  });
  return id;
}

function threatEntryCount(world, ownerId) {
  let count = 0;
  for (const childId of children(world, ownerId)) {
    if (world.has(childId, ThreatEntry)) count++;
  }
  return count;
}

Deno.test("damage threat creates a child entry and can pull aggro in melee range", () => {
  const world = new World({ seed: 1 });
  installThreatListeners(world);
  const enemy = addEnemy(world);
  const player = addActor(world, 6, 5, "player", { player: true });
  const pet = addActor(world, 5, 6, "pet", { pet: true });
  const aggro = world.get(enemy, AggroState);

  addThreat(world, enemy, pet, 10, { kind: "damage" });
  resolveThreatTarget(world, enemy, { reason: "damage" });
  assertEquals(aggro.targetId, pet);

  dealDamage(world, { target: enemy, source: player, amount: 11, type: "physical", bypassResist: true });

  assertEquals(threatEntryCount(world, enemy), 2);
  assertEquals(getThreatValue(world, enemy, player), 11);
  assertEquals(aggro.targetId, player);
  assertEquals(aggro.targetReason, "damage");
});

Deno.test("ranged challenger needs 130 percent threat to pull", () => {
  const world = new World({ seed: 2 });
  const enemy = addEnemy(world);
  const player = addActor(world, 10, 5, "player", { player: true });
  const pet = addActor(world, 5, 6, "pet", { pet: true });
  const aggro = world.get(enemy, AggroState);

  addThreat(world, enemy, pet, 10, { kind: "damage" });
  resolveThreatTarget(world, enemy, { reason: "damage" });
  addThreat(world, enemy, player, 12, { kind: "damage" });
  resolveThreatTarget(world, enemy, { reason: "damage" });

  assertEquals(aggro.targetId, pet);
  assertEquals(aggro.threatState, "unstable");

  addThreat(world, enemy, player, 1, { kind: "damage" });
  resolveThreatTarget(world, enemy, { reason: "damage" });
  assertEquals(aggro.targetId, player);
});

Deno.test("hard taunt forces target then expires back to highest threat", () => {
  const world = new World({ seed: 3 });
  const enemy = addEnemy(world);
  const player = addActor(world, 8, 5, "player", { player: true });
  const pet = addActor(world, 6, 5, "pet", { pet: true });
  const aggro = world.get(enemy, AggroState);

  addThreat(world, enemy, player, 20, { kind: "damage" });
  resolveThreatTarget(world, enemy, { reason: "damage" });
  assertEquals(aggro.targetId, player);

  assert(forceThreatTarget(world, enemy, pet, 2, { reason: "taunt" }));
  assertEquals(aggro.targetId, pet);
  assertEquals(aggro.threatState, "locked");

  world.step = 3;
  threatSystem(world);
  assertEquals(aggro.targetId, player);
  assertEquals(aggro.targetReason, "threat");
});

Deno.test("threat decays and zero entries are removed", () => {
  const world = new World({ seed: 4 });
  const enemy = addEnemy(world);
  const player = addActor(world, 6, 5, "player", { player: true });

  addThreat(world, enemy, player, 2, { kind: "damage" });
  assertEquals(threatEntryCount(world, enemy), 1);
  threatSystem(world);
  threatSystem(world);

  assertEquals(threatEntryCount(world, enemy), 0);
});

Deno.test("taunt area emits threat and existing steering remains compatible", () => {
  const world = new World({ seed: 6 });
  installThreatListeners(world);
  installTauntListener(world);
  const enemy = addEnemy(world);
  const player = addActor(world, 8, 5, "player", { player: true });
  const pet = addActor(world, 6, 5, "pet", { pet: true });
  const aggro = world.get(enemy, AggroState);
  aggro.targetId = player;
  aggro.targetReason = "sight";

  world.emit("taunt:apply-area", {
    sourceId: pet,
    x: 6,
    y: 5,
    radius: 2,
    turnsLeft: 2,
    potency: 1,
    targetFaction: "enemy",
  });

  assertEquals(world.get(enemy, ActiveEffects)?.effects?.[0]?.key, "taunt");
  assertEquals(aggro.targetId, pet);
  assertEquals(aggro.threatState, "locked");

  world.add(enemy, MoveIntent, { dx: 1, dy: 0 });
  tauntSteeringSystem(world);
  assertEquals(world.get(enemy, MoveIntent).dx, 1);
  assertEquals(world.get(enemy, AggroState).targetId, pet);
});
