import { assert, assertEquals } from "jsr:@std/assert";
import { createFrom, World } from "../src/lib/ecs-js/index.js";
import { EnchantingBench } from "../src/rules/archetypes/Overworld.js";
import { GoldStack } from "../src/rules/archetypes/Items.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { ApplyIntent } from "../src/rules/components/Intents/ApplyIntent.js";
import { interactionSystem } from "../src/rules/systems/interactionSystem.js";
import { applySystem } from "../src/rules/systems/applySystem.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { addToInventory, getStackCount, inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import "../src/rules/data/affixes.js";

function makeActor(world) {
  const actor = world.create();
  world.add(actor, Inventory, { items: [], capacity: 20, weightLimit: null });
  return actor;
}

function addStackedGold(world, actor, amount) {
  const gold = createFrom(world, GoldStack, {});
  world.get(gold, ItemInfo).count = Math.max(1, Number(amount || 1) | 0);
  addToInventory(world, actor, gold);
  return gold;
}

function addCatalogItem(world, actor, identity, count = 1) {
  for (let i = 0; i < count; i++) {
    const itemId = createItemById(world, identity);
    assert(itemId > 0, `expected ${identity} to be creatable`);
    addToInventory(world, actor, itemId);
  }
}

Deno.test("enchanting bench crafts a poison enchant scroll from reagents and gold", () => {
  const world = new World({ seed: 1201 });
  const actor = makeActor(world);
  addCatalogItem(world, actor, "reagent_spider_leg", 2);
  addCatalogItem(world, actor, "reagent_venom_gland", 1);
  addCatalogItem(world, actor, "reagent_resin", 1);
  addStackedGold(world, actor, 65);

  const bench = createFrom(world, EnchantingBench, { x: 4, y: 4 });
  const crafted = [];
  world.on("enchanting:crafted", (ev) => crafted.push(ev));

  world.add(actor, InteractIntent, {
    targetId: bench,
    mode: "enchant",
    recipe: "venomous_script",
  });
  interactionSystem(world);

  assertEquals(crafted.length, 1);
  assertEquals(crafted[0]?.outputIdentity, "scroll_enchant_poison");
  assertEquals(getStackCount(world, actor, "gold"), 0);
  assertEquals(getStackCount(world, actor, "reagent_spider_leg"), 0);
  assertEquals(getStackCount(world, actor, "reagent_venom_gland"), 0);
  assertEquals(getStackCount(world, actor, "reagent_resin"), 0);
  assert(
    inventoryItems(world, actor).some((id) => world.get(id, ItemInfo)?.type === "scroll" && crafted[0]?.itemId === id),
    "actor should receive the crafted enchant scroll",
  );
});

Deno.test("enchant scroll applies persistent affixes, supports accessories, and rejects invalid repeats", () => {
  const world = new World({ seed: 1202 });
  const actor = makeActor(world);
  const weapon = createItemById(world, "dagger_quick");
  const firstScroll = createItemById(world, "scroll_enchant_fire");
  const amulet = createItemById(world, "amulet_guarded");
  const wardScroll = createItemById(world, "scroll_enchant_flame_ward");
  assert(weapon > 0 && firstScroll > 0 && amulet > 0 && wardScroll > 0, "required test items should be creatable");
  addToInventory(world, actor, weapon);
  addToInventory(world, actor, amulet);
  addToInventory(world, actor, firstScroll);
  addToInventory(world, actor, wardScroll);

  const results = [];
  const cancelled = [];
  world.on("interaction:result", (ev) => results.push(ev));
  world.on("item:apply-cancelled", (ev) => cancelled.push(ev));

  world.add(actor, ApplyIntent, { itemId: firstScroll, targetItemId: weapon });
  applySystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0]?.ok, true);
  assertEquals(results[0]?.metrics?.consumedTool, true);
  assert(!world.isAlive(firstScroll), "successful enchant should consume the scroll");
  assert((world.get(weapon, ItemInfo)?.affixes || []).includes("firestorm1"));

  world.add(actor, ApplyIntent, { itemId: wardScroll, targetItemId: amulet });
  applySystem(world);

  assertEquals(results.length, 2);
  assertEquals(results[1]?.ok, true);
  assert((world.get(amulet, ItemInfo)?.affixes || []).includes("fireWard1"));

  const secondScroll = createItemById(world, "scroll_enchant_fire");
  addToInventory(world, actor, secondScroll);
  world.add(actor, ApplyIntent, { itemId: secondScroll, targetItemId: weapon });
  applySystem(world);

  assertEquals(results.length, 3);
  assertEquals(results[2]?.ok, false);
  assertEquals(cancelled.length, 1);
  assertEquals(cancelled[0]?.code, "ENCHANT_ALREADY_PRESENT");
  assert(world.isAlive(secondScroll), "duplicate enchant should not consume the scroll");
});

Deno.test("fire weapon scroll rejects incompatible accessory targets", () => {
  const world = new World({ seed: 1203 });
  const actor = makeActor(world);
  const amulet = createItemById(world, "amulet_guarded");
  const fireScroll = createItemById(world, "scroll_enchant_fire");
  assert(amulet > 0 && fireScroll > 0);
  addToInventory(world, actor, amulet);
  addToInventory(world, actor, fireScroll);

  const results = [];
  world.on("interaction:result", (ev) => results.push(ev));

  world.add(actor, ApplyIntent, { itemId: fireScroll, targetItemId: amulet });
  applySystem(world);

  assertEquals(results.length, 1);
  assertEquals(results[0]?.metrics?.payloadMatched, false);
  assertEquals((world.get(amulet, ItemInfo)?.affixes || []).includes("firestorm1"), false);
  assert(world.isAlive(fireScroll), "invalid target should not consume the scroll");
});
