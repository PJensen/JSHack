import { Inventory } from "../../components/Inventory.js";
import { SMITH_RECIPES } from "../../data/smithRecipes.js";
import { addToInventory, consumeFromStack, getStackCount } from "../../utils/inventoryFacade.js";
import { Position } from "../../components/Position.js";
import { createItemById } from "../../utils/itemFactory.js";

function countMaterials(world, actor) {
  return {
    iron: Math.max(0, Number(getStackCount(world, actor, "material_iron") || 0) | 0),
    lumber: Math.max(0, Number(getStackCount(world, actor, "material_lumber") || 0) | 0),
  };
}

function hasEnough(counts, recipe) {
  return counts.iron >= recipe.iron && counts.lumber >= recipe.lumber;
}

function consumeIdentityUnits(world, ownerId, identity, amount) {
  const result = consumeFromStack(world, ownerId, identity, amount);
  if (result.consumed < amount) return false;
  for (const itemId of result.entities) {
    try { world.destroy(itemId); } catch {}
  }
  return true;
}

function giveCraftedItem(world, ownerId, itemId) {
  const createdId = createItemById(world, itemId);
  if (!(createdId > 0)) return 0;
  if (world.has(ownerId, Inventory) && addToInventory(world, ownerId, createdId)) return createdId;
  const pos = world.get(ownerId, Position);
  if (pos) world.add(createdId, Position, { x: pos.x, y: pos.y });
  return createdId;
}

function findRecipe(recipeKey) {
  const key = String(recipeKey || "").trim().toLowerCase();
  if (!key) return null;
  for (const recipe of SMITH_RECIPES) {
    if (recipe.key === key) return recipe;
  }
  return null;
}

export function emitAnvilOpen(world, actor, targetId) {
  const materials = countMaterials(world, actor);
  const recipes = SMITH_RECIPES.map((recipe) => ({
    key: recipe.key,
    itemId: recipe.itemId,
    outputName: recipe.outputName,
    iron: recipe.iron,
    lumber: recipe.lumber,
    canCraft: hasEnough(materials, recipe),
    owned: Math.max(0, Number(getStackCount(world, actor, recipe.itemId) || 0) | 0),
  }));
  world.emit?.("smithy:open", { actor, targetId, station: "anvil", materials, recipes });
}

export function forgeAtAnvil(world, actor, targetId, recipeKey) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "no_inventory", station: "anvil" });
    return false;
  }

  const recipe = findRecipe(recipeKey);
  if (!recipe) {
    emitAnvilOpen(world, actor, targetId);
    world.emit?.("smithy:failed", { actor, targetId, reason: "unknown_recipe", station: "anvil", recipeKey: String(recipeKey || "") });
    return false;
  }

  const materials = countMaterials(world, actor);
  if (!hasEnough(materials, recipe)) {
    emitAnvilOpen(world, actor, targetId);
    world.emit?.("smithy:failed", {
      actor,
      targetId,
      reason: materials.iron < recipe.iron ? "missing_iron" : "missing_lumber",
      station: "anvil",
      recipeKey: recipe.key,
      need: { iron: recipe.iron, lumber: recipe.lumber },
      have: materials,
    });
    return false;
  }

  if (!consumeIdentityUnits(world, actor, "material_iron", recipe.iron)
    || !consumeIdentityUnits(world, actor, "material_lumber", recipe.lumber)) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "consume_failed", station: "anvil", recipeKey: recipe.key });
    return false;
  }

  const itemId = giveCraftedItem(world, actor, recipe.itemId);
  world.emit?.("smithy:forged", {
    actor,
    targetId,
    itemId,
    recipeKey: recipe.key,
    outputIdentity: recipe.itemId,
    outputName: recipe.outputName,
  });
  emitAnvilOpen(world, actor, targetId);
  return true;
}
