import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Potion } from "../src/rules/components/Potion.js";
import { ApplyIntent } from "../src/rules/components/Intents/ApplyIntent.js";
import { applySystem } from "../src/rules/systems/applySystem.js";
import { isIdentified, resetIdentification } from "../src/rules/data/identification.js";

Deno.test("touchstone apply def identifies gem targets", () => {
  resetIdentification();
  const world = new World({ seed: 1001 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  const inv = world.get(actor, Inventory);

  const touchstone = createItemById(world, "stone_touchstone");
  const gem = createItemById(world, "gem_ruby");
  assert(touchstone != null, "touchstone should be creatable");
  assert(gem != null, "gem should be creatable");
  inv.items.push(touchstone, gem);

  world.add(actor, ApplyIntent, { itemId: touchstone, targetItemId: gem });
  applySystem(world);

  assertEquals(isIdentified("gem_ruby"), true);
  assert(world.isAlive(touchstone), "touchstone should not be consumed");
});

Deno.test("poison potion apply def coats weapon and consumes the potion", () => {
  const world = new World({ seed: 1002 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  const inv = world.get(actor, Inventory);

  const potion = world.create();
  world.add(potion, NamedIdentity, { name: "Potion of Poison", identity: "potion_poison" });
  world.add(potion, ItemInfo, {
    type: "potion",
    slot: "",
    weight: 1,
    value: 20,
    description: "A toxic brew.",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  world.add(potion, Potion, {
    name: "Potion of Poison",
    route: "oral",
    doses: 1,
    channels: [],
    effects: [],
    toxicity: null,
  });

  const dagger = buildCatalogItem(world, "dagger_quick");
  inv.items.push(potion, dagger);

  world.add(actor, ApplyIntent, { itemId: potion, targetItemId: dagger });
  applySystem(world);

  const daggerInfo = world.get(dagger, ItemInfo);
  assert(daggerInfo?.coating, "dagger should receive a coating payload");
  assertEquals(daggerInfo.coating.kind, "poison");
  assert(daggerInfo.coating.charges >= 12, "poison coating should set charges");
  assert(!world.isAlive(potion), "poison potion should be consumed");
  assert(!inv.items.includes(potion), "consumed potion should be removed from inventory");
});

