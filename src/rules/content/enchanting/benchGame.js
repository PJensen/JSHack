import { Inventory } from "../../components/Inventory.js";
import { Position } from "../../components/Position.js";
import { createItemById } from "../../utils/itemFactory.js";
import { addToInventory, consumeFromStack, getStackCount } from "../../utils/inventoryFacade.js";

export const ENCHANTING_INGREDIENTS = Object.freeze({
  emberRoot: Object.freeze({ identity: "reagent_ember_root", label: "Ember Root" }),
  moonleaf: Object.freeze({ identity: "reagent_moonleaf", label: "Moonleaf" }),
  thornPods: Object.freeze({ identity: "reagent_thorn_pod", label: "Thorn Pods" }),
  venomFronds: Object.freeze({ identity: "reagent_venom_frond", label: "Venom Fronds" }),
  oil: Object.freeze({ identity: "potion_oil", label: "Flask of Oil" }),
  water: Object.freeze({ identity: "potion_water", label: "Water Flask" }),
  gold: Object.freeze({ identity: "gold", label: "Gold" }),
});

export const ENCHANTING_RECIPES = Object.freeze([
  Object.freeze({
    key: "venomous_script",
    label: "Venomous Script",
    outputIdentity: "scroll_enchant_poison",
    outputName: "Scroll of Venom Binding",
    enchantType: "poison",
    affixId: "venomous1",
    metadata: Object.freeze({ tier: 1, rarity: "magic" }),
    requirements: Object.freeze({ venomFronds: 2, thornPods: 1, oil: 1, gold: 55 }),
    effectSummary: "On hit, your gear can lace enemies with poison.",
    flavor: "Fronds, resin, and oil are worked into a bitter green script.",
  }),
  Object.freeze({
    key: "firestorm_script",
    label: "Firestorm Script",
    outputIdentity: "scroll_enchant_fire",
    outputName: "Scroll of Firestorm Binding",
    enchantType: "fire",
    affixId: "firestorm1",
    metadata: Object.freeze({ tier: 1, rarity: "magic" }),
    requirements: Object.freeze({ emberRoot: 2, thornPods: 1, oil: 1, gold: 60 }),
    effectSummary: "On hit, your gear can kindle burning fire damage.",
    flavor: "The scroll drinks heat from ember root and flashes with sparks.",
  }),
  Object.freeze({
    key: "frostbite_script",
    label: "Frostbite Script",
    outputIdentity: "scroll_enchant_frost",
    outputName: "Scroll of Frost Binding",
    enchantType: "frost",
    affixId: "frostbite1",
    metadata: Object.freeze({ tier: 1, rarity: "magic" }),
    requirements: Object.freeze({ moonleaf: 2, water: 1, thornPods: 1, gold: 60 }),
    effectSummary: "On hit, your gear can chill enemies with frost.",
    flavor: "Cold silver leaf and clean water dry into a pale blue sigil.",
  }),
]);

function findRecipe(recipeKey) {
  const key = String(recipeKey || "").trim().toLowerCase();
  if (!key) return null;
  for (const recipe of ENCHANTING_RECIPES) {
    if (recipe.key === key) return recipe;
  }
  return null;
}

function safeCountIngredient(world, actor, identity) {
  return Math.max(0, Number(getStackCount(world, actor, identity) || 0) | 0);
}

function countEnchantingIngredients(world, actor) {
  return {
    emberRoot: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.emberRoot.identity),
    moonleaf: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.moonleaf.identity),
    thornPods: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.thornPods.identity),
    venomFronds: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.venomFronds.identity),
    oil: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.oil.identity),
    water: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.water.identity),
    gold: safeCountIngredient(world, actor, ENCHANTING_INGREDIENTS.gold.identity),
  };
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

function consumeByIdentity(world, actor, identity, amount) {
  const remaining = Math.max(0, Number(amount || 0) | 0);
  if (remaining <= 0) return true;
  const result = consumeFromStack(world, actor, identity, remaining);
  if (result.consumed < remaining) return false;
  for (const entityId of result.entities) {
    try { world.destroy(entityId); } catch {}
  }
  return true;
}

function consumeRequirements(world, actor, requirements) {
  const req = (requirements && typeof requirements === "object") ? requirements : {};
  for (const [key, raw] of Object.entries(req)) {
    const ingredient = ENCHANTING_INGREDIENTS[key];
    const need = Math.max(0, Number(raw || 0) | 0);
    if (!ingredient || need <= 0) continue;
    if (!consumeByIdentity(world, actor, ingredient.identity, need)) return false;
  }
  return true;
}

function giveCraftedItem(world, actor, itemId) {
  const createdId = createItemById(world, itemId);
  if (!(createdId > 0)) return 0;
  if (world.has(actor, Inventory) && addToInventory(world, actor, createdId)) return createdId;
  const pos = world.get(actor, Position);
  if (pos) world.add(createdId, Position, { x: pos.x, y: pos.y });
  return createdId;
}

export function emitEnchantingBenchOpen(world, actor, targetId) {
  const ingredients = countEnchantingIngredients(world, actor);
  const recipes = ENCHANTING_RECIPES.map((recipe) => ({
    key: recipe.key,
    label: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    enchantType: recipe.enchantType,
    affixId: recipe.affixId,
    metadata: { ...(recipe.metadata || {}) },
    requirements: { ...(recipe.requirements || {}) },
    canCraft: hasEnoughIngredients(ingredients, recipe.requirements || {}),
    effectSummary: recipe.effectSummary,
    flavor: recipe.flavor,
  }));
  world.emit?.("enchanting:open", { actor, targetId, ingredients, recipes });
}

export function craftAtEnchantingBench(world, actor, targetId, recipeKey) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("enchanting:result", {
      actor,
      targetId,
      result: "no_inventory",
      recipeKey: String(recipeKey || ""),
    });
    return false;
  }

  const recipe = findRecipe(recipeKey);
  if (!recipe) {
    emitEnchantingBenchOpen(world, actor, targetId);
    world.emit?.("enchanting:result", {
      actor,
      targetId,
      result: "unknown_recipe",
      recipeKey: String(recipeKey || ""),
    });
    return false;
  }

  const ingredients = countEnchantingIngredients(world, actor);
  if (!hasEnoughIngredients(ingredients, recipe.requirements || {})) {
    const missing = {};
    for (const key of Object.keys(ENCHANTING_INGREDIENTS)) {
      const required = Math.max(0, Number(recipe.requirements?.[key] || 0) | 0);
      missing[key] = Math.max(0, required - Math.max(0, Number(ingredients[key] || 0) | 0));
    }
    emitEnchantingBenchOpen(world, actor, targetId);
    world.emit?.("enchanting:result", {
      actor,
      targetId,
      result: "missing_requirements",
      recipeKey: recipe.key,
      missing,
      have: ingredients,
      need: { ...(recipe.requirements || {}) },
    });
    return false;
  }

  if (!consumeRequirements(world, actor, recipe.requirements || {})) {
    world.emit?.("enchanting:result", {
      actor,
      targetId,
      result: "consume_failed",
      recipeKey: recipe.key,
    });
    return false;
  }

  const itemId = giveCraftedItem(world, actor, recipe.outputIdentity);
  if (!(itemId > 0)) {
    world.emit?.("enchanting:result", {
      actor,
      targetId,
      result: "craft_failed",
      recipeKey: recipe.key,
    });
    return false;
  }

  world.emit?.("enchanting:crafted", {
    actor,
    targetId,
    itemId,
    recipeKey: recipe.key,
    recipeLabel: recipe.label,
    outputIdentity: recipe.outputIdentity,
    outputName: recipe.outputName,
    enchantType: recipe.enchantType,
    affixId: recipe.affixId,
    metadata: { ...(recipe.metadata || {}) },
    requirements: { ...(recipe.requirements || {}) },
  });
  emitEnchantingBenchOpen(world, actor, targetId);
  return true;
}
