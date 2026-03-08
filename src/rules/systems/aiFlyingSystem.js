// src/rules/systems/aiFlyingSystem.js
// Produces FlyIntent for monsters with canFly based on aggro/search state,
// adjacency, and floor eligibility. Takeoff / landing resolves later as a
// full action in flyIntentSystem so it consumes the turn.

import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Speed } from "../components/Speed.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Flying } from "../components/Flying.js";
import { Vitality } from "../components/Vitality.js";
import { FlyIntent } from "../components/Intents/FlyIntent.js";
import { getMonster } from "../data/monsters.js";
import { canFlyOnFloor } from "../utils/flyingEligibility.js";

function chebyshevDistance(ax, ay, bx, by) {
  return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function aiFlyingSystem(world) {
  let playerX = 0;
  let playerY = 0;
  let hasPlayer = false;
  for (const [, _p, pos] of world.query(Player, Position)) {
    playerX = pos.x;
    playerY = pos.y;
    hasPlayer = true;
    break;
  }

  const floorAllowsFlight = canFlyOnFloor(world);

  for (const [id, aggro, pos] of world.query(AggroState, Position)) {
    if (world.has(id, Player)) continue;

    const spd = world.get(id, Speed);
    const actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) continue;

    const ni = world.get(id, NamedIdentity);
    const identity = ni?.identity || "";
    const def = getMonster(identity);
    if (!def || !def.canFly) continue;

    const isFlying = world.has(id, Flying);
    if (world.has(id, FlyIntent)) continue;

    const alert = aggro.alertLevel;
    const isAware = alert !== AGGRO_LEVELS.unaware;
    const isAdjacent = hasPlayer && chebyshevDistance(pos.x, pos.y, playerX, playerY) <= 1;
    const vit = world.get(id, Vitality);
    const retreatThreshold = Number(def.retreatHpPct || 0);
    const hpFraction = vit ? (vit.hp / Math.max(1, vit.maxHp)) : 1;
    const escapeBiased = retreatThreshold > 0 && hpFraction < retreatThreshold && isAware;

    // Flyers stay airborne through alerted/curious search states so breaking
    // LOS creates a more committed escape profile instead of an instant landing.
    const shouldFly = floorAllowsFlight
      && isAware
      && !isAdjacent
      && (
        alert === AGGRO_LEVELS.hunting
        || alert === AGGRO_LEVELS.alerted
        || alert === AGGRO_LEVELS.curious
        || escapeBiased
      );

    if (shouldFly === isFlying) continue;
    try { world.add(id, FlyIntent, { airborne: shouldFly }); } catch {}
  }
}
