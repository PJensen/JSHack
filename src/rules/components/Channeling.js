import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Channeling — tracks an in-progress cast-time spell.
 *
 * turnsRemaining: how many more world ticks until the cast completes.
 * turnsTotal:     the original total cast time (for UI progress display).
 * spellId:        the spell being channeled.
 * targetId:       entity target (0 = self).
 * x, y:           optional tile target coordinates.
 */
export const Channeling = defineComponent("Channeling", {
  turnsRemaining: 0,
  turnsTotal: 0,
  spellId: "",
  targetId: 0,
  x: null,
  y: null,
});
