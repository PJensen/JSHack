import { createFrom } from "../../../lib/ecs-js/archetype.js";
import { HealthPotion } from "../../archetypes/Items.js";
import { Inventory } from "../../components/Inventory.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { buildCatalogItem } from "../../data/itemCatalogLoader.js";
import { inventoryItems, addToInventory, consumeFromStack } from "../../utils/inventoryFacade.js";

export const ALCHEMY_INGREDIENTS = Object.freeze({
  berries: Object.freeze({ identity: "food_wild_berries", label: "berries" }),
  herbs: Object.freeze({ identity: "food_wild_herbs", label: "herbs" }),
  thornPods: Object.freeze({ identity: "reagent_thorn_pod", label: "thorn pods" }),
  venomFronds: Object.freeze({ identity: "reagent_venom_frond", label: "venom fronds" }),
  moonleaf: Object.freeze({ identity: "reagent_moonleaf", label: "moonleaf" }),
  emberRoot: Object.freeze({ identity: "reagent_ember_root", label: "ember root" }),
});

export const ALCHEMY_RECIPES = Object.freeze([
  Object.freeze({
    key: "vital_tonic",
    label: "Vital Tonic",
    outputIdentity: "potion_health",
    outputName: "Health Potion",
    outputCount: 1,
    requirements: Object.freeze({ berries: 2, herbs: 1 }),
    flavor: "A bright tonic that closes wounds.",
  }),
  Object.freeze({
    key: "venom_draft",
    label: "Venom Draft",
    outputIdentity: "potion_poison",
    outputName: "Potion of Poison",
    outputCount: 1,
    requirements: Object.freeze({ thornPods: 1, venomFronds: 2 }),
    flavor: "A bitter poison perfect for coating blades.",
  }),
  Object.freeze({
    key: "caustic_venom",
    label: "Caustic Venom",
    outputIdentity: "potion_poison",
    outputName: "Potion of Poison",
    outputCount: 2,
    requirements: Object.freeze({ thornPods: 2, venomFronds: 3 }),
    flavor: "A hotter batch that often yields two vials.",
  }),
  Object.freeze({
    key: "stone_skin_tincture",
    label: "Stone Skin Tincture",
    outputIdentity: "potion_stoneskin",
    outputName: "Potion of Stoneskin",
    outputCount: 1,
    requirements: Object.freeze({ herbs: 2, thornPods: 1 }),
    flavor: "Granular suspension that hardens flesh and gear.",
  }),
  Object.freeze({
    key: "moon_tonic",
    label: "Moon Tonic",
    outputIdentity: "potion_mana",
    outputName: "Potion of Mana",
    outputCount: 1,
    requirements: Object.freeze({ herbs: 1, moonleaf: 2 }),
    flavor: "A cool draught that steadies the mind and replenishes arcane reserves.",
  }),
  Object.freeze({
    key: "antidote_philter",
    label: "Antidote Philter",
    outputIdentity: "potion_anti_venom",
    outputName: "Potion of Antivenom",
    outputCount: 1,
    requirements: Object.freeze({ moonleaf: 1, venomFronds: 1, herbs: 1 }),
    flavor: "Silver leaf and bitter fronds bind into a reliable antidote.",
  }),
  Object.freeze({
    key: "ember_vigor",
    label: "Ember Vigor",
    outputIdentity: "potion_vigor",
    outputName: "Health Potion",
    outputCount: 1,
    requirements: Object.freeze({ berries: 1, emberRoot: 1, herbs: 1 }),
    flavor: "A warming stimulant that puts heat back in tired blood.",
  }),
  Object.freeze({
    key: "fireward_distillate",
    label: "Fireward Distillate",
    outputIdentity: "potion_resist_fire",
    outputName: "Fire Ward Potion",
    outputCount: 1,
    requirements: Object.freeze({ emberRoot: 2, thornPods: 1 }),
    flavor: "A resinous brew that leaves the throat burning and the skin warded.",
  }),
]);

function getInventory(world, actor) {
  return world.get(actor, Inventory) || null;
}

function findRecipe(recipeKey) {
  const key = String(recipeKey || "").trim().toLowerCase();
  if (!key) return null;
  for (const recipe of ALCHEMY_RECIPES) {
    if (recipe.key === key) return recipe;
  }
  return null;
}

/**
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 */
function countIngredients(world, actor) {
  const out = {
    berries: 0,
    herbs: 0,
    thornPods: 0,
    venomFronds: 0,
    moonleaf: 0,
    emberRoot: 0,
  };

  for (const itemId of inventoryItems(world, actor)) {
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const ni = world.get(itemId, NamedIdentity);
    if (!ni) continue;
    const info = world.get(itemId, ItemInfo);
    const count = Math.max(1, Number(info?.count || 1) | 0);

    if (ni.identity === ALCHEMY_INGREDIENTS.berries.identity) out.berries += count;
    if (ni.identity === ALCHEMY_INGREDIENTS.herbs.identity) out.herbs += count;
    if (ni.identity === ALCHEMY_INGREDIENTS.thornPods.identity) out.thornPods += count;
    if (ni.identity === ALCHEMY_INGREDIENTS.venomFronds.identity) out.venomFronds += count;
    if (ni.identity === ALCHEMY_INGREDIENTS.moonleaf.identity) out.moonleaf += count;
    if (ni.identity === ALCHEMY_INGREDIENTS.emberRoot.identity) out.emberRoot += count;
  }
  return out;
}

function hasEnoughIngredients(counts, requirements) {
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const key of Object.keys(req)) {
    const need = Math.max(0, Number(req[key] || 0) | 0);
    if (need <= 0) continue;
    const have = Math.max(0, Number(counts?.[key] || 0) | 0);
    if (have < need) return false;
  }
  return true;
}

function consumeByIdentity(world, actor, identity, amount) {
  let remaining = Math.max(0, Number(amount || 0) | 0);
  if (remaining <= 0) return true;

  const result = consumeFromStack(world, actor, identity, remaining);
  for (const eid of result.entities) {
    try { world.destroy(eid); } catch {} // ECS: entity may already be destroyed
  }
  return result.consumed >= remaining;
}

function consumeIngredients(world, actor, requirements) {
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const key of Object.keys(req)) {
    const ing = ALCHEMY_INGREDIENTS[key];
    if (!ing) continue;
    const need = Math.max(0, Number(req[key] || 0) | 0);
    if (need <= 0) continue;
    if (!consumeByIdentity(world, actor, ing.identity, need)) return false;
  }
  return true;
}

function buildAlchemyProduct(world, outputIdentity) {
  if (String(outputIdentity || "") === "potion_health") {
    return createFrom(world, HealthPotion, {});
  }
  try {
    return buildCatalogItem(world, String(outputIdentity || ""), { count: 1 });
  } catch {
    return 0;
  }
}

/**
 * Emit alchemy UI payload for current inventory state.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} targetId
 */
export function emitAlchemyBenchOpen(world, actor, targetId) {
  const ingredients = countIngredients(world, actor);
  const recipes = ALCHEMY_RECIPES.map((recipe) => ({
    key: recipe.key,
    label: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    outputCount: Math.max(1, Number(recipe.outputCount || 1) | 0),
    requirements: { ...(recipe.requirements || {}) },
    canCraft: hasEnoughIngredients(ingredients, recipe.requirements || {}),
    flavor: recipe.flavor,
  }));
  world.emit?.("alchemy:open", { actor, targetId, ingredients, recipes });
}

/**
 * Resolve one brew request and emit result events.
 * @param {import("../../../lib/ecs-js/index.js").World} world
 * @param {number} actor
 * @param {number} targetId
 * @param {string} recipeKey
 */
export function brewAtAlchemyBench(world, actor, targetId, recipeKey) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "no_inventory",
      recipeKey: String(recipeKey || ""),
    });
    return;
  }

  const recipe = findRecipe(recipeKey);
  if (!recipe) {
    emitAlchemyBenchOpen(world, actor, targetId);
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "unknown_recipe",
      recipeKey: String(recipeKey || ""),
    });
    return;
  }

  const ingredients = countIngredients(world, actor);
  if (!hasEnoughIngredients(ingredients, recipe.requirements || {})) {
    const missing = {};
    const need = {};
    for (const key of Object.keys(ALCHEMY_INGREDIENTS)) {
      const required = Math.max(0, Number(recipe.requirements?.[key] || 0) | 0);
      need[key] = required;
      missing[key] = Math.max(0, required - Math.max(0, Number(ingredients[key] || 0) | 0));
    }
    emitAlchemyBenchOpen(world, actor, targetId);
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "missing_ingredients",
      recipeKey: recipe.key,
      missing,
      have: ingredients,
      need,
    });
    return;
  }

  if (!consumeIngredients(world, actor, recipe.requirements || {})) {
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "consume_failed",
      recipeKey: recipe.key,
    });
    return;
  }

  const outCount = Math.max(1, Number(recipe.outputCount || 1) | 0);
  const itemIds = [];
  for (let i = 0; i < outCount; i++) {
    const itemId = buildAlchemyProduct(world, recipe.outputIdentity);
    if (!(itemId > 0)) continue;
    itemIds.push(itemId);
    addToInventory(world, actor, itemId);
  }
  if (!itemIds.length) {
    world.emit?.("alchemy:result", {
      actor,
      targetId,
      result: "brew_failed",
      recipeKey: recipe.key,
    });
    return;
  }

  world.emit?.("alchemy:crafted", {
    actor,
    targetId,
    recipeKey: recipe.key,
    recipeLabel: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    outputCount: itemIds.length,
    itemIds: itemIds.slice(),
    cost: { ...(recipe.requirements || {}) },
  });
  emitAlchemyBenchOpen(world, actor, targetId);
}
