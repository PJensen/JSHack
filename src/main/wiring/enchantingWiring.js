import { isPlayerAdjacentTo } from "./wiringUtils.js";

const INSTALLED = Symbol.for("jshack:main:enchantingWiring:installed");
const EMPTY_INGREDIENTS = Object.freeze({
  emberRoot: 0,
  moonleaf: 0,
  thornPods: 0,
  venomFronds: 0,
  oil: 0,
  water: 0,
  gold: 0,
});

export function installEnchantingWiring({ world, playerEntity, dispatchRules, log }) {
  if (!world || typeof playerEntity !== "function" || typeof dispatchRules !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  const writeLog = typeof log === "function" ? log : () => {};
  let activeBenchId = 0;

  world.on("enchanting:open", ({ actor, targetId, ingredients, recipes }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const benchId = Number(targetId || 0) | 0;
    if (!(benchId > 0)) return;
    activeBenchId = benchId;
    try { window.dispatchEvent(new CustomEvent("ui:openEnchantingBench", { detail: { benchId } })); } catch (e) { console.debug("[enchantingWiring] dispatch ui:openEnchantingBench:", e); }
    try {
      window.dispatchEvent(new CustomEvent("ui:enchantingBenchData", {
        detail: {
          benchId,
          ingredients: ingredients && typeof ingredients === "object" ? ingredients : { ...EMPTY_INGREDIENTS },
          recipes: Array.isArray(recipes) ? recipes : [],
        },
      }));
    } catch (e) { console.debug("[enchantingWiring] dispatch ui:enchantingBenchData:", e); }
  });

  world.on("moved", ({ id }) => {
    const pe = playerEntity(world);
    if (!pe || Number(id || 0) !== pe.id) return;
    if (!(activeBenchId > 0)) return;
    if (isPlayerAdjacentTo(world, activeBenchId)) return;
    activeBenchId = 0;
    try { window.dispatchEvent(new CustomEvent("ui:closeEnchantingBench")); } catch (e) { console.debug("[enchantingWiring] dispatch ui:closeEnchantingBench:", e); }
  });

  addEventListener("ui:requestCraftEnchant", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const benchId = Number(e?.detail?.benchId || activeBenchId || 0) | 0;
    const recipe = String(e?.detail?.recipe || "").trim().toLowerCase();
    if (!(benchId > 0) || !recipe) return;
    if (!isPlayerAdjacentTo(world, benchId)) {
      writeLog("You need to stand next to the enchanting bench.");
      activeBenchId = 0;
      try { window.dispatchEvent(new CustomEvent("ui:closeEnchantingBench")); } catch (err) { console.debug("[enchantingWiring] dispatch ui:closeEnchantingBench:", err); }
      return;
    }
    dispatchRules({ type: "rules.craftEnchant", payload: { benchId, recipe } });
  });
}
