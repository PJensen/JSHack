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
  addCatalogItem(world, actor, "reagent_venom_frond", 2);
  addCatalogItem(world, actor, "reagent_thorn_pod", 1);
  addCatalogItem(world, actor, "potion_oil", 1);
  addStackedGold(world, actor, 55);

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
  assertEquals(getStackCount(world, actor, "potion_oil"), 0);
  assertEquals(getStackCount(world, actor, "reagent_venom_frond"), 0);
  assert(
    inventoryItems(world, actor).some((id) => world.get(id, ItemInfo)?.type === "scroll" && crafted[0]?.itemId === id),
    "actor should receive the crafted enchant scroll",
  );
});

Deno.test("enchant scroll applies a persistent affix and rejects duplicate applications", () => {
  const world = new World({ seed: 1202 });
  const actor = makeActor(world);
  const weapon = createItemById(world, "dagger_quick");
  const firstScroll = createItemById(world, "scroll_enchant_fire");
  assert(weapon > 0 && firstScroll > 0, "required test items should be creatable");
  addToInventory(world, actor, weapon);
  addToInventory(world, actor, firstScroll);

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

  const secondScroll = createItemById(world, "scroll_enchant_fire");
  addToInventory(world, actor, secondScroll);
  world.add(actor, ApplyIntent, { itemId: secondScroll, targetItemId: weapon });
  applySystem(world);

  assertEquals(results.length, 2);
  assertEquals(results[1]?.ok, false);
  assertEquals(cancelled.length, 1);
  assertEquals(cancelled[0]?.code, "ENCHANT_ALREADY_PRESENT");
  assert(world.isAlive(secondScroll), "duplicate enchant should not consume the scroll");
});
