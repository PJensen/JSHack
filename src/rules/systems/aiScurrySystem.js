// src/rules/systems/aiScurrySystem.js
// Idle movement for unaware enemies: low-intelligence creatures roam randomly,
// higher-intelligence creatures patrol in a persistent direction.
//
//   intelligence ≤ 3  → random scurry (rats, bats, snakes): random direction each
//                        turn with 50 % rest chance.
//   intelligence > 3  → directed patrol (goblins, skeletons, orcs…): maintains a
//                        patrol heading stored in AggroState.patrolDx/patrolDy.
//                        The heading persists until the monster hits a wall, then
//                        a new random direction is chosen.  Doors are NOT treated
//                        as walls here — the bump resolver handles opening them.
//
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
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { getTile } from "../environment/dungeon/tileMap.js";
import { TILE_STAIR_DOWN, TILE_STAIR_UP } from "../environment/dungeon/constants.js";
import { playerEntity } from "../utils/queries.js";

// Keep AI work bounded: only process enemies near the player.
const SCURRY_RADIUS = 20;

// Cardinal directions available for movement.
const DIRS = [
  { dx:  0, dy: -1 },
  { dx:  0, dy:  1 },
  { dx:  1, dy:  0 },
  { dx: -1, dy:  0 },
];

/**
 * Returns true if a tile is a suitable patrol destination (walkable and not a staircase).
 * Closed doors (walkable tile, solid entity) are allowed — the bump resolver will open them.
 */
function isPatrolStep(x, y) {
  if (!isWalkable(x, y)) return false;
  const t = getTile(x, y);
  return t !== TILE_STAIR_DOWN && t !== TILE_STAIR_UP;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiScurrySystem(world) {
  // Need the player position as the radius anchor.
  const player = playerEntity(world);
  if (!player) return;
  const playerPos = player.pos;

  forEachInRadius(world, playerPos.x, playerPos.y, SCURRY_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "enemy") return;

    // Only idle creatures move here.
    const aggro = world.get(id, AggroState);
    if (!aggro || aggro.alertLevel !== AGGRO_LEVELS.unaware) return;

    const ni  = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    if (!def) return;

    // Speed gate: matches the cadence logic in aiChaseSystem.
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // Skip if another system already queued a move this tick.
    if (world.has(id, MoveIntent)) return;

    const intel = def.intelligence ?? 10;

    if (intel <= 3) {
      // ── Low intelligence: random scurry ────────────────────────────
      // 50 % chance to rest; creatures don't scurry every single turn.
      if (world.rand() < 0.5) return;

      const dir = DIRS[Math.floor(world.rand() * 4)];
      try { world.add(id, MoveIntent, { dx: dir.dx, dy: dir.dy }); } catch {}
    } else {
      // ── Higher intelligence: directed patrol ────────────────────────
      // 25 % chance to pause; patrols are more deliberate than a scurry.
      if (world.rand() < 0.25) return;

      let pdx = aggro.patrolDx | 0;
      let pdy = aggro.patrolDy | 0;

      // Assign an initial patrol direction if none set yet.
      if (pdx === 0 && pdy === 0) {
        const dir = DIRS[Math.floor(world.rand() * 4)];
        pdx = dir.dx;
        pdy = dir.dy;
      }

      // If the next tile in patrol direction is a wall or stair, pick a new heading.
      if (!isPatrolStep((pos.x | 0) + pdx, (pos.y | 0) + pdy)) {
        // Try directions excluding the current one (and its reverse to avoid immediately
        // bouncing back, if alternatives exist).
        const alts = DIRS.filter(d => !(d.dx === pdx && d.dy === pdy));
        let picked = false;
        // Shuffle by consuming two rand() calls so ordering varies each turn.
        const offset = Math.floor(world.rand() * alts.length);
        for (let i = 0; i < alts.length; i++) {
          const d = alts[(offset + i) % alts.length];
          if (isPatrolStep((pos.x | 0) + d.dx, (pos.y | 0) + d.dy)) {
            pdx = d.dx;
            pdy = d.dy;
            picked = true;
            break;
          }
        }
        if (!picked) return; // fully cornered — stay put
      }

      aggro.patrolDx = pdx;
      aggro.patrolDy = pdy;
      try { world.add(id, MoveIntent, { dx: pdx, dy: pdy }); } catch {}
    }
  });
}
