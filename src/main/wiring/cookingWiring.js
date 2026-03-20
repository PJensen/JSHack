// main/wiring/cookingWiring.js
// Event bridge between cooking fire rules events and the display layer.

import { resolveItemDisplayName } from "./itemName.js";
import { isPlayerAdjacentTo } from "./wiringUtils.js";

const INSTALLED = Symbol.for("jshack:main:cookingWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({ id:number, pos:{x:number,y:number} }|null),
 *   dispatchRules: (action: { type:string, payload?:Record<string, unknown> }) => void,
 *   log?: (msg: string) => void,
 * }} opts
 */
export function installCookingWiring({ world, playerEntity, dispatchRules, log }) {
  if (!world || typeof playerEntity !== "function" || typeof dispatchRules !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  const writeLog = typeof log === "function" ? log : () => {};
  let activeFireId = 0;

  world.on("cooking:open", ({ actor, targetId, corpses, herbs }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const fireId = Number(targetId || 0) | 0;
    if (!(fireId > 0)) return;
    activeFireId = fireId;
    try { window.dispatchEvent(new CustomEvent("ui:openCookingFire", { detail: { fireId } })); } catch (e) { console.debug('[cookingWiring] dispatch ui:openCookingFire:', e); }
    // Resolve corpse entity IDs into display-friendly objects.
    const resolved = [];
    if (Array.isArray(corpses)) {
      for (const cid of corpses) {
        if (!(cid > 0) || !world.isAlive(cid)) continue;
        resolved.push({ id: cid, name: resolveItemDisplayName(world, cid) });
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("ui:cookingFireData", {
        detail: {
          fireId,
          corpses: resolved,
          herbs: herbs && typeof herbs === "object" ? herbs : { count: 0, items: [] },
        },
      }));
    } catch (e) { console.debug('[cookingWiring] dispatch ui:cookingFireData:', e); }
  });

  world.on("moved", ({ id }) => {
    const pe = playerEntity(world);
    if (!pe || Number(id || 0) !== pe.id) return;
    if (!(activeFireId > 0)) return;
    if (isPlayerAdjacentTo(world, activeFireId)) return;
    activeFireId = 0;
    try { window.dispatchEvent(new CustomEvent("ui:closeCookingFire")); } catch (e) { console.debug('[cookingWiring] dispatch ui:closeCookingFire:', e); }
  });

  addEventListener("ui:requestCook", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const fireId = Number(e?.detail?.fireId || activeFireId || 0) | 0;
    const itemId = Number(e?.detail?.itemId || 0) | 0;
    if (!(fireId > 0) || !(itemId > 0)) return;
    if (!isPlayerAdjacentTo(world, fireId)) {
      writeLog("You need to stand next to the cooking fire.");
      activeFireId = 0;
      try { window.dispatchEvent(new CustomEvent("ui:closeCookingFire")); } catch (e) { console.debug('[cookingWiring] dispatch ui:closeCookingFire:', e); }
      return;
    }
    dispatchRules({ type: "rules.cookFood", payload: { fireId, itemId } });
  });
}
