export const MILLING_RECIPES = Object.freeze([
  Object.freeze({
    inputIdentity: "food_wheat",
    outputIdentity: "food_flour",
    label: "wheat",
    outputLabel: "flour",
  }),
  Object.freeze({
    inputIdentity: "food_corn",
    outputIdentity: "food_cornmeal",
    label: "corn",
    outputLabel: "cornmeal",
  }),
]);

export function chooseMillingRecipe(counts = {}) {
  for (const recipe of MILLING_RECIPES) {
    if (Number(counts[recipe.inputIdentity] || 0) > 0) return recipe;
  }
  return null;
}

export function getMillableInputIdentities() {
  return MILLING_RECIPES.map((recipe) => recipe.inputIdentity);
}
