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
 * targetId: current live aggro target while hunting; 0 means no selected target.
 * targetReason: why targetId was selected (sight, conflict, taunt, etc.).
 * highestThreatId: source with the highest current ThreatEntry value.
 * forcedTargetId / forcedUntilTurn: hard taunt lock.
 * threatLockUntilTurn: soft switch lock to prevent threshold chatter.
 * lastTargetSwitchTurn: turn of the last target change.
 * threatState: display/debug summary ("none", "stable", "unstable", "locked").
 * lastKnownMoveDx/Dy: last observed movement direction of the target.
 *   Used by intel ≥ 8 monsters to anticipate escape routes on LOS break.
 * searchTurnsLeft: countdown before downgrading to the next lower tier.
 * retreating: true while the creature is below its retreat HP threshold and
 *             actively fleeing rather than chasing. Cleared when HP recovers.
 * patrolDx/patrolDy: current patrol heading used when unaware and intelligence > 3.
 *   0,0 means "not yet assigned" — aiScurrySystem picks a direction on first use.
 *
 * Managed by aiChaseSystem, aiScurrySystem, and soundPropagationSystem.
 */
export const AggroState = defineComponent("AggroState", {
  alertLevel:        AGGRO_LEVELS.unaware,
  targetId:          0,
  targetReason:      "",
  highestThreatId:   0,
  forcedTargetId:    0,
  forcedUntilTurn:   0,
  threatLockUntilTurn: 0,
  lastTargetSwitchTurn: 0,
  threatState:       "none",
  lastKnownX:        0,
  lastKnownY:        0,
  lastKnownMoveDx:   0,
  lastKnownMoveDy:   0,
  searchTurnsLeft:   0,
  retreating:        false,
  patrolDx:          0,
  patrolDy:          0,
});
