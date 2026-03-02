import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * KnockbackPending — a pending push vector waiting to be resolved into movement.
 *
 * Consumed by knockbackSystem (intents phase, before movementSystem).
 * Each step of force attempts one grid tile of movement in (dx, dy).
 * Stops early if blocked by solid terrain or a solid entity.
 *
 * Populate when dealing knockback damage instead of using Damage.knockback
 * (which is not consumed by any system). This component IS consumed.
 *
 * dx/dy: direction (-1, 0, or 1); normalised by knockbackSystem.
 * force: number of tiles to attempt to push (clamped 1–5).
 */
export const KnockbackPending = defineComponent("KnockbackPending", {
  dx:    0,
  dy:    0,
  force: 1,
});
