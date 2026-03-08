// src/rules/systems/aiFlyingSystem.js
// Toggles the Flying component on/off for monsters with canFly based on
// aggro state and floor eligibility.
//
// Runs in the 'ai' phase before aiScurrySystem / aiChaseSystem so that
// movement and combat systems can read the up-to-date flying state.

import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { Position }      from "../components/Position.js";
import { Player }        from "../components/Player.js";
import { Speed }         from "../components/Speed.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Flying }        from "../components/Flying.js";
import { getMonster }    from "../data/monsters.js";
import { canFlyOnFloor } from "../utils/flyingEligibility.js";

function chebyshevDistance(ax, ay, bx, by) {
  return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function aiFlyingSystem(world) {
  // Find player position (needed for adjacency check).
  let playerX = 0, playerY = 0, hasPlayer = false;
  for (const [, _p, pos] of world.query(Player, Position)) {
    playerX = pos.x; playerY = pos.y; hasPlayer = true;
    break;
  }

  const floorAllowsFlight = canFlyOnFloor(world);

  for (const [id, aggro, pos] of world.query(AggroState, Position)) {
    // Skip player entity
    if (world.has(id, Player)) continue;

    // Speed gate: only act on the entity's turn
    const spd = world.get(id, Speed);
    const actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) continue;

    // Check monster definition for canFly
    const ni = world.get(id, NamedIdentity);
    const identity = ni?.identity || '';
    const def = getMonster(identity);
    if (!def || !def.canFly) continue;

    const isFlying = world.has(id, Flying);

    // Floor invariant: if this floor doesn't allow flight, strip Flying
    if (!floorAllowsFlight) {
      if (isFlying) {
        world.remove(id, Flying);
        try { world.emit?.('proc:fly:land', { id, x: pos.x, y: pos.y, name: def.name }); } catch {}
      }
      continue;
    }

    const alert = aggro.alertLevel;
    const isEngaged = alert === AGGRO_LEVELS.hunting || alert === AGGRO_LEVELS.alerted;

    if (isEngaged) {
      // Adjacent to player → land to melee (creates tactical window)
      if (hasPlayer && chebyshevDistance(pos.x, pos.y, playerX, playerY) <= 1) {
        if (isFlying) {
          world.remove(id, Flying);
          try { world.emit?.('proc:fly:land', { id, x: pos.x, y: pos.y, name: def.name }); } catch {}
        }
      } else {
        // Engaged but not adjacent → take flight
        if (!isFlying) {
          world.add(id, Flying, {});
          try { world.emit?.('proc:fly:takeoff', { id, x: pos.x, y: pos.y, name: def.name }); } catch {}
        }
      }
    } else {
      // Not engaged → land
      if (isFlying) {
        world.remove(id, Flying);
        try { world.emit?.('proc:fly:land', { id, x: pos.x, y: pos.y, name: def.name }); } catch {}
      }
    }
  }
}
