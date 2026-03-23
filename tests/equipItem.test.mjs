import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';
import { addToInventory, inventoryContains } from '../src/rules/utils/inventoryFacade.js';

function makeItem(world, { id, name, slot, type = 'equip', count = 1 }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name, identity: id });
  world.add(eid, ItemInfo, { type, slot, weight: 1, value: 0, description: '', count, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });
  return eid;
}

Deno.test("equip item system: weapon, armor, head, neck, belt, gloves, legs, rings, shield, ranged, swap, and edge cases", () => {
  const world = new World({ seed: 1 });

  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  // Equip weapon
  const sword = makeItem(world, { id: 'sword', name: 'Sword', slot: 'weapon' });
  addToInventory(world, actor, sword);

  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);

  let eq = world.get(actor, Equipment);
  assert(eq.weapon === sword, `weapon should be sword, got ${eq.weapon}`);
  assert(!world.has(actor, EquipIntent), 'EquipIntent should be consumed');

  // Equip second 1H weapon → cascades to offhand (dual-wield)
  const axe = makeItem(world, { id: 'axe', name: 'Axe', slot: 'weapon' });
  addToInventory(world, actor, axe);

  world.add(actor, EquipIntent, { itemId: axe });
  equipItemSystem(world);

  eq = world.get(actor, Equipment);
  assert(eq.weapon === sword, `weapon should still be sword, got ${eq.weapon}`);
  assert(eq.offhand === axe, `offhand should be axe, got ${eq.offhand}`);

  // Equip third weapon → replaces weapon slot (offhand occupied)
  const mace = makeItem(world, { id: 'mace', name: 'Mace', slot: 'weapon' });
  addToInventory(world, actor, mace);

  world.add(actor, EquipIntent, { itemId: mace });
  equipItemSystem(world);

  eq = world.get(actor, Equipment);
  assert(eq.weapon === mace, `weapon should be mace, got ${eq.weapon}`);
  assert(eq.offhand === axe, `offhand should still be axe, got ${eq.offhand}`);
  assert(inventoryContains(world, actor, sword), 'old sword should be back in inventory');

  // Equip armor
  const plate = makeItem(world, { id: 'plate', name: 'Plate', slot: 'armor' });
  addToInventory(world, actor, plate);

  world.add(actor, EquipIntent, { itemId: plate });
  equipItemSystem(world);

  eq = world.get(actor, Equipment);
  assert(eq.armor === plate, `armor should be plate, got ${eq.armor}`);

  // Equip head slot
  const helm = makeItem(world, { id: 'helm_iron', name: 'Iron Helm', slot: 'head' });
  addToInventory(world, actor, helm);
  world.add(actor, EquipIntent, { itemId: helm });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.head === helm, `head should be iron helm, got ${eq.head}`);

  // Equip neck slot
  const amulet = makeItem(world, { id: 'amulet_guarded', name: 'Guarded Amulet', slot: 'neck' });
  addToInventory(world, actor, amulet);
  world.add(actor, EquipIntent, { itemId: amulet });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.neck === amulet, `neck should be guarded amulet, got ${eq.neck}`);

  // Equip belt slot
  const belt = makeItem(world, { id: 'belt_leather', name: 'Leather Belt', slot: 'belt' });
  addToInventory(world, actor, belt);
  world.add(actor, EquipIntent, { itemId: belt });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.belt === belt, `belt should be leather belt, got ${eq.belt}`);

  // Equip gloves slot
  const gloves = makeItem(world, { id: 'gloves_leather', name: 'Leather Gloves', slot: 'gloves' });
  addToInventory(world, actor, gloves);
  world.add(actor, EquipIntent, { itemId: gloves });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.gloves === gloves, `gloves should be leather gloves, got ${eq.gloves}`);

  // Equip legs slot
  const leggings = makeItem(world, { id: 'leggings_leather', name: 'Leather Leggings', slot: 'legs' });
  addToInventory(world, actor, leggings);
  world.add(actor, EquipIntent, { itemId: leggings });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.legs === leggings, `legs should be leather leggings, got ${eq.legs}`);

  // Equip rings: first fills ring1, second fills ring2, third swaps ring1
  const ring1 = makeItem(world, { id: 'ring_a', name: 'Ruby Ring', slot: 'ring' });
  const ring2 = makeItem(world, { id: 'ring_b', name: 'Gold Ring', slot: 'ring' });
  const ring3 = makeItem(world, { id: 'ring_c', name: 'Iron Ring', slot: 'ring' });
  addToInventory(world, actor, ring1);
  addToInventory(world, actor, ring2);
  addToInventory(world, actor, ring3);

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
  assert(inventoryContains(world, actor, ring1), 'displaced ruby ring should be in inventory');

  // Equip offhand
  const shield = makeItem(world, { id: 'buckler', name: 'Buckler', slot: 'offhand' });
  addToInventory(world, actor, shield);

  world.add(actor, EquipIntent, { itemId: shield });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.offhand === shield, `offhand should be buckler, got ${eq.offhand}`);

  // Equip feet slot
  const boots = makeItem(world, { id: 'boots_leather', name: 'Leather Boots', slot: 'feet' });
  addToInventory(world, actor, boots);
  world.add(actor, EquipIntent, { itemId: boots });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.feet === boots, `feet should be leather boots, got ${eq.feet}`);

  // Equip ranged bow
  const bow = makeItem(world, { id: 'bow_short', name: 'Short Bow', slot: 'ranged', type: 'equip' });
  addToInventory(world, actor, bow);
  world.add(actor, EquipIntent, { itemId: bow });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.ranged === bow, `ranged should be short bow, got ${eq.ranged}`);

  // Equip ranged wand; previous ranged item should be displaced.
  const wand = makeItem(world, { id: 'wand_frost', name: 'Wand of Frost', slot: 'ranged', type: 'wand', count: 3 });
  addToInventory(world, actor, wand);
  world.add(actor, EquipIntent, { itemId: wand });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  const wandInfo = world.get(wand, ItemInfo);
  assert(eq.ranged === wand, `ranged should be wand, got ${eq.ranged}`);
  assert(inventoryContains(world, actor, bow), 'displaced bow should be back in inventory');
  assert((wandInfo?.count || 0) === 3, `wand charges should be preserved, got ${(wandInfo?.count || 0)}`);

  // Invalid: item not in inventory
  const ghost = makeItem(world, { id: 'ghost', name: 'Ghost Blade', slot: 'weapon' });
  world.add(actor, EquipIntent, { itemId: ghost });
  equipItemSystem(world);
  eq = world.get(actor, Equipment);
  assert(eq.weapon === mace, 'weapon should still be mace (ghost not in inventory)');

  // Invalid: non-equip item
  const potion = world.create();
  world.add(potion, NamedIdentity, { name: 'Potion', identity: 'potion' });
  world.add(potion, ItemInfo, { type: 'potion', slot: '', weight: 1, value: 5, description: '', count: 1, bonuses: {}, rarity: 1, rarityName: 'common', affixes: [] });
  addToInventory(world, actor, potion);

  world.add(actor, EquipIntent, { itemId: potion });
  equipItemSystem(world);
  assert(!world.has(actor, EquipIntent), 'intent consumed even for non-equip item');
});

Deno.test("equip item system: selecting an already equipped starter item unequips it", () => {
  const world = new World({ seed: 2 });

  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const starterSword = makeItem(world, { id: 'starter_sword', name: 'Starter Sword', slot: 'weapon' });
  addToInventory(world, actor, starterSword);

  const eq = world.get(actor, Equipment);
  eq.weapon = starterSword; // Simulate "starts equipped"

  world.add(actor, EquipIntent, { itemId: starterSword });
  equipItemSystem(world);

  assert(eq.weapon == null, 'starter weapon should unequip when selected again');
  assert(inventoryContains(world, actor, starterSword), 'unequipped item remains in inventory');
  assert(!world.has(actor, EquipIntent), 'EquipIntent should be consumed');
});

Deno.test("equip item system: equipping ammo removes it from inventory and keeps it in ammo slot", () => {
  const world = new World({ seed: 3 });

  const actor = world.create();
  world.add(actor, Inventory, { capacity: 100 });
  world.add(actor, Equipment, {});

  const ammo = makeItem(world, { id: 'ammo_blunt_arrows', name: 'Blunt-Head Arrows', slot: 'ammo', type: 'ammo', count: 6 });
  addToInventory(world, actor, ammo);
  assert(inventoryContains(world, actor, ammo), 'ammo should start in inventory');

  world.add(actor, EquipIntent, { itemId: ammo });
  equipItemSystem(world);

  const eq = world.get(actor, Equipment);
  assert(eq.ammo === ammo, 'ammo should equip to ammo slot');
  assert(!inventoryContains(world, actor, ammo), 'equipped ammo should not remain in inventory');
  assert(!world.has(actor, EquipIntent), 'EquipIntent should be consumed');
});
