import { defineComponent } from "../../lib/ecs-js/index.js";

export const AGGRO_LEVELS = Object.freeze({
  unaware:  "unaware",   // no knowledge of any threat; idle
  curious:  "curious",   // heard something faint; investigating last-known position
  alerted:  "alerted",   // lost LOS or heard loud noise; actively searching
  hunting:  "hunting",   // has direct LOS; pursuing and attacking
});

// Default search budgets (turns to spend searching before downgrading alert level)
export const SEARCH_TURNS_HUNTING_GRACE = 10;   // turns of alerted state after losing LOS
export const SEARCH_TURNS_ALERTED       = 10;   // turns alerted → curious downgrade
export const SEARCH_TURNS_CURIOUS       = 6;    // turns curious → unaware downgrade

/**
 * AggroState — per-entity awareness of a threat (typically the player).
 *
 * alertLevel: current awareness tier (see AGGRO_LEVELS).
 * lastKnownX/Y: last recorded position of the target (updated each hunting tick).
 * searchTurnsLeft: countdown before downgrading to the next lower tier.
 * retreating: true while the creature is below its retreat HP threshold and
 *             actively fleeing rather than chasing. Cleared when HP recovers.
 *
 * Managed by aiChaseSystem and soundPropagationSystem.
 */
export const AggroState = defineComponent("AggroState", {
  alertLevel:      AGGRO_LEVELS.unaware,
  lastKnownX:      0,
  lastKnownY:      0,
  searchTurnsLeft: 0,
  retreating:      false,
});
