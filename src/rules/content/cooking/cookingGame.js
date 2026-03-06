// rules/content/cooking/cookingGame.js
// Cooking fire interaction logic: convert corpses into rations.
// Future: herbs as optional seasoning, varied recipes.

import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { inventoryItems, inventoryContains } from "../../utils/inventoryFacade.js";
import { FoodDecay } from "../../components/FoodDecay.js";
import { transmogrify } from "../../utils/transmogrify.js";
import { SHELF_LIFE_RATION } from "../../data/food.js";

/**
 * Scan the actor's inventory for cookable corpses and available herbs.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @returns {{ corpses: number[], herbs: { count: number, items: number[] } }}
 */
function gatherCookables(world, actor) {
  const corpses = [];
  const herbs = { count: 0, items: [] };

  for (const itemId of inventoryItems(world, actor)) {
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const ni = world.get(itemId, NamedIdentity);
    if (!ni) continue;

    if (String(ni.identity || "").startsWith("corpse_")) {
      corpses.push(itemId);
    } else if (ni.identity === "food_wild_herbs") {
      const info = world.get(itemId, ItemInfo);
      const count = Math.max(1, Number(info?.count || 1) | 0);
      herbs.count += count;
      herbs.items.push(itemId);
    }
  }
  return { corpses, herbs };
}

/**
 * Emit the cooking UI payload for the current inventory state.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} targetId
 */
export function emitCookingFireOpen(world, actor, targetId) {
  const { corpses, herbs } = gatherCookables(world, actor);
  world.emit?.("cooking:open", { actor, targetId, corpses, herbs });
}

/**
 * Execute a cook request: transmogrify one corpse into a ration.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} targetId
 * @param {number} corpseItemId
 */
export function cookAtFire(world, actor, targetId, corpseItemId) {
  if (!inventoryContains(world, actor, corpseItemId)) {
    world.emit?.("cooking:failed", { actor, targetId, itemId: corpseItemId, reason: "not_owned" });
    return;
  }

  const ni = world.get(corpseItemId, NamedIdentity);
  if (!ni || !String(ni.identity || "").startsWith("corpse_")) {
    world.emit?.("cooking:failed", { actor, targetId, itemId: corpseItemId, reason: "not_corpse" });
    return;
  }

  const fromName = ni.name || "corpse";

  const result = transmogrify(world, corpseItemId, "food_ration");
  if (!result.ok) {
    world.emit?.("cooking:failed", { actor, targetId, itemId: corpseItemId, reason: "transmogrify_failed" });
    return;
  }

  // Reset decay — freshly cooked food with ration shelf life.
  if (world.has(corpseItemId, FoodDecay)) {
    world.mutate(corpseItemId, FoodDecay, (fd) => {
      fd.turnsHeld = 0;
      fd.shelfLife = SHELF_LIFE_RATION;
    });
  } else {
    world.add(corpseItemId, FoodDecay, { turnsHeld: 0, shelfLife: SHELF_LIFE_RATION });
  }

  world.emit?.("cooking:cooked", {
    actor,
    targetId,
    itemId: corpseItemId,
    fromName,
    toIdentity: "food_ration",
  });

  // Refresh the cooking UI with updated inventory.
  emitCookingFireOpen(world, actor, targetId);
}
