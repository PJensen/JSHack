import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { createPlayer } from '../src/rules/archetypes/Player.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { EquipIntent } from '../src/rules/components/Intents/EquipIntent.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { equipItemSystem } from '../src/rules/systems/equipItemSystem.js';
import { buildCatalogItem } from '../src/rules/data/itemCatalogLoader.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { addToInventory, inventoryContains } from '../src/rules/utils/inventoryFacade.js';

Deno.test("equip intent flow: equip sword and armor with derived stats", () => {
  const world = new World({ seed: 12345 });

  const player = createPlayer(world, { x: 0, y: 0 });
  /** @type {any} */
  const eq = world.get(player, Equipment);

  const sword = buildCatalogItem(world, 'sword_plain', {});
  const armor = buildCatalogItem(world, 'leather_armor', {});

  addToInventory(world, player, sword);
  addToInventory(world, player, armor);

  world.add(player, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  equipmentSystem(world);

  assert(eq.weapon === sword, 'sword equipped in weapon slot');
  assert(inventoryContains(world, player, sword), 'sword remains in inventory (visible)');
  assert(eq.attackDerived === 2, 'attack derived from sword bonuses');

  world.add(player, EquipIntent, { itemId: armor });
  equipItemSystem(world);
  equipmentSystem(world);

  assert(eq.armor === armor, 'armor equipped in armor slot');
  assert(inventoryContains(world, player, armor), 'armor remains in inventory (visible)');
  assert(eq.defenseDerived >= 1, 'defense derived from armor bonuses');

  /** @type {any} */
  const infoSword = world.get(sword, ItemInfo);
  /** @type {any} */
  const infoArmor = world.get(armor, ItemInfo);
  assert((infoSword?.count || 0) === 1, 'sword count is 1');
  assert((infoArmor?.count || 0) === 1, 'armor count is 1');
});
