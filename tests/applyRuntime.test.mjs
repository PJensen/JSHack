import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { resetIdentification, isIdentified } from "../src/rules/data/identification.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { executeInteraction } from "../src/rules/interaction/runtime/actionRuntime.js";
import { applyPipeline } from "../src/rules/interaction/verbs/applyPipeline.js";
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("apply runtime uses item-def hook for touchstone identify", () => {
  resetIdentification();
  const world = new World({ seed: 2201 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const toolId = createItemById(world, "stone_touchstone");
  const targetId = createItemById(world, "gem_ruby");
  addToInventory(world, actor, toolId);
  addToInventory(world, actor, targetId);

  const appliedEvents = [];
  world.on("item:applied", (ev) => appliedEvents.push(ev));

  const result = executeInteraction(world, {
    verb: "apply",
    actor,
    primary: toolId,
    target: targetId,
    params: {},
    pipeline: applyPipeline,
  });

  assertEquals(result.ok, true);
  assertEquals(result.canceled, false);
  assertEquals(result.metrics.path, "payload");
  assertEquals(result.metrics.payloadMatched, true);
  assertEquals(isIdentified("gem_ruby"), true);
  assertEquals(appliedEvents.length, 1);
  assert(world.isAlive(toolId), "touchstone should not be consumed");
});

Deno.test("apply runtime item-def hook coats weapon and consumes poison potion", () => {
  const world = new World({ seed: 2202 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const potion = createItemById(world, "potion_poison");
  assert(potion != null, "poison potion should be creatable from item catalog");

  const dagger = buildCatalogItem(world, "dagger_quick");
  addToInventory(world, actor, potion);
  addToInventory(world, actor, dagger);

  const appliedEvents = [];
  const usedEvents = [];
  world.on("item:applied", (ev) => appliedEvents.push(ev));
  world.on("item:used", (ev) => usedEvents.push(ev));

  const result = executeInteraction(world, {
    verb: "apply",
    actor,
    primary: potion,
    target: dagger,
    params: {},
    pipeline: applyPipeline,
  });

  assertEquals(result.ok, true);
  assertEquals(result.metrics.path, "payload");
  assertEquals(result.metrics.consumedTool, true);

  const daggerInfo = world.get(dagger, ItemInfo);
  assert(daggerInfo?.coating, "weapon should gain coating");
  assertEquals(daggerInfo.coating.kind, "poison");
  assert(daggerInfo.coating.charges >= 12);
  assert(!world.isAlive(potion), "poison potion should be consumed by runtime");
  assert(!inventoryContains(world, actor, potion), "consumed potion should be removed from inventory");
  assertEquals(appliedEvents.length, 1);
  assertEquals(usedEvents.length, 1);
  assertEquals(Number(usedEvents[0]?.itemId || 0), potion);
});
