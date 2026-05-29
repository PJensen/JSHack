const DANGER_COLORS = Object.freeze({
  low: "#7fd88a",
  medium: "#ffd36a",
  high: "#ff8d8d",
});

function normalizeQuery(text) {
  return String(text || "").trim().toLowerCase();
}

function matchesChoice(choice, query) {
  if (!query) return true;
  const haystack = [
    choice?.id,
    choice?.name,
    choice?.role,
    choice?.note,
    ...(Array.isArray(choice?.tags) ? choice.tags : []),
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function makeBadge(text, color) {
  const badge = document.createElement("span");
  badge.textContent = String(text || "");
  Object.assign(badge.style, {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "20px",
    padding: "1px 6px",
    border: `1px solid ${color || "rgba(255,255,255,0.18)"}`,
    borderRadius: "999px",
    color: color || "#cfe8ff",
    fontSize: "11px",
    lineHeight: "1.2",
    whiteSpace: "nowrap",
  });
  return badge;
}

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement,_monsterChooserDetach?:()=>void}} panel
 * @param {{ requestId?:number, title?:string, subtitle?:string, searchPlaceholder?:string, choices?:any[] }} state
 */
export function renderMonsterChooser(panel, state = {}) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  if (typeof panel._monsterChooserDetach === "function") panel._monsterChooserDetach();
  el.innerHTML = "";

  Object.assign(el.style, {
    width: "min(720px, 94vw)",
    maxHeight: "86vh",
  });

  const requestId = Number(state?.requestId || 0) | 0;
  const allChoices = Array.isArray(state?.choices) ? state.choices : [];
  let visibleChoices = allChoices;
  let selected = 0;
  const rows = [];

  const title = document.createElement("div");
  title.textContent = String(state?.title || "Choose Creature");
  Object.assign(title.style, {
    color: "#e4d7ff",
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "4px",
  });
  el.appendChild(title);

  const subtitleText = String(state?.subtitle || "");
  if (subtitleText) {
    const subtitle = document.createElement("div");
    subtitle.textContent = subtitleText;
    Object.assign(subtitle.style, {
      color: "#aebbd0",
      fontSize: "12px",
      marginBottom: "10px",
    });
    el.appendChild(subtitle);
  }

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = String(state?.searchPlaceholder || "Search creatures");
  search.autocomplete = "off";
  Object.assign(search.style, {
    width: "100%",
    minHeight: "42px",
    boxSizing: "border-box",
    marginBottom: "10px",
    padding: "8px 10px",
    border: "1px solid #3a4b68",
    borderRadius: "6px",
    background: "#090d15",
    color: "#eef5ff",
    font: "inherit",
    outline: "none",
  });
  el.appendChild(search);

  const list = document.createElement("div");
  Object.assign(list.style, {
    display: "grid",
    gap: "8px",
  });
  el.appendChild(list);

  const footer = document.createElement("div");
  Object.assign(footer.style, {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "10px",
  });
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  Object.assign(cancel.style, {
    minHeight: "40px",
    padding: "8px 14px",
    border: "1px solid #34435c",
    borderRadius: "6px",
    background: "#101726",
    color: "#cfe8ff",
    font: "inherit",
    cursor: "pointer",
  });
  cancel.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("ui:monsterChooserCanceled", { detail: { requestId } }));
  });
  footer.appendChild(cancel);
  el.appendChild(footer);

  function choose(choice) {
    if (!choice?.enabled) return;
    window.dispatchEvent(new CustomEvent("ui:monsterChosen", {
      detail: { requestId, monsterId: String(choice.id || "") },
    }));
  }

  function highlight(index) {
    selected = Math.max(0, Math.min(rows.length - 1, index | 0));
    for (let i = 0; i < rows.length; i++) {
      rows[i].style.outline = i === selected ? "2px solid #b995ff" : "none";
      rows[i].style.background = i === selected ? "#15112a" : "#101726";
    }
    rows[selected]?.scrollIntoView?.({ block: "nearest" });
  }

  function renderRows() {
    rows.length = 0;
    list.innerHTML = "";
    const query = normalizeQuery(search.value);
    visibleChoices = allChoices.filter((choice) => matchesChoice(choice, query));

    if (!visibleChoices.length) {
      const empty = document.createElement("div");
      empty.textContent = "No matching creatures.";
      Object.assign(empty.style, {
        padding: "12px",
        color: "#91a0b8",
        border: "1px solid #2d3b52",
        borderRadius: "6px",
        background: "#101726",
      });
      list.appendChild(empty);
      return;
    }

    for (const choice of visibleChoices) {
      const row = document.createElement("button");
      row.type = "button";
      Object.assign(row.style, {
        width: "100%",
        minHeight: "58px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "10px",
        alignItems: "center",
        padding: "8px 10px",
        border: "1px solid #2d3b52",
        borderRadius: "6px",
        background: "#101726",
        color: "#e8edf5",
        font: "inherit",
        textAlign: "left",
        cursor: choice?.enabled === false ? "not-allowed" : "pointer",
        opacity: choice?.enabled === false ? "0.55" : "1",
        touchAction: "manipulation",
      });

      const main = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = String(choice?.name || choice?.id || "Creature");
      Object.assign(name.style, {
        color: "#f6f0ff",
        fontWeight: "700",
        fontSize: "14px",
      });
      main.appendChild(name);

      const note = document.createElement("div");
      note.textContent = String(choice?.note || choice?.role || "");
      Object.assign(note.style, {
        color: "#aebbd0",
        fontSize: "12px",
        lineHeight: "1.3",
        marginTop: "2px",
      });
      main.appendChild(note);

      const badges = document.createElement("div");
      Object.assign(badges.style, {
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        gap: "5px",
      });
      if (choice?.featured) badges.appendChild(makeBadge("common", "#b995ff"));
      badges.appendChild(makeBadge(String(choice?.role || "Creature"), "#8ec7ff"));
      badges.appendChild(makeBadge(`T${Math.max(0, Number(choice?.tier || 0) | 0)}`, "#cbd6e4"));
      badges.appendChild(makeBadge(String(choice?.danger || "low"), DANGER_COLORS[String(choice?.danger || "low")] || "#cbd6e4"));

      row.appendChild(main);
      row.appendChild(badges);
      row.addEventListener("click", () => choose(choice));
      list.appendChild(row);
      rows.push(row);
    }
    highlight(Math.min(selected, rows.length - 1));
  }

  const keyHandler = (/** @type {KeyboardEvent} */ ev) => {
    if (panel.style.display !== "block") return;
    if (ev.key === "ArrowDown") {
      highlight(selected + 1);
      ev.preventDefault();
    } else if (ev.key === "ArrowUp") {
      highlight(selected - 1);
      ev.preventDefault();
    } else if (ev.key === "Enter") {
      const choice = visibleChoices[selected];
      if (choice) choose(choice);
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      window.dispatchEvent(new CustomEvent("ui:monsterChooserCanceled", { detail: { requestId } }));
      ev.preventDefault();
    }
  };

  const observer = new MutationObserver(() => {
    if (panel.style.display === "none") {
      if (typeof panel._monsterChooserDetach === "function") panel._monsterChooserDetach();
    }
  });

  panel._monsterChooserDetach = () => {
    window.removeEventListener("keydown", keyHandler);
    observer.disconnect();
    panel._monsterChooserDetach = null;
  };
  window.addEventListener("keydown", keyHandler);
  observer.observe(panel, { attributes: true, attributeFilter: ["style"] });

  search.addEventListener("input", () => {
    selected = 0;
    renderRows();
  });

  renderRows();
  setTimeout(() => search.focus(), 0);
}

