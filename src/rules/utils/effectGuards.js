import { hasStatus } from "./statusFacade.js";

/**
 * Canonical invulnerability check.
 * Prefers source-of-truth ActiveEffects and falls back to derived Status.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 */
export function isEntityInvulnerable(world, id) {
  return hasStatus(world, id, "invulnerable");
}
