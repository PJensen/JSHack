import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { ApplyIntent } from "../src/rules/components/Intents/ApplyIntent.js";
import { applySystem } from "../src/rules/systems/applySystem.js";
import { isIdentified, resetIdentification } from "../src/rules/data/identification.js";
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("touchstone apply hook identifies gem targets", () => {
  resetIdentification();
  const world = new World({ seed: 1001 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const touchstone = createItemById(world, "stone_touchstone");
  const gem = createItemById(world, "gem_ruby");
  assert(touchstone != null, "touchstone should be creatable");
  assert(gem != null, "gem should be creatable");
  addToInventory(world, actor, touchstone);
  addToInventory(world, actor, gem);

  world.add(actor, ApplyIntent, { itemId: touchstone, targetItemId: gem });
  applySystem(world);

  assertEquals(isIdentified("gem_ruby"), true);
  assert(world.isAlive(touchstone), "touchstone should not be consumed");
});

Deno.test("poison potion apply hook coats weapon and consumes the potion", () => {
  const world = new World({ seed: 1002 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  const appliedEvents = [];
  const usedEvents = [];
  world.on("item:applied", (ev) => appliedEvents.push(ev));
  world.on("item:used", (ev) => usedEvents.push(ev));

  const potion = createItemById(world, "potion_poison");
  assert(potion != null, "poison potion should be creatable from item catalog");

  const dagger = buildCatalogItem(world, "dagger_quick");
  const daggerInfoBefore = world.get(dagger, ItemInfo);
  daggerInfoBefore.coating = { kind: "poison", charges: 5 };
  world.set(dagger, ItemInfo, daggerInfoBefore);
  addToInventory(world, actor, potion);
  addToInventory(world, actor, dagger);

  world.add(actor, ApplyIntent, { itemId: potion, targetItemId: dagger });
  applySystem(world);

  const daggerInfo = world.get(dagger, ItemInfo);
  assert(daggerInfo?.coating, "dagger should receive a coating payload");
  assertEquals(daggerInfo.coating.kind, "poison");
  assertEquals(daggerInfo.coating.charges, 17, "poison coating should add granted charges on top of existing");
  assertEquals(appliedEvents.length, 1);
  assert(String(appliedEvents[0]?.result?.type || ""), "poison_coat");
  assert(
    String(appliedEvents[0]?.result?.message || "").includes("poison"),
    "poison apply hook should provide message text in result payload",
  );
  assertEquals(Number(appliedEvents[0]?.result?.chargesGranted || 0), 12);
  assertEquals(Number(appliedEvents[0]?.result?.chargesTotal || 0), 17);
  assert(
    String(appliedEvents[0]?.result?.message || "").includes("17"),
    "poison apply message should interpolate computed total charges",
  );
  assert(!world.isAlive(potion), "poison potion should be consumed");
  assert(!inventoryContains(world, actor, potion), "consumed potion should be removed from inventory");
  assertEquals(usedEvents.length, 1);
  assertEquals(Number(usedEvents[0]?.itemId || 0), potion);
});
