import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Inventory } from '../src/rules/components/Inventory.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';
import { buildEquipmentItem } from '../src/rules/data/equipmentLoader.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';

function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

async function run() {
  const world = new World({ seed: 12345 });

  // Create player with Inventory and Equipment
  const player = createPlayer(world, { x: 0, y: 0 });
  /** @type {any} */
  const inv = world.get(player, Inventory);
  /** @type {any} */
  const eq = world.get(player, Equipment);

  // Build two pieces of equipment
  const sword = buildEquipmentItem(world, 'sword_plain', {}); // attack +2
  const armor = buildEquipmentItem(world, 'leather_armor', {}); // defense +1

  // Place both into inventory stacks (must be present for equip system)
  inv.items.push(sword);
  inv.items.push(armor);

  // Equip sword
  world.add(player, EquipIntent, { itemId: sword });
  equipItemSystem(world); // resolve intent
  equipmentSystem(world); // update derived stats

  assert(eq.weapon === sword, 'sword equipped in weapon slot');
  // New behavior: equipped items remain visible in inventory for UI
  assert(inv.items.includes(sword), 'sword remains in inventory (visible)');
  assert(eq.attackDerived === 2, 'attack derived from sword bonuses');

  // Equip armor
  world.add(player, EquipIntent, { itemId: armor });
  equipItemSystem(world);
  equipmentSystem(world);

  assert(eq.armor === armor, 'armor equipped in armor slot');
  // New behavior: equipped items remain visible in inventory for UI
  assert(inv.items.includes(armor), 'armor remains in inventory (visible)');
  assert(eq.defenseDerived >= 1, 'defense derived from armor bonuses');

  // Ensure counts remain 1 when equipped
  /** @type {any} */
  const infoSword = world.get(sword, ItemInfo);
  /** @type {any} */
  const infoArmor = world.get(armor, ItemInfo);
  assert((infoSword?.count || 0) === 1, 'sword count is 1');
  assert((infoArmor?.count || 0) === 1, 'armor count is 1');

  console.log('EquipIntent flow tests PASS');
}

run().catch(e => { console.error(e); process.exitCode = 1; });
