const INGREDIENT_LABELS = Object.freeze({
  emberRoot: "Ember Root",
  moonleaf: "Moonleaf",
  thornPods: "Thorn Pods",
  venomFronds: "Venom Fronds",
  spiderLeg: "Spider Leg",
  venomGland: "Venom Gland",
  resin: "Binding Resin",
  boneDust: "Bone Dust",
  ectoplasm: "Ectoplasm",
  runeFragment: "Rune Fragment",
  frostCore: "Frost Core",
  beastClaw: "Beast Claw",
  cursedThread: "Cursed Thread",
  oil: "Flask of Oil",
  water: "Water Flask",
  ashes: "Ashes",
  gold: "Gold",
});

function ingredientLabel(key) {
  return INGREDIENT_LABELS[key] || key;
}

function normalizeRequirements(recipe) {
  const req = {};
  const src = (recipe?.requirements && typeof recipe.requirements === "object") ? recipe.requirements : {};
  for (const [key, raw] of Object.entries(src)) {
    const need = Math.max(0, Number(raw || 0) | 0);
    if (need > 0) req[key] = need;
  }
  return req;
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

function formatRequirementLine(requirements, outputLabel) {
  const parts = [];
  for (const [key, need] of Object.entries(requirements)) {
    parts.push(`${need} ${ingredientLabel(key).toLowerCase()}`);
  }
  return `Needs ${parts.join(" + ")} → ${outputLabel}`;
}

export function renderEnchantingBench(panel, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = String(state?.title || "✧ Enchanting Bench");
  Object.assign(title.style, {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#d9c3ff",
    fontSize: "18px",
  });
  el.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = String(state?.subtitle || "Bind reagents and gold into a scroll, then apply it to your gear.");
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
    border: "1px solid #4f3b67",
    borderRadius: "6px",
    background: "#16111e",
  });
  for (const key of Object.keys(INGREDIENT_LABELS)) {
    const item = document.createElement("div");
    const count = Math.max(0, Number(ingredients[key] || 0) | 0);
    item.textContent = `${ingredientLabel(key)}: ${count}`;
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
    empty.textContent = "The vellum waits for a worthy binding.";
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
      border: "1px solid #4f3b67",
      borderRadius: "6px",
      padding: "8px",
      background: "#130f1c",
    });

    const textWrap = document.createElement("div");
    const label = document.createElement("div");
    label.textContent = String(recipe?.label || "Recipe");
    label.style.fontWeight = "bold";
    label.style.color = "#f1e1ff";

    const req = document.createElement("div");
    req.textContent = formatRequirementLine(normalizeRequirements(recipe), String(recipe?.outputName || "scroll"));
    req.style.opacity = "0.78";
    req.style.fontSize = "12px";

    const effect = document.createElement("div");
    effect.textContent = String(recipe?.effectSummary || "");
    effect.style.opacity = "0.72";
    effect.style.fontSize = "11px";

    const flavor = document.createElement("div");
    flavor.textContent = String(recipe?.flavor || "");
    flavor.style.opacity = "0.58";
    flavor.style.fontSize = "11px";

    textWrap.appendChild(label);
    textWrap.appendChild(req);
    if (String(recipe?.effectSummary || "").trim()) textWrap.appendChild(effect);
    if (String(recipe?.flavor || "").trim()) textWrap.appendChild(flavor);

    const craftBtn = document.createElement("button");
    const canCraft = canCraftRecipe(recipe, ingredients);
    craftBtn.textContent = canCraft ? "Scribe" : "Missing";
    craftBtn.disabled = !canCraft || !(state?.benchId > 0);
    Object.assign(craftBtn.style, {
      minWidth: "92px",
      height: "34px",
      border: "1px solid #5b4480",
      borderRadius: "6px",
      background: canCraft ? "#2d1b4f" : "#1a1a1a",
      color: canCraft ? "#f1d7ff" : "#8892a0",
      fontWeight: "bold",
      cursor: canCraft ? "pointer" : "default",
    });
    craftBtn.addEventListener("click", () => {
      const key = String(recipe?.key || "");
      if (!key || !(state?.benchId > 0)) return;
      window.dispatchEvent(new CustomEvent("ui:requestCraftEnchant", {
        detail: { benchId: state.benchId, recipe: key },
      }));
    });

    row.appendChild(textWrap);
    row.appendChild(craftBtn);
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
