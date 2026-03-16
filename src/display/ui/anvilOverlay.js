const MATERIAL_LABELS = Object.freeze({
  iron: "Iron Bars",
  lumber: "Lumber",
});

function formatNeeds(recipe) {
  return `Needs ${recipe.iron} iron + ${recipe.lumber} lumber -> ${String(recipe?.outputName || "item")}`;
}

export function renderAnvil(panel, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = "⚒ Anvil";
  Object.assign(title.style, {
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#ffd7a1",
    fontSize: "18px",
  });
  el.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = "Choose what to hammer out from your iron bars.";
  Object.assign(subtitle.style, {
    opacity: "0.86",
    marginBottom: "10px",
    fontSize: "12px",
  });
  el.appendChild(subtitle);

  const materials = (state?.materials && typeof state.materials === "object") ? state.materials : {};
  const stock = document.createElement("div");
  Object.assign(stock.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "10px",
    padding: "8px",
    border: "1px solid #4a3b2a",
    borderRadius: "6px",
    background: "#19120d",
  });
  for (const key of Object.keys(MATERIAL_LABELS)) {
    const item = document.createElement("div");
    item.textContent = `${MATERIAL_LABELS[key]}: ${Math.max(0, Number(materials[key] || 0) | 0)}`;
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
    empty.textContent = "The anvil sits cold.";
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
      border: "1px solid #4a3b2a",
      borderRadius: "6px",
      padding: "8px",
      background: "#16110d",
    });

    const textWrap = document.createElement("div");
    const label = document.createElement("div");
    label.textContent = String(recipe?.outputName || "Recipe");
    label.style.fontWeight = "bold";
    label.style.color = "#ffe2bf";

    const req = document.createElement("div");
    req.textContent = formatNeeds(recipe);
    req.style.opacity = "0.78";
    req.style.fontSize = "12px";

    const owned = document.createElement("div");
    const ownedCount = Math.max(0, Number(recipe?.owned || 0) | 0);
    owned.textContent = ownedCount > 0 ? `Owned: ${ownedCount}` : "Not owned";
    owned.style.opacity = "0.62";
    owned.style.fontSize = "11px";

    textWrap.appendChild(label);
    textWrap.appendChild(req);
    textWrap.appendChild(owned);

    const forgeBtn = document.createElement("button");
    const canCraft = !!recipe?.canCraft;
    forgeBtn.textContent = canCraft ? "Forge" : "Missing";
    forgeBtn.disabled = !canCraft || !(state?.anvilId > 0);
    Object.assign(forgeBtn.style, {
      minWidth: "92px",
      height: "34px",
      border: "1px solid #5a4632",
      borderRadius: "6px",
      background: canCraft ? "#4a260f" : "#1a1a1a",
      color: canCraft ? "#ffe1c5" : "#8892a0",
      fontWeight: "bold",
      cursor: canCraft ? "pointer" : "default",
    });
    forgeBtn.addEventListener("click", () => {
      const key = String(recipe?.key || "");
      if (!key || !(state?.anvilId > 0)) return;
      window.dispatchEvent(new CustomEvent("ui:requestForgeAtAnvil", {
        detail: { anvilId: state.anvilId, recipe: key },
      }));
    });

    row.appendChild(textWrap);
    row.appendChild(forgeBtn);
    list.appendChild(row);
  }

  const hint = document.createElement("div");
  hint.textContent = "Esc closes the anvil.";
  Object.assign(hint.style, {
    marginTop: "10px",
    opacity: "0.6",
    fontSize: "11px",
    textAlign: "center",
  });
  el.appendChild(hint);
}
