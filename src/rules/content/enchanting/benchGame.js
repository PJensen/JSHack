import { Inventory } from "../../components/Inventory.js";
import { Position } from "../../components/Position.js";
import { createItemById } from "../../utils/itemFactory.js";
import { addToInventory, consumeFromStack, getStackCount } from "../../utils/inventoryFacade.js";
import { ENCHANTING_INGREDIENTS, getEnchantScrollDef, listEnchantRecipeDefs } from "./enchantCatalog.js";

const INSTALLED_KEY = Symbol.for("jshack:enchanting:openRequest:installed");

function safeCountIngredient(world, actor, identity) {
  return Math.max(0, Number(getStackCount(world, actor, identity) || 0) | 0);
}

export function countEnchantingIngredients(world, actor) {
  return Object.fromEntries(
    Object.entries(ENCHANTING_INGREDIENTS).map(([key, def]) => [key, safeCountIngredient(world, actor, def.identity)]),
  );
}

function findRecipe(recipeKey) {
  const key = String(recipeKey || "").trim().toLowerCase();
  if (!key) return null;
  const recipes = listEnchantRecipeDefs();
  for (let i = 0; i < recipes.length; i++) {
    if (recipes[i].key === key) return recipes[i];
  }
  return null;
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

export function emitEnchantingBenchOpen(world, actor, targetId, options = {}) {
  const ingredients = countEnchantingIngredients(world, actor);
  const recipes = listEnchantRecipeDefs().map((recipe) => ({
    ...recipe,
    metadata: { tier: 1, rarity: "magic" },
    canCraft: hasEnoughIngredients(ingredients, recipe.requirements || {}),
  }));
  world.emit?.("enchanting:open", {
    actor,
    targetId,
    ingredients,
    recipes,
    title: String(options.title || "✧ Enchanting Bench"),
    subtitle: String(options.subtitle || "Bind reagents and gold into a scroll, then apply it to your gear."),
  });
}

export function craftAtEnchantingBench(world, actor, targetId, recipeKey, options = {}) {
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
    emitEnchantingBenchOpen(world, actor, targetId, options);
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
    emitEnchantingBenchOpen(world, actor, targetId, options);
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
    metadata: { tier: 1, rarity: "magic" },
    requirements: { ...(recipe.requirements || {}) },
  });
  emitEnchantingBenchOpen(world, actor, targetId, options);
  return true;
}

export function installEnchantingOpenRequestListener(world) {
  if (!world || world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;
  world.on("enchanting:openRequest", ({ actorId, targetId, title, subtitle }) => {
    const actor = Number(actorId || 0) | 0;
    const target = Number(targetId || 0) | 0;
    if (!(actor > 0) || !(target > 0)) return;
    emitEnchantingBenchOpen(world, actor, target, { title, subtitle });
  });
}

export function getEnchantScrollRecipe(itemId) {
  return getEnchantScrollDef(itemId);
}
