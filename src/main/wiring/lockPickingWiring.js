import { defineExtension } from "../../lib/ecs-js/index.js";
import { LockpickPrompted } from "../../events/LockpickPrompted.js";
import { makeRulesDispatcher } from "../input/rulesDispatch.js";

const LOCK_PICKING_WIRING_KEY = Symbol.for("jshack:main:lockPickingWiring");

export function createLockPickingWiringExtension({ playerEntity, log }) {
  return defineExtension("jshack:main:lockPickingWiring", (world) => {
    if (!world || typeof playerEntity !== "function") return;

    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));

    world.on(LockpickPrompted, (event) => {
      const pe = playerEntity(world);
      if (!pe || event.actor !== pe.id) return;
      if (typeof log === "function") log("You work the lock.");
      const payloadBase = { targetId: event.targetId };
      try {
        window.dispatchEvent(new CustomEvent("ui:openLockPicking", {
          detail: {
            pinCount: event.pins,
            difficulty: event.difficulty,
            successPickedListener(result) {
              rulesHandler({
                type: "rules.lockpickDoorResult",
                payload: { ...payloadBase, success: true, reason: result?.reason || "unlocked" },
              });
            },
            failedPickedListener(result) {
              rulesHandler({
                type: "rules.lockpickDoorResult",
                payload: { ...payloadBase, success: false, reason: result?.reason || "failed" },
              });
            },
          },
        }));
      } catch (e) { console.debug("[lockPickingWiring] dispatch ui:openLockPicking:", e); }
    });
  }, { key: LOCK_PICKING_WIRING_KEY });
}

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   log?: (msg: string) => void,
 * }} opts
 */
export function installLockPickingWiring({ world, playerEntity, log }) {
  if (!world || typeof world.install !== "function") return;
  world.install(createLockPickingWiringExtension({ playerEntity, log }));
}
