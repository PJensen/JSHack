import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { executeInteraction } from "../src/rules/interaction/runtime/actionRuntime.js";
import {
  listApplyTargetsForTool,
  resolveApplyPayloadForWorld,
} from "../src/rules/content/items/applyPayloads.js";
import { applyPipeline } from "../src/rules/interaction/verbs/applyPipeline.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { resetIdentification } from "../src/rules/data/identification.js";

/**
 * @param {World} world
 */
function createActorWithInventory(world) {
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  return actor;
}

/**
 * @param {number[]} ids
 */
function toIdSet(ids) {
  const out = new Set();
  for (let i = 0; i < ids.length; i++) out.add(ids[i] | 0);
  return out;
}

Deno.test("apply target listing and payload resolver agree for touchstone", () => {
  resetIdentification();
  const world = new World({ seed: 7301 });
  const actor = createActorWithInventory(world);
  const inv = world.get(actor, Inventory);

  const toolId = createItemById(world, "stone_touchstone");
  const gemId = createItemById(world, "gem_ruby");
  const daggerId = buildCatalogItem(world, "dagger_quick");
  inv.items.push(toolId, gemId, daggerId);

  const listedTargets = listApplyTargetsForTool(world, actor, toolId);
  const targetSet = toIdSet(listedTargets);
  assert(targetSet.has(gemId), "touchstone should list gem target");
  assert(!targetSet.has(daggerId), "touchstone should not list weapon target");

  const candidates = [gemId, daggerId];
  for (let i = 0; i < candidates.length; i++) {
    const targetId = candidates[i];
    const resolved = resolveApplyPayloadForWorld(world, { actor, toolId, targetId });
    assertEquals(!!resolved.payloadDef, targetSet.has(targetId));
  }

  const runtimeResult = executeInteraction(world, {
    verb: "apply",
    actor,
    primary: toolId,
    target: gemId,
    params: {},
    pipeline: applyPipeline,
  });
  assertEquals(runtimeResult.ok, true);
  assertEquals(runtimeResult.metrics.path, "payload");
  assertEquals(runtimeResult.metrics.payloadMatched, true);
});

Deno.test("apply target listing and payload resolver agree for hook-native on_dip tools", () => {
  const world = new World({ seed: 7302 });
  const actor = createActorWithInventory(world);
  const inv = world.get(actor, Inventory);

  const toolId = createItemById(world, "potion_stoneskin");
  const daggerId = buildCatalogItem(world, "dagger_quick");
  const armorId = buildCatalogItem(world, "leather_armor");
  const bagItemId = createItemById(world, "potion_health");
  inv.items.push(toolId, daggerId, armorId, bagItemId);

  const listedTargets = listApplyTargetsForTool(world, actor, toolId);
  const targetSet = toIdSet(listedTargets);
  assert(targetSet.size >= 1, "hook-native dip tool should expose at least one target");
  assert(!targetSet.has(bagItemId), "hook-native dip tool should filter out non-equip bag items");

  const candidates = [daggerId, armorId, bagItemId];
  for (let i = 0; i < candidates.length; i++) {
    const targetId = candidates[i];
    const resolved = resolveApplyPayloadForWorld(world, { actor, toolId, targetId });
    assertEquals(!!resolved.payloadDef, targetSet.has(targetId));
  }

  const runtimeTarget = listedTargets[0];
  const runtimeResult = executeInteraction(world, {
    verb: "apply",
    actor,
    primary: toolId,
    target: runtimeTarget,
    params: {},
    pipeline: applyPipeline,
  });
  assertEquals(runtimeResult.ok, true);
  assertEquals(runtimeResult.metrics.path, "payload");
  assertEquals(runtimeResult.metrics.payloadMatched, true);
});
