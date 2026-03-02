import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Lifespan — marks an entity as temporary with a turn countdown.
 *
 * Managed by lifespanSystem (cleanup phase).
 *
 * onExpiry behaviour:
 *   "remove" — entity is destroyed when turnsLeft hits 0 (default).
 *   "emit"   — expiryEvent is emitted with { id, at } before destruction.
 *
 * Use this for: summoned creatures, temporary terrain, timed tokens, etc.
 * HazardArea and PlasmaCloud manage their own turnsLeft inline; this
 * component is for entities that need no special logic beyond removal.
 */
export const Lifespan = defineComponent("Lifespan", {
  turnsLeft:   1,
  onExpiry:    "remove",  // "remove" | "emit"
  expiryEvent: "",        // event name; only used when onExpiry === "emit"
});
