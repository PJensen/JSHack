// Lichen: tier 0, sessile, never-rotting corpse, safe food source.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { FoodDecay } from "../src/rules/components/FoodDecay.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { getMonster, getMonstersByTier } from "../src/rules/data/monsters.js";
import { getCorpseDef } from "../src/rules/data/corpseFood.js";
import { foodDecaySystem } from "../src/rules/systems/foodDecaySystem.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";

function makeWorld(seed = 1) {
  return new World({ seed });
}

Deno.test("lichen: exists in monster data as tier 0", () => {
  const def = getMonster('lichen');
  assert(def, "lichen should exist in monster data");
  assertEquals(def.tier, 0);
  assertEquals(def.intelligence, 1);
  assert(def.ambush === true, "lichen should be an ambusher");
  assertEquals(def.sizeClass, 'XS');
  assertEquals(def.damageDice, '1d2');
});

Deno.test("lichen: appears in tier 0 spawn pool", () => {
  const pool = getMonstersByTier(0);
  const found = pool.find(m => m.id === 'lichen');
  assert(found, "lichen should be in tier 0 pool");
});

Deno.test("lichen: corpse def exists with bonus nutrition", () => {
  const def = getCorpseDef('lichen');
  assert(def, "corpse_lichen should exist");
  assert(Array.isArray(def.onEat), "should have onEat hooks");
  assert(def.onEat.length > 0, "should have at least one eat hook (bonus nutrition)");
});

Deno.test("lichen: corpse never decays in inventory", () => {
  const world = makeWorld(1);

  // Create an owner with inventory
  const owner = world.create();
  world.add(owner, Inventory, { capacity: 20 });

  // Create a lichen corpse item in their inventory
  const corpse = world.create();
  world.add(corpse, NamedIdentity, { name: "Lichen Corpse", identity: "corpse_lichen" });
  world.add(corpse, ItemInfo, { type: "food", slot: "bag", weight: 1, value: 0, description: "", count: 1, bonuses: {} });
  world.add(corpse, FoodDecay, { turnsHeld: 0, shelfLife: 150 });
  addToInventory(world, owner, corpse);

  // Run decay system many turns
  for (let i = 0; i < 200; i++) {
    foodDecaySystem(world);
  }

  // Lichen corpse should not have decayed (turnsHeld stays at 0)
  const decay = world.get(corpse, FoodDecay);
  assertEquals(decay.turnsHeld, 0, "lichen corpse should never increment turnsHeld");
});
