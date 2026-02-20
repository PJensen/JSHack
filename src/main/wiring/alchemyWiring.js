import { Position } from "../../rules/components/Position.js";

const INSTALLED = Symbol.for("jshack:main:alchemyWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({ id:number, pos:{x:number,y:number} }|null),
 *   dispatchRules: (action: { type:string, payload?:Record<string, unknown> }) => void,
 *   log?: (msg: string) => void,
 }} opts
 */
export function installAlchemyWiring({ world, playerEntity, dispatchRules, log }) {
  if (!world || typeof playerEntity !== "function" || typeof dispatchRules !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  const writeLog = typeof log === "function" ? log : () => {};
  let activeBenchId = 0;

  function isPlayerAdjacentTo(benchId) {
    const pe = playerEntity(world);
    if (!pe || !(benchId > 0)) return false;
    const ppos = world.get(pe.id, Position);
    const bpos = world.get(benchId, Position);
    if (!ppos || !bpos) return false;
    const dist = Math.max(Math.abs(ppos.x - bpos.x), Math.abs(ppos.y - bpos.y));
    return dist <= 1;
  }

  world.on("alchemy:open", ({ actor, targetId, ingredients, recipes }) => {
    const pe = playerEntity(world);
    if (!pe || Number(actor || 0) !== pe.id) return;
    const benchId = Number(targetId || 0) | 0;
    if (!(benchId > 0)) return;
    activeBenchId = benchId;
    try { window.dispatchEvent(new CustomEvent("ui:openAlchemyBench", { detail: { benchId } })); } catch {}
    try {
      window.dispatchEvent(new CustomEvent("ui:alchemyBenchData", {
        detail: {
          benchId,
          ingredients: ingredients && typeof ingredients === "object" ? ingredients : { berries: 0, herbs: 0 },
          recipes: Array.isArray(recipes) ? recipes : [],
        },
      }));
    } catch {}
  });

  world.on("moved", ({ id }) => {
    const pe = playerEntity(world);
    if (!pe || Number(id || 0) !== pe.id) return;
    if (!(activeBenchId > 0)) return;
    if (isPlayerAdjacentTo(activeBenchId)) return;
    activeBenchId = 0;
    try { window.dispatchEvent(new CustomEvent("ui:closeAlchemyBench")); } catch {}
  });

  addEventListener("ui:requestAlchemyBrew", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const benchId = Number(e?.detail?.benchId || activeBenchId || 0) | 0;
    const recipe = String(e?.detail?.recipe || "").trim().toLowerCase();
    if (!(benchId > 0) || !recipe) return;
    if (!isPlayerAdjacentTo(benchId)) {
      writeLog("You need to stand next to the alchemy bench.");
      activeBenchId = 0;
      try { window.dispatchEvent(new CustomEvent("ui:closeAlchemyBench")); } catch {}
      return;
    }
    dispatchRules({ type: "rules.brewAlchemy", payload: { benchId, recipe } });
  });
}
