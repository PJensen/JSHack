// src/rules/systems/disarmTrapSystem.js
// Processes DisarmIntent: actor attempts to disarm a nearby armed trap.
// On success the trap is revealed and disarmed harmlessly.
// On failure the trap triggers in the actor's face.

import { DisarmIntent } from "../components/Intents/DisarmIntent.js";
import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";
import { mulberry32, rngInt, combatSeed, pct } from "../utils/rng.js";
import { getPassiveBonuses } from "../utils/passiveBonuses.js";
import { statusStrength } from "../utils/statusFacade.js";
import { runScript, ScriptVerb } from "../scripting.js";

/**
 * Find the best trap candidate: prefer a specific trapId if provided,
 * otherwise search the actor's tile and cardinal neighbors.
 */
function findTrap(world, actorPos, trapId) {
  if (trapId > 0) {
    const t = world.get(trapId, Trap);
    if (t && t.armed) return [trapId, t];
    return null;
  }

  // Search actor tile + cardinal & diagonal neighbors
  const offsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  for (const [dx, dy] of offsets) {
    const tx = actorPos.x + dx;
    const ty = actorPos.y + dy;
    for (const [tid, tpos, t] of world.query(Position, Trap)) {
      if (!tpos || !t) continue;
      if (!t.armed) continue;
      if (tpos.x === tx && tpos.y === ty) return [tid, t];
    }
  }
  return null;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function disarmTrapSystem(world) {
  for (const [actorId, intent] of world.query(DisarmIntent)) {
    if (!intent) continue;

    // Remove intent (consumed this tick)
    try { world.remove(actorId, DisarmIntent); } catch {}

    const actorPos = world.get(actorId, Position);
    if (!actorPos) continue;

    const found = findTrap(world, actorPos, intent.trapId || 0);
    if (!found) {
      world.emit?.('trap:disarm:no-trap', { actor: actorId });
      continue;
    }

    const [tid, t] = found;

    // Reveal the trap (player has found it)
    if (!t.revealed) {
      try { world.set(tid, Trap, { ...t, revealed: true }); } catch {}
    }

    // Deterministic d20 roll seeded from world state
    const seed = combatSeed(world.seed, world.step, actorId, tid, 0xD15A);
    const rng = mulberry32(seed);
    const roll = rngInt(rng, 1, 20);
    const dc = t.difficulty || 10;

    // Luck modifier: positive luck gives a lucky save on failure,
    // negative luck can fumble a success.
    let success = roll >= dc;
    const passive = getPassiveBonuses(world, actorId);
    const luck = Number(passive?.luckDerived || 0) + statusStrength(world, actorId, "lucky");
    if (!success && luck > 0) {
      success = pct(rng, luck);
    } else if (success && luck < 0) {
      success = !pct(rng, -luck);
    }

    if (success) {
      // Success — disarm harmlessly
      try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {}
      world.emit?.('trap:disarmed', {
        actor: actorId,
        trapId: tid,
        trapType: t.type,
        roll,
        dc,
      });
    } else {
      // Failure — trap triggers on the actor
      const scriptKey = t.script || '';
      if (scriptKey) {
        runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
          trapId: tid,
          targetId: actorId,
          trap: t,
          params: t.params || {},
        });
      }
      // Mark triggered (same as normal trigger)
      try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {}
      world.emit?.('trap:disarm:failed', {
        actor: actorId,
        trapId: tid,
        trapType: t.type,
        roll,
        dc,
      });
    }
  }
}
