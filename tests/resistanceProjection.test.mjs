import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Resistances } from '../src/rules/components/Resistences.js';
import { dealDamage, resolveResistance } from '../src/rules/utils/dealDamage.js';

function makeEquip(world, { name, id, slot, bonuses, affixes = [] }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type: 'equip', slot, weight: 1, value: 0, description: '', count: 1, bonuses: bonuses || {}, rarity: 1, rarityName: 'common', affixes });
  return eid;
}

function makeActor(world, resistances = {}) {
  const id = world.create();
  world.add(id, Equipment, {});
  world.add(id, Vitality, { maxHp: 100, hp: 100 });
  world.add(id, Resistances, resistances);
  return id;
}

// ── equipmentSystem accumulation ────────────────────────────────────

Deno.test("equipmentSystem: accumulates fireResist from item bonuses", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const ring = makeEquip(world, { name: 'Fire Ring', id: 'ring_fire', slot: 'ring', bonuses: { fireResist: 0.3 } });
  eq.ring1 = ring;
  equipmentSystem(world);
  assertEquals(eq.fireResistDerived, 0.3);
});

Deno.test("equipmentSystem: stacks resistance from multiple items", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const ring1 = makeEquip(world, { name: 'Fire Ring 1', id: 'ring_fire1', slot: 'ring', bonuses: { fireResist: 0.2 } });
  const ring2 = makeEquip(world, { name: 'Fire Ring 2', id: 'ring_fire2', slot: 'ring', bonuses: { fireResist: 0.15 } });
  eq.ring1 = ring1;
  eq.ring2 = ring2;
  equipmentSystem(world);
  assert(Math.abs(eq.fireResistDerived - 0.35) < 1e-9, `expected ~0.35, got ${eq.fireResistDerived}`);
});

Deno.test("equipmentSystem: accumulates kineticDR from item bonuses", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const armor = makeEquip(world, { name: 'Plate', id: 'plate', slot: 'armor', bonuses: { kineticDR: 3 } });
  eq.armor = armor;
  equipmentSystem(world);
  assertEquals(eq.kineticDRDerived, 3);
});

Deno.test("equipmentSystem: accumulates electricOhms from item bonuses", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const ring = makeEquip(world, { name: 'Insulated Ring', id: 'ring_ohms', slot: 'ring', bonuses: { electricOhms: 500 } });
  eq.ring1 = ring;
  equipmentSystem(world);
  assertEquals(eq.electricOhmsDerived, 500);
});

Deno.test("equipmentSystem: affix passive adds electric ohms", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const armor = makeEquip(world, { name: 'Insulated Armor', id: 'insulated_armor', slot: 'armor', bonuses: {}, affixes: ['insulated1'] });
  eq.armor = armor;
  equipmentSystem(world);
  assertEquals(eq.electricOhmsDerived, 600);
});

Deno.test("equipmentSystem: affix passive adds fire resistance", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const armor = makeEquip(world, { name: 'Ward Armor', id: 'ward_armor', slot: 'armor', bonuses: {}, affixes: ['fireWard1'] });
  eq.armor = armor;
  equipmentSystem(world);
  assertEquals(eq.fireResistDerived, 0.15);
});

Deno.test("equipmentSystem: item bonus + affix stack on same item", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const eq = world.get(actor, Equipment);
  const armor = makeEquip(world, { name: 'Fire Armor', id: 'fire_armor', slot: 'armor', bonuses: { fireResist: 0.1 }, affixes: ['fireWard1'] });
  eq.armor = armor;
  equipmentSystem(world);
  assert(Math.abs(eq.fireResistDerived - 0.25) < 1e-9, `expected ~0.25, got ${eq.fireResistDerived}`);
});

// ── resolveResistance with equipment bonuses ────────────────────────

Deno.test("resolveResistance: equipment fire resistance reduces fire damage", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { thermal: { burnMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.fireResistDerived = 0.3;
  // 10 * max(0, 1.0 - 0.3) = 10 * 0.7 = 7
  assertEquals(resolveResistance(world, actor, 10, 'fire'), 7);
});

Deno.test("resolveResistance: combines base and equipment fire resistance", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { thermal: { burnMult: 0.8 } });
  const eq = world.get(actor, Equipment);
  eq.fireResistDerived = 0.3;
  // 10 * max(0, 0.8 - 0.3) = 10 * 0.5 = 5
  assertEquals(resolveResistance(world, actor, 10, 'fire'), 5);
});

Deno.test("resolveResistance: clamps effective multiplier at 0 (full immunity)", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { thermal: { burnMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.fireResistDerived = 1.5;
  assertEquals(resolveResistance(world, actor, 10, 'fire'), 0);
});

Deno.test("resolveResistance: equipment kineticDR adds to base DR for physical", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { kinetic: { DR: 2 } });
  const eq = world.get(actor, Equipment);
  eq.kineticDRDerived = 3;
  // 10 - (2 + 3) = 5
  assertEquals(resolveResistance(world, actor, 10, 'physical'), 5);
});

Deno.test("resolveResistance: equipment slash resistance with DR bonus", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { kinetic: { DR: 2, slashMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.kineticDRDerived = 1;
  eq.slashResistDerived = 0.2;
  // afterDR = 10 - (2+1) = 7, effectiveMult = max(0, 1.0-0.2) = 0.8, floor(7*0.8) = 5
  assertEquals(resolveResistance(world, actor, 10, 'slash'), 5);
});

Deno.test("resolveResistance: equipment poison resistance", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { chemical: { toxMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.poisonResistDerived = 0.3;
  // 10 * max(0, 1.0 - 0.3) = 7
  assertEquals(resolveResistance(world, actor, 10, 'poison'), 7);
});

Deno.test("resolveResistance: equipment acid resistance", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { chemical: { acidMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.acidResistDerived = 0.4;
  // 10 * max(0, 1.0 - 0.4) = 6
  assertEquals(resolveResistance(world, actor, 10, 'acid'), 6);
});

Deno.test("resolveResistance: equipment radiation resistance", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { radiation: { gamma: 1.0 } });
  const eq = world.get(actor, Equipment);
  eq.radiationResistDerived = 0.4;
  // 10 * max(0, 1.0 - 0.4) = 6
  assertEquals(resolveResistance(world, actor, 10, 'radiation'), 6);
});

Deno.test("resolveResistance: no Equipment component falls back to base behavior", () => {
  const world = new World({ seed: 1 });
  const id = world.create();
  world.add(id, Vitality, { maxHp: 100, hp: 100 });
  world.add(id, Resistances, { thermal: { burnMult: 0.5 } });
  // no Equipment component
  assertEquals(resolveResistance(world, id, 10, 'fire'), 5);
});

// ── Full integration ────────────────────────────────────────────────

Deno.test("dealDamage: equipped fire resist ring reduces fire damage end-to-end", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world, { thermal: { burnMult: 1.0 } });
  const eq = world.get(actor, Equipment);
  const ring = makeEquip(world, { name: 'Fire Ring', id: 'ring_fire', slot: 'ring', bonuses: { fireResist: 0.3 } });
  eq.ring1 = ring;
  equipmentSystem(world);

  const result = dealDamage(world, { target: actor, amount: 10, type: 'fire' });
  assertEquals(result.applied, true);
  assertEquals(result.amount, 7);
  assertEquals(result.rawAmount, 10);
  assertEquals(world.get(actor, Vitality).hp, 93);
});
