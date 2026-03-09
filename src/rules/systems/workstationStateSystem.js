import { Interactable } from "../components/Interactable.js";
import { ObjectState } from "../components/ObjectState.js";

/**
 * Return animated workstation entities to their idle visual state after
 * a short operation window.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function workstationStateSystem(world) {
  const step = Math.max(0, Number(world.step || 0) | 0);
  for (const [id, inter, objState] of world.query(Interactable, ObjectState)) {
    const params = (inter?.params && typeof inter.params === "object") ? inter.params : null;
    const idleState = String(params?.idleState || "");
    const activeUntilStep = Number(params?.activeUntilStep);
    if (!idleState || !Number.isFinite(activeUntilStep) || step < (activeUntilStep | 0)) continue;
    if (String(objState?.state || "") !== idleState) {
      world.set(id, ObjectState, { state: idleState });
    }
    world.set(id, Interactable, {
      action: inter.action,
      params: {
        ...params,
        activeUntilStep: -1,
      },
    });
  }
}
