// src/rules/systems/aiScurrySystem.js
// Scurry behaviour: low-intelligence creatures (intelligence ≤ 3) wander randomly
// while unaware of any threat.  Rats rustle, bats flit, cave snakes slither.
// Runs before aiChaseSystem in the 'ai' phase so the existing intent-skip guard
// (`if (world.has(id, MoveIntent)) return`) prevents aiChaseSystem from overriding.

import { Position }    from "../components/Position.js";
import { Faction }     from "../components/Faction.js";
import { Speed }       from "../components/Speed.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { MoveIntent }  from "../components/Intents/MoveIntent.js";
import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { getMonster }  from "../data/monsters.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { statusStrength }  from "../utils/statusFacade.js";
import { Player }      from "../components/Player.js";

// Keep AI work bounded: only scurry enemies near the player.
const SCURRY_RADIUS = 20;

// Cardinal directions a scurrying creature may choose.
const DIRS = [
  { dx:  0, dy: -1 },
  { dx:  0, dy:  1 },
  { dx:  1, dy:  0 },
  { dx: -1, dy:  0 },
];

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiScurrySystem(world) {
  // Need the player position as the radius anchor.
  let playerPos = null;
  for (const [, , pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  forEachInRadius(world, playerPos.x, playerPos.y, SCURRY_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "enemy") return;

    // Only idle creatures scurry.
    const aggro = world.get(id, AggroState);
    if (!aggro || aggro.alertLevel !== AGGRO_LEVELS.unaware) return;

    // Only dumb creatures (intelligence ≤ 3).
    const ni  = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    if (!def || (def.intelligence ?? 10) > 3) return;

    // Speed gate: matches the cadence logic in aiChaseSystem.
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // Skip if another system already queued a move this tick.
    if (world.has(id, MoveIntent)) return;

    // 50 % chance to rest; creatures don't scurry every single turn.
    if (world.rand() < 0.5) return;

    // Pick a random cardinal direction.
    const dir = DIRS[Math.floor(world.rand() * 4)];
    try { world.add(id, MoveIntent, { dx: dir.dx, dy: dir.dy }); } catch {}
  });
}
