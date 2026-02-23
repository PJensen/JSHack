// display/ui/cookingFireOverlay.js
// Cooking fire overlay: shows cookable corpses with "Cook" buttons.

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ fireId:number, corpses?:Array<{id:number,name:string}>, herbs?:{count:number} }} state
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
  subtitle.textContent = "Select a corpse to cook over the fire.";
  Object.assign(subtitle.style, {
    opacity: "0.86",
    marginBottom: "10px",
    fontSize: "12px",
  });
  el.appendChild(subtitle);

  // Herb stock (future seasoning)
  const herbCount = Math.max(0, Number(state?.herbs?.count || 0) | 0);
  if (herbCount > 0) {
    const stock = document.createElement("div");
    Object.assign(stock.style, {
      display: "flex",
      gap: "12px",
      marginBottom: "10px",
      padding: "8px",
      border: "1px solid #2d3b52",
      borderRadius: "6px",
      background: "#0f1421",
    });
    stock.textContent = `Herbs: ${herbCount}`;
    el.appendChild(stock);
  }

  const list = document.createElement("div");
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  });
  el.appendChild(list);

  const corpses = Array.isArray(state?.corpses) ? state.corpses : [];
  if (!corpses.length) {
    const empty = document.createElement("div");
    empty.textContent = "You have nothing to cook.";
    empty.style.opacity = "0.7";
    list.appendChild(empty);
  } else {
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
