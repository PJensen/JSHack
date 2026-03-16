// tests/aiWeaponPickup.test.mjs
// Sapient humanoid monsters pick up weapons from the floor when unarmed and hunting.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }    from '../src/rules/components/Position.js';
import { Player }      from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction }     from '../src/rules/components/Faction.js';
import { Equipment }   from '../src/rules/components/Equipment.js';
import { ItemInfo }    from '../src/rules/components/ItemInfo.js';
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE } from '../src/rules/components/AggroState.js';
import { aiWeaponPickupSystem } from '../src/rules/systems/aiWeaponPickupSystem.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  const world = new World({ seed });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  return world;
}

/** Minimal weapon entity sitting on the floor. */
function placeWeapon(world, x, y) {
  const item = world.create();
  world.add(item, Position, { x, y });
  world.add(item, ItemInfo, {
    type: 'weapon', slot: 'weapon', weight: 10, value: 50,
    description: 'A sharp blade.', count: 1, bonuses: {},
    twoHanded: false, rarity: 1, rarityName: 'common', affixes: [],
  });
  return item;
}

/** Create a lich (intelligence 10, humanoid) at (x,y) with no weapon equipped. */
function placeLich(world, x, y) {
  const lich = world.create();
  world.add(lich, Position, { x, y });
  world.add(lich, NamedIdentity, { name: 'Lich', identity: 'lich' });
  world.add(lich, Faction, { key: 'enemy' });
  world.add(lich, Equipment, {
    weapon: null, armor: null, head: null, neck: null, belt: null,
    gloves: null, offhand: null, ring1: null, ring2: null,
    legs: null, ammo: null, ranged: null, feet: null,
    accuracyDerived: 4, damagePowerDerived: 4, evadeDerived: 5,
    maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
    manaRegenDerived: 0, maxManaDerived: 0,
    staminaRegenDerived: 0, maxStaminaDerived: 0,
    kineticDRDerived: 0, fireResistDerived: 0, poisonResistDerived: 0,
    acidResistDerived: 0, radiationResistDerived: 0, electricOhmsDerived: 0,
    bluntResistDerived: 0, slashResistDerived: 0, pierceResistDerived: 0,
    luckDerived: 0, visionRangeDerived: 0, hungerRateDerived: 0,
    naturalDamageDice: '2d6', naturalScript: null,
  });
  world.add(lich, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: 5, lastKnownY: 5,
    searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
    retreating: false,
  });
  return lich;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

Deno.test("lich picks up an adjacent weapon when unarmed and hunting", () => {
  const world = makeWorld(1);
  const lich = placeLich(world, 8, 5);
  const sword = placeWeapon(world, 8, 5); // same tile as lich

  aiWeaponPickupSystem(world);

  const eq = world.get(lich, Equipment);
  assertEquals(eq.weapon, sword, 'lich should have equipped the sword');
  assert(!world.has(sword, Position), 'sword should be removed from floor after pickup');
});

Deno.test("lich picks up weapon from adjacent tile (not just same tile)", () => {
  const world = makeWorld(2);
  const lich = placeLich(world, 8, 5);
  const sword = placeWeapon(world, 9, 5); // 1 tile east

  aiWeaponPickupSystem(world);

  const eq = world.get(lich, Equipment);
  assertEquals(eq.weapon, sword, 'lich should pick up weapon from adjacent tile');
  assert(!world.has(sword, Position), 'sword removed from floor');
});

Deno.test("lich does NOT pick up a weapon when already armed", () => {
  const world = makeWorld(3);
  const lich = placeLich(world, 8, 5);

  // Pre-arm the lich.
  const existingWeapon = world.create();
  world.mutate(lich, Equipment, r => { r.weapon = existingWeapon; });

  const newSword = placeWeapon(world, 8, 5);

  aiWeaponPickupSystem(world);

  const eq = world.get(lich, Equipment);
  assertEquals(eq.weapon, existingWeapon, 'lich should keep its existing weapon');
  assert(world.has(newSword, Position), 'new sword should stay on floor');
});

Deno.test("lich does NOT pick up weapons while unaware (not hunting)", () => {
  const world = makeWorld(4);
  const lich = placeLich(world, 8, 5);

  // Override to unaware state.
  world.mutate(lich, AggroState, r => { r.alertLevel = AGGRO_LEVELS.unaware; });

  const sword = placeWeapon(world, 8, 5);

  aiWeaponPickupSystem(world);

  const eq = world.get(lich, Equipment);
  assertEquals(eq.weapon, null, 'unaware lich should not pick up weapons');
  assert(world.has(sword, Position), 'sword should remain on floor');
});

Deno.test("goblin (intelligence 4) does NOT pick up weapons — not sapient enough", () => {
  const world = makeWorld(5);

  const goblin = world.create();
  world.add(goblin, Position, { x: 8, y: 5 });
  world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  world.add(goblin, Faction, { key: 'enemy' });
  world.add(goblin, Equipment, {
    weapon: null, armor: null, head: null, neck: null, belt: null,
    gloves: null, offhand: null, ring1: null, ring2: null,
    legs: null, ammo: null, ranged: null, feet: null,
    accuracyDerived: 1, damagePowerDerived: 1, evadeDerived: 0,
    maxHpDerived: 0, critChanceDerived: 0, critMultDerived: 0,
    manaRegenDerived: 0, maxManaDerived: 0,
    staminaRegenDerived: 0, maxStaminaDerived: 0,
    kineticDRDerived: 0, fireResistDerived: 0, poisonResistDerived: 0,
    acidResistDerived: 0, radiationResistDerived: 0, electricOhmsDerived: 0,
    bluntResistDerived: 0, slashResistDerived: 0, pierceResistDerived: 0,
    luckDerived: 0, visionRangeDerived: 0, hungerRateDerived: 0,
    naturalDamageDice: '1d4', naturalScript: null,
  });
  world.add(goblin, AggroState, {
    alertLevel: AGGRO_LEVELS.hunting,
    lastKnownX: 5, lastKnownY: 5,
    searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
    retreating: false,
  });

  const sword = placeWeapon(world, 8, 5);

  aiWeaponPickupSystem(world);

  const eq = world.get(goblin, Equipment);
  assertEquals(eq.weapon, null, 'goblin is not sapient enough to pick up weapons');
  assert(world.has(sword, Position), 'sword should remain on floor');
});

Deno.test("pickup event is emitted when lich arms itself", () => {
  const world = makeWorld(6);
  const lich = placeLich(world, 8, 5);
  const sword = placeWeapon(world, 8, 5);

  const pickups = [];
  world.on('pickup', (ev) => pickups.push(ev));

  aiWeaponPickupSystem(world);

  assertEquals(pickups.length, 1, 'pickup event should be emitted');
  assertEquals(pickups[0].id, lich);
  assertEquals(pickups[0].itemId, sword);
});
