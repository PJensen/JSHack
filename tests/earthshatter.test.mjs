import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Flying } from "../src/rules/components/Flying.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { spawnHazard } from "../src/rules/utils/hazardSpawn.js";
import { SPELL_DEFS } from "../src/rules/data/spells.js";
import { runSpellScript } from "../src/rules/scripts/spells.js";

function makeActor(world, x, y, hp, name = "Target") {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp, maxHp: Math.max(1, hp) });
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  return id;
}

function addDungeonState(world) {
  const id = world.create();
  world.add(id, DungeonState, {
    worldSeed: 0xEA12,
    currentDepth: 1,
    floorEntityIds: [],
  });
  return id;
}

function getStunEffect(world, entityId) {
  const ae = world.get(entityId, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return null;
  return ae.effects.find((e) => e.key === "stun") || null;
}

// --- Spell definition ---

Deno.test("earthshatter spell is defined in SPELL_DEFS", () => {
  const spell = SPELL_DEFS.earthshatter;
  assert(spell, "earthshatter spell should exist");
  assertEquals(spell.id, "earthshatter");
  assertEquals(spell.targeting, "self");
  assertEquals(spell.radius, 1);
  assertEquals(spell.manaCost, 8);
  assert(spell.schools.includes("earth"), "should include earth school");
});

// --- Quake hazard spawning ---

Deno.test("earthshatter script spawns a quake hazard at caster position", () => {
  const world = new World({ seed: 5000 });
  addDungeonState(world);

  const caster = makeActor(world, 10, 10, 20, "Player");

  const spell = SPELL_DEFS.earthshatter;
  const events = [];
  world.on("hazard:spawned", (data) => events.push(data));
  world.on("spell:earthshatter", (data) => events.push(data));

  runSpellScript(world, caster, spell, {});

  const spawned = events.find((e) => e.kind === "quake");
  assert(spawned, "hazard:spawned should emit with kind=quake");
  assertEquals(spawned.at.x, 10);
  assertEquals(spawned.at.y, 10);
  assertEquals(spawned.turnsLeft, 3);
  assertEquals(spawned.radius, 1);
  assertEquals(spawned.identity, "quake_earth");

  const spellEvt = events.find((e) => e.origin);
  assert(spellEvt, "spell:earthshatter should emit");
  assertEquals(spellEvt.enhanced, false);
});

// --- Damage to enemies, not caster ---

Deno.test("quake hazard damages enemies in radius but not the caster", () => {
  const world = new World({ seed: 5001 });
  addDungeonState(world);

  const caster = makeActor(world, 5, 5, 30, "Caster");
  const enemy1 = makeActor(world, 5, 6, 20, "Goblin");
  const enemy2 = makeActor(world, 6, 6, 20, "Orc");
  const outside = makeActor(world, 8, 8, 20, "Far");

  spawnHazard(world, {
    x: 5, y: 5,
    kind: "quake", medium: "floor",
    turnsLeft: 3, radius: 1,
    tickDamage: 3, damageType: "physical",
    cause: "spell:earthshatter",
    sourceId: caster,
    sourceKind: "earthshatter",
    meta: { stunTurns: 2, enhanced: false },
  });

  hazardSystem(world);

  assertEquals(world.get(caster, Vitality).hp, 30, "caster should not take damage");
  assert(world.get(enemy1, Vitality).hp < 20, "enemy in radius should take damage");
  assert(world.get(enemy2, Vitality).hp < 20, "enemy at corner should take damage");
  assertEquals(world.get(outside, Vitality).hp, 20, "enemy outside radius should be untouched");
});

// --- Stun application ---

Deno.test("quake hazard stuns enemies in radius but not the caster", () => {
  const world = new World({ seed: 5002 });
  addDungeonState(world);

  const caster = makeActor(world, 5, 5, 30, "Caster");
  const enemy = makeActor(world, 6, 5, 20, "Goblin");
  world.add(enemy, ActiveEffects, { effects: [] });

  spawnHazard(world, {
    x: 5, y: 5,
    kind: "quake", medium: "floor",
    turnsLeft: 3, radius: 1,
    tickDamage: 0, damageType: "physical",
    cause: "spell:earthshatter",
    sourceId: caster,
    sourceKind: "earthshatter",
    meta: { stunTurns: 2, enhanced: false },
  });

  hazardSystem(world);

  const enemyStun = getStunEffect(world, enemy);
  assert(enemyStun, "enemy should be stunned");
  assertEquals(enemyStun.turnsLeft, 2);

  const casterAe = world.get(caster, ActiveEffects);
  const casterStun = casterAe ? (casterAe.effects || []).find((e) => e.key === "stun") : null;
  assert(!casterStun, "caster should NOT be stunned");
});

// --- Stun refreshes each tick ---

Deno.test("quake hazard refreshes stun each tick for its full duration", () => {
  const world = new World({ seed: 5003 });
  addDungeonState(world);

  const caster = makeActor(world, 5, 5, 30, "Caster");
  const enemy = makeActor(world, 6, 5, 20, "Goblin");
  world.add(enemy, ActiveEffects, { effects: [] });

  spawnHazard(world, {
    x: 5, y: 5,
    kind: "quake", medium: "floor",
    turnsLeft: 3, radius: 1,
    tickDamage: 0, damageType: "physical",
    cause: "spell:earthshatter",
    sourceId: caster,
    sourceKind: "earthshatter",
    meta: { stunTurns: 2, enhanced: false },
  });

  // Tick 1
  hazardSystem(world);
  let stun = getStunEffect(world, enemy);
  assert(stun, "stun should be present after tick 1");
  assertEquals(stun.turnsLeft, 2);

  // Simulate effect system decrement
  stun.turnsLeft -= 1;
  assertEquals(stun.turnsLeft, 1);

  // Tick 2: stun should be refreshed back to 2
  hazardSystem(world);
  stun = getStunEffect(world, enemy);
  assert(stun, "stun should still be present after tick 2");
  assertEquals(stun.turnsLeft, 2, "stun should be refreshed to full");

  // Tick 3: hazard expires, but one more stun refresh
  stun.turnsLeft -= 1;
  hazardSystem(world);
  stun = getStunEffect(world, enemy);
  assert(stun, "stun should still be present after tick 3");
  assertEquals(stun.turnsLeft, 2, "stun should be refreshed on final tick");
});

// --- Hazard expires after 3 ticks ---

Deno.test("quake hazard expires after 3 ticks", () => {
  const world = new World({ seed: 5004 });
  addDungeonState(world);

  const events = [];
  world.on("hazard:expired", (data) => events.push(data));

  const hazardId = spawnHazard(world, {
    x: 5, y: 5,
    kind: "quake", medium: "floor",
    turnsLeft: 3, radius: 1,
    tickDamage: 0, damageType: "physical",
    cause: "spell:earthshatter",
    sourceId: 0,
    meta: { stunTurns: 2 },
  });

  hazardSystem(world); // tick 1: turnsLeft 3 -> 2
  assert(world.isAlive(hazardId), "hazard alive after tick 1");

  hazardSystem(world); // tick 2: turnsLeft 2 -> 1
  assert(world.isAlive(hazardId), "hazard alive after tick 2");

  hazardSystem(world); // tick 3: turnsLeft 1 -> 0, expires
  assert(!world.isAlive(hazardId), "hazard should expire after tick 3");

  const expired = events.find((e) => e.kind === "quake");
  assert(expired, "hazard:expired should emit for quake kind");
});

// --- Flying entities unaffected ---

Deno.test("flying entities are not stunned or damaged by quake", () => {
  const world = new World({ seed: 5005 });
  addDungeonState(world);

  const caster = makeActor(world, 5, 5, 30, "Caster");
  const flyer = makeActor(world, 6, 5, 20, "Bat");
  world.add(flyer, Flying, {});
  world.add(flyer, ActiveEffects, { effects: [] });

  spawnHazard(world, {
    x: 5, y: 5,
    kind: "quake", medium: "floor",
    turnsLeft: 3, radius: 1,
    tickDamage: 3, damageType: "physical",
    cause: "spell:earthshatter",
    sourceId: caster,
    sourceKind: "earthshatter",
    meta: { stunTurns: 2 },
  });

  hazardSystem(world);

  assertEquals(world.get(flyer, Vitality).hp, 20, "flying entity should not take damage");
  const flyerStun = getStunEffect(world, flyer);
  assert(!flyerStun, "flying entity should not be stunned");
});

// --- Enhanced variant via earthshaker affix ---

Deno.test("earthshatter enhanced flag set when earthshaker affix equipped", () => {
  const world = new World({ seed: 5006 });
  addDungeonState(world);

  const caster = makeActor(world, 10, 10, 20, "Player");

  // Create a weapon with earthshaker affix
  const weaponId = world.create();
  world.add(weaponId, ItemInfo, {
    type: "weapon",
    slot: "weapon",
    weight: 5,
    value: 10,
    description: "A heavy maul",
    count: 1,
    bonuses: {},
    rarity: 2,
    rarityName: "magic",
    affixes: ["earthshaker"],
    sockets: [],
    maxSockets: 0,
  });

  world.add(caster, Equipment, { weapon: weaponId });

  const spell = SPELL_DEFS.earthshatter;
  const events = [];
  world.on("spell:earthshatter", (data) => events.push(data));
  world.on("hazard:spawned", (data) => events.push(data));

  runSpellScript(world, caster, spell, {});

  const spellEvt = events.find((e) => e.enhanced !== undefined && e.origin);
  assert(spellEvt, "spell:earthshatter should emit");
  assertEquals(spellEvt.enhanced, true, "should be enhanced with earthshaker affix");

  const hazardEvt = events.find((e) => e.kind === "quake");
  assert(hazardEvt, "quake hazard should spawn");
  assertEquals(hazardEvt.identity, "quake_volcanic", "identity should be volcanic variant");
});

// --- Non-enhanced without affix ---

Deno.test("earthshatter is normal when no earthshaker affix present", () => {
  const world = new World({ seed: 5007 });
  addDungeonState(world);

  const caster = makeActor(world, 10, 10, 20, "Player");

  // Equip a weapon without earthshaker affix
  const weaponId = world.create();
  world.add(weaponId, ItemInfo, {
    type: "weapon",
    slot: "weapon",
    weight: 5,
    value: 10,
    description: "A plain sword",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: ["fierce"],
    sockets: [],
    maxSockets: 0,
  });

  world.add(caster, Equipment, { weapon: weaponId });

  const spell = SPELL_DEFS.earthshatter;
  const events = [];
  world.on("spell:earthshatter", (data) => events.push(data));

  runSpellScript(world, caster, spell, {});

  const spellEvt = events.find((e) => e.origin);
  assert(spellEvt, "spell event should emit");
  assertEquals(spellEvt.enhanced, false, "should NOT be enhanced without earthshaker");
});
