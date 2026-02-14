import { ActiveEffects } from "../components/ActiveEffects.js";
import { Status } from "../components/Status.js";

function isActiveInvulnEffect(e) {
  if (!e || typeof e !== "object") return false;
  const key = String(e.key || "").toLowerCase();
  if (key !== "invuln" && key !== "invulnerable") return false;
  if ((Number(e.onsetLeft || 0) | 0) > 0) return false;
  return (Number(e.turnsLeft || 0) | 0) > 0;
}

/**
 * Canonical invulnerability check.
 * Prefers source-of-truth ActiveEffects and falls back to derived Status.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 */
export function isEntityInvulnerable(world, id) {
  const ae = world.get(id, ActiveEffects);
  if (ae && Array.isArray(ae.effects) && ae.effects.some(isActiveInvulnEffect)) return true;

  const stat = world.get(id, Status);
  return !!(
    stat
    && Array.isArray(stat.statuses)
    && stat.statuses.some((s) => (
      String(s?.type || "").toLowerCase() === "invulnerable" && ((Number(s?.duration || 0) | 0) > 0)
    ))
  );
}
