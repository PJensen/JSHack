const INGREDIENT_LABELS = Object.freeze({
  berries: "Berries",
  herbs: "Herbs",
  thornPods: "Thorn Pods",
  venomFronds: "Venom Fronds",
});

function ingredientLabel(key) {
  return INGREDIENT_LABELS[key] || key;
}

function normalizeRequirements(recipe) {
  const req = {};
  const src = (recipe?.requirements && typeof recipe.requirements === "object")
    ? recipe.requirements
    : {
        berries: Number(recipe?.berries || 0) | 0,
        herbs: Number(recipe?.herbs || 0) | 0,
      };
  for (const [key, raw] of Object.entries(src)) {
    const need = Math.max(0, Number(raw || 0) | 0);
    if (need > 0) req[key] = need;
  }
  return req;
}

function formatRequirementLine(requirements, outputLabel) {
  const parts = [];
  for (const [key, need] of Object.entries(requirements)) {
    parts.push(`${need} ${ingredientLabel(key).toLowerCase()}`);
  }
  return `Needs ${parts.join(" + ")} → ${outputLabel}`;
}

function canCraftRecipe(recipe, ingredients) {
  if (typeof recipe?.canCraft === "boolean") return recipe.canCraft;
  const req = normalizeRequirements(recipe);
  for (const [key, need] of Object.entries(req)) {
    const have = Math.max(0, Number(ingredients?.[key] || 0) | 0);
    if (have < need) return false;
  }
  return true;
}

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ benchId:number, ingredients?:Record<string,number>, recipes?:any[] }} state
 */
export function renderAlchemyBench(panel, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = "⚗ Alchemy Bench";
  Object.assign(title.style, {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#9fe8ff",
    fontSize: "18px",
  });
  el.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = "Pick a recipe and distill it into vials.";
  Object.assign(subtitle.style, {
    opacity: "0.86",
    marginBottom: "10px",
    fontSize: "12px",
  });
  el.appendChild(subtitle);

  const ingredients = (state?.ingredients && typeof state.ingredients === "object")
    ? state.ingredients
    : {};
  const stock = document.createElement("div");
  Object.assign(stock.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "10px",
    padding: "8px",
    border: "1px solid #2d3b52",
    borderRadius: "6px",
    background: "#0f1421",
  });
  for (const key of Object.keys(INGREDIENT_LABELS)) {
    const item = document.createElement("div");
    const n = Math.max(0, Number(ingredients[key] || 0) | 0);
    item.textContent = `${ingredientLabel(key)}: ${n}`;
    stock.appendChild(item);
  }
  el.appendChild(stock);

  const list = document.createElement("div");
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  });
  el.appendChild(list);

  const recipes = Array.isArray(state?.recipes) ? state.recipes : [];
  if (!recipes.length) {
    const empty = document.createElement("div");
    empty.textContent = "The bench is quiet.";
    empty.style.opacity = "0.7";
    list.appendChild(empty);
    return;
  }

  for (const recipe of recipes) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "8px",
      alignItems: "center",
      border: "1px solid #2d3b52",
      borderRadius: "6px",
      padding: "8px",
      background: "#101726",
    });

    const textWrap = document.createElement("div");
    const label = document.createElement("div");
    label.textContent = String(recipe?.label || "Recipe");
    label.style.fontWeight = "bold";
    label.style.color = "#cfe8ff";

    const req = document.createElement("div");
    const outCount = Math.max(1, Number(recipe?.outputCount || 1) | 0);
    const outputLabel = `${outCount} ${String(recipe?.outputName || "item")}`;
    req.textContent = formatRequirementLine(normalizeRequirements(recipe), outputLabel);
    req.style.opacity = "0.78";
    req.style.fontSize = "12px";

    const flavor = document.createElement("div");
    flavor.textContent = String(recipe?.flavor || "");
    flavor.style.opacity = "0.62";
    flavor.style.fontSize = "11px";

    textWrap.appendChild(label);
    textWrap.appendChild(req);
    if (String(recipe?.flavor || "").trim()) textWrap.appendChild(flavor);

    const brewBtn = document.createElement("button");
    const canCraft = canCraftRecipe(recipe, ingredients);
    brewBtn.textContent = canCraft ? "Distill" : "Missing";
    brewBtn.disabled = !canCraft || !(state?.benchId > 0);
    Object.assign(brewBtn.style, {
      minWidth: "92px",
      height: "34px",
      border: "1px solid #2d3b52",
      borderRadius: "6px",
      background: canCraft ? "#12314f" : "#1a1a1a",
      color: canCraft ? "#b7e6ff" : "#8892a0",
      fontWeight: "bold",
      cursor: canCraft ? "pointer" : "default",
    });
    brewBtn.addEventListener("click", () => {
      const key = String(recipe?.key || "");
      if (!key || !(state?.benchId > 0)) return;
      window.dispatchEvent(new CustomEvent("ui:requestAlchemyBrew", {
        detail: { benchId: state.benchId, recipe: key },
      }));
    });

    row.appendChild(textWrap);
    row.appendChild(brewBtn);
    list.appendChild(row);
  }

  const hint = document.createElement("div");
  hint.textContent = "Esc closes the bench.";
  Object.assign(hint.style, {
    marginTop: "10px",
    opacity: "0.6",
    fontSize: "11px",
    textAlign: "center",
  });
  el.appendChild(hint);
}
