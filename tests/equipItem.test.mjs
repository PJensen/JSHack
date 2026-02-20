import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';

function makeItem(world, { id, name, slot, type = 'equip', count = 1 }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type, slot, weight: 1, value: 0, description: '', count, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });
  return eid;
}

Deno.test("equip item system: weapon, armor, rings, shield, ranged, swap, and edge cases", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, Equipment, {});

  // Equip weapon
  const sword = makeItem(world, { id: 'sword', name: 'Sword', slot: 'weapon' });
  const inv = world.get(actor, Inventory);
  inv.items.push(sword);

  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);

  let eq = world.get(actor, Equipment);
  assert(eq.weapon === sword, `weapon should be sword, got ${eq.weapon}`);
  assert(!world.has(actor, EquipIntent), 'EquipIntent should be consumed');

  // Swap weapon
  const axe = makeItem(world, { id: 'axe', name: 'Axe', slot: 'weapon' });
  inv.items.push(axe);

  world.add(actor, EquipIntent, { itemId: axe });
  equipItemSystem(world);

  eq = world.get(actor, Equipment);
  assert(eq.weapon === axe, `weapon should be axe, got ${eq.weapon}`);
  assert(inv.items.includes(sword), 'old sword should be back in inventory');

  // Equip armor
  const plate = makeItem(world, { id: 'plate', name: 'Plate', slot: 'armor' });
  inv.items.push(plate);

  world.add(actor, EquipIntent, { itemId: plate });
  equipItemSystem(world);

  eq = world.get(actor, Equipment);
  assert(eq.armor === plate, `armor should be plate, got ${eq.armor}`);

  // Equip rings: first fills ring1, second fills ring2, third swaps ring1
  const ring1 = makeItem(world, { id: 'ring_a', name: 'Ruby Ring', slot: 'ring' });
  const ring2 = makeItem(world, { id: 'ring_b', name: 'Gold Ring', slot: 'ring' });
  const ring3 = makeItem(world, { id: 'ring_c', name: 'Iron Ring', slot: 'ring' });
  inv.items.push(ring1, ring2, ring3);

  world.add(actor, EquipIntent, { itemId: ring1 });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.ring1 === ring1, `ring1 slot should have ruby ring, got ${eq.ring1}`);

  world.add(actor, EquipIntent, { itemId: ring2 });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.ring2 === ring2, `ring2 slot should have gold ring, got ${eq.ring2}`);

  world.add(actor, EquipIntent, { itemId: ring3 });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.ring1 === ring3, `ring1 should be swapped to iron ring, got ${eq.ring1}`);
  assert(inv.items.includes(ring1), 'displaced ruby ring should be in inventory');

  // Equip shield
  const shield = makeItem(world, { id: 'buckler', name: 'Buckler', slot: 'shield' });
  inv.items.push(shield);

  world.add(actor, EquipIntent, { itemId: shield });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.shield === shield, `shield should be buckler, got ${eq.shield}`);

  // Equip ranged bow
  const bow = makeItem(world, { id: 'bow_short', name: 'Short Bow', slot: 'ranged', type: 'equip' });
  inv.items.push(bow);
  world.add(actor, EquipIntent, { itemId: bow });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.ranged === bow, `ranged should be short bow, got ${eq.ranged}`);

  // Equip ranged wand; previous ranged item should be displaced.
  const wand = makeItem(world, { id: 'wand_frost', name: 'Wand of Frost', slot: 'ranged', type: 'wand', count: 3 });
  inv.items.push(wand);
  world.add(actor, EquipIntent, { itemId: wand });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  const wandInfo = world.get(wand, ItemInfo);
  assert(eq.ranged === wand, `ranged should be wand, got ${eq.ranged}`);
  assert(inv.items.includes(bow), 'displaced bow should be back in inventory');
  assert((wandInfo?.count || 0) === 3, `wand charges should be preserved, got ${(wandInfo?.count || 0)}`);

  // Invalid: item not in inventory
  const ghost = makeItem(world, { id: 'ghost', name: 'Ghost Blade', slot: 'weapon' });
  world.add(actor, EquipIntent, { itemId: ghost });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.weapon === axe, 'weapon should still be axe (ghost not in inventory)');

  // Invalid: non-equip item
  const potion = world.create();
  world.add(potion, NamedIdentity, { name: 'Potion', identity: 'potion' });
  world.add(potion, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });
  inv.items.push(potion);

  world.add(actor, EquipIntent, { itemId: potion });
  equipItemSystem(world);
  assert(!world.has(actor, EquipIntent), 'intent consumed even for non-equip item');
});
