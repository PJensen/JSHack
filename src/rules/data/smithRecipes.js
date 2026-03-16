export const SMITH_RECIPES = Object.freeze([
  Object.freeze({ key: "kitchen_knife", itemId: "tool_kitchen_knife", iron: 1, lumber: 1, outputName: "Kitchen Knife", uniqueUntilOwned: true }),
  Object.freeze({ key: "work_hatchet", itemId: "tool_hatchet", iron: 1, lumber: 1, outputName: "Work Hatchet", uniqueUntilOwned: true }),
  Object.freeze({ key: "iron_pickaxe", itemId: "iron_pickaxe", iron: 2, lumber: 1, outputName: "Iron Pickaxe", uniqueUntilOwned: false, desiredCount: 2 }),
  Object.freeze({ key: "iron_shield", itemId: "shield_iron", iron: 2, lumber: 1, outputName: "Iron Shield", uniqueUntilOwned: true }),
  Object.freeze({ key: "warhammer", itemId: "warhammer", iron: 3, lumber: 1, outputName: "Warhammer", uniqueUntilOwned: true }),
]);

export function chooseSmithRecipe(recipes, getCount) {
  const list = Array.isArray(recipes) ? recipes : SMITH_RECIPES;
  const countOf = typeof getCount === "function" ? getCount : () => 0;

  for (const recipe of list) {
    const owned = Math.max(0, Number(countOf(recipe.itemId) || 0) | 0);
    if (recipe.uniqueUntilOwned && owned > 0) continue;
    const desiredCount = Math.max(0, Number(recipe.desiredCount || 0) | 0);
    if (desiredCount > 0 && owned >= desiredCount) continue;
    return recipe;
  }

  return null;
}
