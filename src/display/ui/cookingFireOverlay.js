// display/ui/cookingFireOverlay.js
// Cooking fire overlay: shows recipe cooking and legacy corpse cooking.

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ fireId:number, corpses?:Array<{id:number,name:string}>, herbs?:{count:number}, ingredients?:Record<string, number>, recipes?:Array<any> }} state
 */
export function renderCookingFire(panel, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = "\uD83D\uDD25 Cooking Fire";
  Object.assign(title.style, {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#ffcc66",
    fontSize: "18px",
  });
  el.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = "Cook dungeon ingredients into meals with long-lasting effects.";
  Object.assign(subtitle.style, {
    opacity: "0.86",
    marginBottom: "10px",
    fontSize: "12px",
  });
  el.appendChild(subtitle);

  const ingredientEntries = Object.entries(state?.ingredients || {})
    .filter(([, value]) => Math.max(0, Number(value || 0) | 0) > 0)
    .slice(0, 8);
  if (ingredientEntries.length > 0) {
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
    stock.textContent = ingredientEntries
      .map(([key, value]) => `${key}: ${Math.max(0, Number(value || 0) | 0)}`)
      .join("  ");
    el.appendChild(stock);
  }

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
    empty.textContent = "You have no known meals to cook.";
    empty.style.opacity = "0.7";
    list.appendChild(empty);
  } else {
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

      const label = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = String(recipe?.label || recipe?.outputName || "Meal");
      name.style.color = "#cfe8ff";
      name.style.fontWeight = "bold";
      const req = recipe?.requirements && typeof recipe.requirements === "object"
        ? Object.entries(recipe.requirements)
          .filter(([, value]) => Math.max(0, Number(value || 0) | 0) > 0)
          .map(([key, value]) => `${value} ${key}`)
          .join(", ")
        : "";
      const detail = document.createElement("div");
      detail.textContent = req ? `${req}` : String(recipe?.flavor || "");
      detail.style.opacity = "0.72";
      detail.style.fontSize = "11px";
      label.appendChild(name);
      label.appendChild(detail);

      const cookBtn = document.createElement("button");
      cookBtn.textContent = "Cook";
      cookBtn.disabled = !(state?.fireId > 0) || recipe?.canCraft !== true;
      Object.assign(cookBtn.style, {
        minWidth: "72px",
        height: "34px",
        border: "1px solid #2d3b52",
        borderRadius: "6px",
        background: recipe?.canCraft === true ? "#3f2212" : "#1a1f2b",
        color: recipe?.canCraft === true ? "#ffcc88" : "#8c94a3",
        fontWeight: "bold",
        cursor: recipe?.canCraft === true ? "pointer" : "default",
      });
      cookBtn.addEventListener("click", () => {
        const recipeKey = String(recipe?.key || "");
        if (!recipeKey || !(state?.fireId > 0) || recipe?.canCraft !== true) return;
        window.dispatchEvent(new CustomEvent("ui:requestCookRecipe", {
          detail: { fireId: state.fireId, recipe: recipeKey },
        }));
      });

      row.appendChild(label);
      row.appendChild(cookBtn);
      list.appendChild(row);
    }
  }

  const corpses = Array.isArray(state?.corpses) ? state.corpses : [];
  if (corpses.length > 0) {
    const legacyTitle = document.createElement("div");
    legacyTitle.textContent = "Simple corpse cooking";
    Object.assign(legacyTitle.style, {
      marginTop: "10px",
      marginBottom: "2px",
      opacity: "0.72",
      fontSize: "12px",
      fontWeight: "bold",
    });
    list.appendChild(legacyTitle);

    for (const corpse of corpses) {
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

      const label = document.createElement("div");
      label.textContent = String(corpse?.name || "Corpse");
      label.style.color = "#cfe8ff";

      const cookBtn = document.createElement("button");
      cookBtn.textContent = "Cook";
      cookBtn.disabled = !(state?.fireId > 0);
      Object.assign(cookBtn.style, {
        minWidth: "72px",
        height: "34px",
        border: "1px solid #2d3b52",
        borderRadius: "6px",
        background: "#3f2212",
        color: "#ffcc88",
        fontWeight: "bold",
        cursor: "pointer",
      });
      cookBtn.addEventListener("click", () => {
        const id = Number(corpse?.id || 0) | 0;
        if (!(id > 0) || !(state?.fireId > 0)) return;
        window.dispatchEvent(new CustomEvent("ui:requestCook", {
          detail: { fireId: state.fireId, itemId: id },
        }));
      });

      row.appendChild(label);
      row.appendChild(cookBtn);
      list.appendChild(row);
    }
  }

  const hint = document.createElement("div");
  hint.textContent = "Esc closes the fire.";
  Object.assign(hint.style, {
    marginTop: "10px",
    opacity: "0.6",
    fontSize: "11px",
    textAlign: "center",
  });
  el.appendChild(hint);
}
