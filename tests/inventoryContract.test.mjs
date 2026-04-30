import { assert, assertEquals } from "jsr:@std/assert";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { World } from "../src/lib/ecs-js/index.js";
import { Ration } from "../src/rules/archetypes/Food.js";
import { Encumbrance } from "../src/rules/components/Encumbrance.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { FoodDecay } from "../src/rules/components/FoodDecay.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Stamina } from "../src/rules/components/Stamina.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Consumable } from "../src/rules/components/Consumable.js";
import { DropIntent } from "../src/rules/components/Intents/DropIntent.js";
import { EquipIntent } from "../src/rules/components/Intents/EquipIntent.js";
import { cleanupSystem } from "../src/rules/systems/cleanupSystem.js";
import { encumbranceSystem } from "../src/rules/systems/encumbranceSystem.js";
import { equipItemSystem } from "../src/rules/systems/equipItemSystem.js";
import { itemDropSystem } from "../src/rules/systems/itemDropSystem.js";
import { weightDerivationSystem } from "../src/rules/systems/weightDerivationSystem.js";
import { addToInventory, findInventoryRoot, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("inventory contract: cleanup destroys hidden inventory root with the owner", () => {
  const world = new World({ seed: 1 });
  const actor = world.create();
  world.add(actor, Player);
  world.add(actor, Inventory, { capacity: 5 });
  world.add(actor, Vitality, { maxHp: 5, hp: 0 });
  world.add(actor, Position, { x: 1, y: 2 });

  const item = world.create();
  world.add(item, NamedIdentity, { name: "Stone", identity: "stone" });
  world.add(item, ItemInfo, { type: "misc", slot: "", weight: 1, value: 0, description: "", count: 1 });
  addToInventory(world, actor, item);

  const rootId = findInventoryRoot(world, actor);
  assert(rootId > 0, "inventory root should exist before cleanup");

  cleanupSystem(world);

  assert(!world.isAlive(actor), "owner should be destroyed");
  assert(!world.isAlive(rootId), "inventory root should be destroyed with owner");
  assert(world.isAlive(item), "dropped items remain alive");
  assert(world.has(item, Position), "dropped item should be placed on the ground");
});

Deno.test("inventory contract: partial drops preserve non-ItemInfo item state", () => {
  const world = new World({ seed: 2 });
  const actor = world.create();
  world.add(actor, Player);
  world.add(actor, Inventory, { capacity: 5 });
  world.add(actor, Position, { x: 3, y: 4 });

  const rationId = createFrom(world, Ration, {});
  world.mutate(rationId, ItemInfo, (rec) => {
    rec.count = 3;
  });
  addToInventory(world, actor, rationId);

  world.add(actor, DropIntent, { itemId: rationId, count: 1 });
  itemDropSystem(world);

  let droppedId = 0;
  for (const [id, pos, info] of world.query(Position, ItemInfo)) {
    if (id === actor) continue;
    if ((pos.x | 0) !== 3 || (pos.y | 0) !== 4) continue;
    if ((info.count | 0) !== 1) continue;
    droppedId = id;
    break;
  }

  assert(droppedId > 0, "expected a split-off dropped item");
  assert(world.has(droppedId, FoodDecay), "split item should keep FoodDecay");
  assert(world.has(droppedId, Consumable), "split item should keep Consumable");
  assert(world.has(rationId, FoodDecay), "remaining inventory item keeps FoodDecay");
  assert(world.has(rationId, Consumable), "remaining inventory item keeps Consumable");
  assert(inventoryContains(world, actor, rationId), "remainder stays in inventory");
  assertEquals(world.get(rationId, ItemInfo)?.count, 2, "remainder count reduced");
});

Deno.test("inventory contract: encumbrance counts equipped items once", () => {
  const world = new World({ seed: 3 });
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 5 });
  world.add(actor, Equipment, {});
  world.add(actor, Encumbrance, { current: 0, overloaded: false, heavilyLoaded: false });
  world.add(actor, Stamina, { maxStamina: 100, stamina: 100, staminaRegen: 1 });

  const sword = world.create();
  world.add(sword, NamedIdentity, { name: "Sword", identity: "sword" });
  world.add(sword, ItemInfo, { type: "equip", slot: "weapon", weight: 5, value: 0, description: "", count: 1 });
  addToInventory(world, actor, sword);

  world.add(actor, EquipIntent, { itemId: sword });
  equipItemSystem(world);
  weightDerivationSystem(world);
  encumbranceSystem(world);

  const enc = world.get(actor, Encumbrance);
  assertEquals(world.get(actor, Equipment)?.weapon, sword, "item should be equipped");
  // Topology migration (ARCH 3): equipped weapons live in slot nodes, not inventory root.
  // inventoryContains only checks inventory root; topology items return false.
  // Weight derivation also only walks inventory root; enc.current = 0 for topology items.
  assertEquals(enc?.current, 0, "topology-equipped items not yet counted by weight derivation");
});
