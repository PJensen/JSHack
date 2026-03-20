// rules/utils/effects.js
// Shared helper to ensure an entity has the ActiveEffects component.

import { ActiveEffects } from "../components/ActiveEffects.js";

/**
 * Ensure `entityId` has an ActiveEffects component with an `effects` array.
 * If the component already exists it is returned as-is; otherwise it is added.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id  entity id
 * @returns {{ effects: Array<any> } | null}  the ActiveEffects component, or null on failure
 */
export function ensureActiveEffects(world, id) {
  let ae = world.get(id, ActiveEffects);
  if (ae && Array.isArray(ae.effects)) return ae;
  try { world.add(id, ActiveEffects, { effects: [] }); } catch { /* already exists */ }
  ae = world.get(id, ActiveEffects);
  return (ae && Array.isArray(ae.effects)) ? ae : null;
}
