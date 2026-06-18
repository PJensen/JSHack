// rules/content/cooking/cookingGame.js
// Cooking fire interaction logic: convert corpses and ingredients into food.

import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Position } from "../../components/Position.js";
import { inventoryItems, inventoryContains, addToInventory, consumeFromStack, removeFromInventory } from "../../utils/inventoryFacade.js";
import { FoodDecay } from "../../components/FoodDecay.js";
import { COOKING_INGREDIENTS, COOKING_RECIPES, getCookingRecipe } from "../../data/cookingRecipes.js";
import { transmogrify } from "../../utils/transmogrify.js";
import { SHELF_LIFE_RATION } from "../../data/food.js";
import { createItemById } from "../../utils/itemFactory.js";

/**
 * Scan the actor's inventory for cookable corpses, ingredients, and tools.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @returns {{ corpses: number[], herbs: { count: number, items: number[] }, ingredients: Record<string, number> }}
 */
function gatherCookables(world, actor) {
  const corpses = [];
  const herbs = { count: 0, items: [] };
  const ingredients = {};
  for (const key of Object.keys(COOKING_INGREDIENTS)) ingredients[key] = 0;

  for (const itemId of inventoryItems(world, actor)) {
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const ni = world.get(itemId, NamedIdentity);
    if (!ni) continue;
    const identity = String(ni.identity || "");
    const info = world.get(itemId, ItemInfo);
    const count = Math.max(1, Number(info?.count || 1) | 0);

    if (identity.startsWith("corpse_")) {
      corpses.push(itemId);
      ingredients.corpse = Math.max(0, Number(ingredients.corpse || 0) | 0) + count;
    } else if (identity === "food_wild_herbs") {
      herbs.count += count;
      herbs.items.push(itemId);
    }

    for (const [key, def] of Object.entries(COOKING_INGREDIENTS)) {
      if (def.identity && identity === def.identity) {
        ingredients[key] = Math.max(0, Number(ingredients[key] || 0) | 0) + count;
      }
    }
  }
  return { corpses, herbs, ingredients };
}

function hasEnoughIngredients(counts, requirements) {
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const [key, raw] of Object.entries(req)) {
    const need = Math.max(0, Number(raw || 0) | 0);
    if (need <= 0) continue;
    const have = Math.max(0, Number(counts?.[key] || 0) | 0);
    if (have < need) return false;
  }
  return true;
}

function missingIngredients(counts, requirements) {
  const out = {};
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const [key, raw] of Object.entries(req)) {
    const need = Math.max(0, Number(raw || 0) | 0);
    if (need <= 0) continue;
    const have = Math.max(0, Number(counts?.[key] || 0) | 0);
    if (have < need) out[key] = need - have;
  }
  return out;
}

function consumeByIdentity(world, actor, identity, amount) {
  const need = Math.max(0, Number(amount || 0) | 0);
  if (need <= 0) return true;
  const result = consumeFromStack(world, actor, identity, need);
  for (const itemId of result.entities) {
    try { world.destroy(itemId); } catch {}
  }
  return result.consumed >= need;
}

function consumeCorpse(world, actor, amount) {
  let remaining = Math.max(0, Number(amount || 0) | 0);
  if (remaining <= 0) return true;
  for (const itemId of inventoryItems(world, actor)) {
    if (remaining <= 0) break;
    const ni = world.get(itemId, NamedIdentity);
    if (!String(ni?.identity || "").startsWith("corpse_")) continue;
    removeFromInventory(world, actor, itemId);
    try { world.destroy(itemId); } catch {}
    remaining--;
  }
  return remaining <= 0;
}

function consumeCookingRequirements(world, actor, requirements) {
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const [key, raw] of Object.entries(req)) {
    const need = Math.max(0, Number(raw || 0) | 0);
    if (need <= 0) continue;
    if (key === "corpse") {
      if (!consumeCorpse(world, actor, need)) return false;
      continue;
    }
    const def = COOKING_INGREDIENTS[key];
    if (!def?.identity) continue;
    if (!consumeByIdentity(world, actor, def.identity, need)) return false;
  }
  return true;
}

function recipePayload(recipe, ingredients) {
  return {
    key: recipe.key,
    label: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    requirements: { ...(recipe.requirements || {}) },
    consumes: { ...(recipe.consumes || recipe.requirements || {}) },
    canCraft: hasEnoughIngredients(ingredients, recipe.requirements || {}),
    flavor: recipe.flavor,
  };
}

function giveCookedItem(world, actor, outputIdentity) {
  const itemId = createItemById(world, outputIdentity);
  if (!(itemId > 0)) return 0;
  if (world.has(actor, Inventory) && addToInventory(world, actor, itemId)) return itemId;
  const pos = world.get(actor, Position);
  if (pos) world.add(itemId, Position, { x: pos.x, y: pos.y });
  return itemId;
}

/**
 * Emit the cooking UI payload for the current inventory state.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} targetId
 */
export function emitCookingFireOpen(world, actor, targetId) {
  const { corpses, herbs, ingredients } = gatherCookables(world, actor);
  const recipes = COOKING_RECIPES.map((recipe) => recipePayload(recipe, ingredients));
  world.emit?.("cooking:open", { actor, targetId, corpses, herbs, ingredients, recipes });
}

export function cookRecipeAtFire(world, actor, targetId, recipeKey) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("cooking:result", { actor, targetId, result: "no_inventory", recipeKey: String(recipeKey || "") });
    return false;
  }

  const recipe = getCookingRecipe(recipeKey);
  if (!recipe) {
    emitCookingFireOpen(world, actor, targetId);
    world.emit?.("cooking:result", { actor, targetId, result: "unknown_recipe", recipeKey: String(recipeKey || "") });
    return false;
  }

  const { ingredients } = gatherCookables(world, actor);
  if (!hasEnoughIngredients(ingredients, recipe.requirements || {})) {
    emitCookingFireOpen(world, actor, targetId);
    world.emit?.("cooking:result", {
      actor,
      targetId,
      result: "missing_ingredients",
      recipeKey: recipe.key,
      missing: missingIngredients(ingredients, recipe.requirements || {}),
      have: ingredients,
    });
    return false;
  }

  if (!consumeCookingRequirements(world, actor, recipe.consumes || recipe.requirements || {})) {
    emitCookingFireOpen(world, actor, targetId);
    world.emit?.("cooking:result", { actor, targetId, result: "consume_failed", recipeKey: recipe.key });
    return false;
  }

  const itemId = giveCookedItem(world, actor, recipe.outputIdentity);
  if (!(itemId > 0)) {
    world.emit?.("cooking:result", { actor, targetId, result: "create_failed", recipeKey: recipe.key });
    return false;
  }

  world.emit?.("cooking:cooked", {
    actor,
    targetId,
    itemId,
    fromName: recipe.label,
    toIdentity: recipe.outputIdentity,
    outputIdentity: recipe.outputIdentity,
    recipeKey: recipe.key,
    recipeLabel: recipe.label,
  });
  emitCookingFireOpen(world, actor, targetId);
  return true;
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

  // Notify inventory layer so quick chip fires for the new item.
  world.emit?.("inventory:added", { ownerId: actor, itemId: corpseItemId });

  // Refresh the cooking UI with updated inventory.
  emitCookingFireOpen(world, actor, targetId);
}
