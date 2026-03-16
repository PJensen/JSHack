import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Channeling — tracks an in-progress cast-time spell.
 *
 * mode:           "cast" for countdown casts, "sustain" for realtime drains.
 * turnsRemaining: how many more world ticks until the cast completes.
 * turnsTotal:     the original total cast time (for UI progress display).
 * manaPerTick:    mana spent on each sustain tick.
 * spellId:        the spell being channeled.
 * targetId:       entity target (0 = self).
 * x, y:           optional tile target coordinates.
 */
export const Channeling = defineComponent("Channeling", {
  mode: "cast",
  turnsRemaining: 0,
  turnsTotal: 0,
  manaPerTick: 0,
  spellId: "",
  targetId: 0,
  x: null,
  y: null,
});
