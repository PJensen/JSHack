// src/rules/systems/aiChaseSystem.js
// Enemy AI: LOS-based aggro state machine.  Replaces the previous world-level
// "seen" Set with per-entity AggroState so stealth and search behaviour are
// actually simulated on each individual creature.
//
// Intelligence-gated behaviours (sourced from MONSTERS[].intelligence):
//   passive  (aggro:'passive') — sight never triggers hunting while unaware;
//                                only damage-based aggro works.
//   packSense (any intelligence) — first sighting alerts nearby same-species.
//                                  safety in numbers: unaware pack creatures
//                                  won't aggro from sight unless an ally of the
//                                  same species is within packRadius.
//   ambush   (def.ambush)      — creature holds position until player is adjacent.
//   retreat  (def.retreatHpPct) — creature flees when HP < threshold.

import { Position }     from "../components/Position.js";
import { Faction }      from "../components/Faction.js";
import { Speed }        from "../components/Speed.js";
import { Player }       from "../components/Player.js";
import { Equipment }    from "../components/Equipment.js";
import { ItemInfo }     from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Brain } from "../components/Brain.js";
import { Vitality }     from "../components/Vitality.js";
import { MoveIntent }   from "../components/Intents/MoveIntent.js";
import { RangedAttackIntent } from "../components/Intents/RangedAttackIntent.js";
import {
  AggroState,
  AGGRO_LEVELS,
  SEARCH_TURNS_HUNTING_GRACE,
  SEARCH_TURNS_ALERTED,
  SEARCH_TURNS_CURIOUS,
} from "../components/AggroState.js";
import { getMonster }        from "../data/monsters.js";
import { SeenCallbackContext } from "../data/callbacks/ai.js";
import { runCallbackList }   from "../interaction/dispatch.js";
import { forEachInRadius }   from "../utils/spatialIndex.js";
import { statusStrength }    from "../utils/statusFacade.js";
import { hasLOS }            from "../../shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { hasOverworldAerialLOS } from "../utils/flyingEligibility.js";

const ACTIVE_RADIUS = 32; // tiles; keep AI work bounded to nearby entities

function chebyshevDistance(ax, ay, bx, by) {
  return Math.max(Math.abs((ax | 0) - (bx | 0)), Math.abs((ay | 0) - (by | 0)));
}

// ── Damage-triggered aggro listener ──────────────────────────────────

const AGGRO_DAMAGE_INSTALLED = Symbol.for("jshack:aggroFromDamage:installed");

/**
 * When an enemy takes damage it immediately becomes alerted (if not already
 * hunting), pointing its search toward the attacker's last known position.
 * Install once per world in configureWorld().
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installAggroFromDamageListener(world) {
  if (world[AGGRO_DAMAGE_INSTALLED]) return;
  world[AGGRO_DAMAGE_INSTALLED] = true;

  world.on("damaged", ({ target, source, at }) => {
    const aggro = world.get(target, AggroState);
    if (!aggro) return;
    if (aggro.alertLevel === AGGRO_LEVELS.hunting) return; // already on highest alert

    // Try to point the search toward the attacker's position.
    const srcPos = (source && world.isAlive(source)) ? world.get(source, Position) : null;
    if (srcPos) {
      aggro.lastKnownX = srcPos.x | 0;
      aggro.lastKnownY = srcPos.y | 0;
    } else if (at) {
      aggro.lastKnownX = at.x | 0;
      aggro.lastKnownY = at.y | 0;
    }

    aggro.alertLevel      = AGGRO_LEVELS.alerted;
    aggro.searchTurnsLeft = SEARCH_TURNS_ALERTED;

    const tPos = world.get(target, Position);
    if (tPos) world.emit('status', { id: target, kind: 'alert', at: { x: tPos.x | 0, y: tPos.y | 0 } });
  });
}

// ── AI chase system ───────────────────────────────────────────────────

/** @param {any} world */
export function aiChaseSystem(world) {
  // Locate the player.
  let playerId  = 0;
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerId  = id;
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  // Lazily built blocking map for LOS checks (built once, shared this tick).
  let _isBlocked = null;
  const ensureBlockedMap = () => {
    if (!_isBlocked) _isBlocked = blockedCallback(buildBlocksVisionMap(world));
    return _isBlocked;
  };

  forEachInRadius(world, playerPos.x, playerPos.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "enemy") return;

    const aggro = world.get(id, AggroState);
    if (!aggro) return; // no AggroState = no AI behaviour

    // ── Look up monster def and brain-backed awareness ──────────────
    const ni = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    const brain = world.get(id, Brain);

    // Speed gate: only act on ticks that match this entity's cadence.
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;

    // Frost slow stacks double the cadence per stack.
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    const canActThisTurn = !(actEvery > 1 && ((world.step + id) % actEvery) !== 0);
    const hasQueuedMove = world.has(id, MoveIntent);

    // Perception is driven by Brain data rather than action cadence.
    const sightRange = Math.max(0, Math.trunc(Number(brain?.visionRange ?? def?.visionRange ?? 8)));
    const withinSightRange = chebyshevDistance(pos.x, pos.y, playerPos.x, playerPos.y) <= sightRange;
    const canSee = withinSightRange && (
      hasOverworldAerialLOS(world, {
        sourceId: id,
        targetId: playerId,
        sourcePos: pos,
        targetPos: playerPos,
        range: sightRange,
      }) || hasLOS(
        pos.x | 0, pos.y | 0,
        playerPos.x | 0, playerPos.y | 0,
        ensureBlockedMap(),
      )
    );

    // ── Alert level transitions ─────────────────────────────────────
    if (canSee) {
      // Passive creatures (e.g. bat, cave_snake, snake) don't aggro from sight
      // while unaware — they are only aggroed by taking damage.
      if (def?.aggro === "passive" && aggro.alertLevel === AGGRO_LEVELS.unaware) return;

      // Safety in numbers: unaware pack creatures won't aggro from sight alone.
      // They need at least one same-species ally within packRadius.
      if (def?.packSense && aggro.alertLevel === AGGRO_LEVELS.unaware) {
        const myIdentity = ni?.identity;
        if (myIdentity) {
          const packRadius = Math.max(1, (def.packRadius ?? 8) | 0);
          let hasAlly = false;
          forEachInRadius(world, pos.x, pos.y, packRadius, (neighborId) => {
            if (hasAlly) return;
            if (neighborId === id) return;
            const neighborNI = world.get(neighborId, NamedIdentity);
            if (neighborNI && neighborNI.identity === myIdentity) hasAlly = true;
          });
          if (!hasAlly) return;
        }
      }

      const wasHunting = aggro.alertLevel === AGGRO_LEVELS.hunting;

      aggro.alertLevel      = AGGRO_LEVELS.hunting;
      aggro.lastKnownX      = playerPos.x | 0;
      aggro.lastKnownY      = playerPos.y | 0;
      aggro.searchTurnsLeft = SEARCH_TURNS_HUNTING_GRACE;

      // ── First sighting: onSeen hooks + pack alerting ────────────
      if (!wasHunting) {
        world.emit('status', { id, kind: 'alert', at: { x: pos.x | 0, y: pos.y | 0 } });
        // onSeen hooks (e.g. spider leap)
        const onSeenHooks = def?.hooks?.onSeen;
        if (!hasQueuedMove && canActThisTurn && Array.isArray(onSeenHooks) && onSeenHooks.length > 0) {
          const seenCtx = new SeenCallbackContext(world, {
            actor:     id,
            target:    playerId,
            actorPos:  { x: pos.x | 0, y: pos.y | 0 },
            targetPos: { x: playerPos.x | 0, y: playerPos.y | 0 },
            canActThisTurn,
            hasQueuedMove,
          });
          runCallbackList(onSeenHooks, seenCtx);
          if (seenCtx.handled || seenCtx.cancelled) return;
        }

        // Pack alerting: wake up nearby same-species creatures.
        if (def?.packSense) {
          const myIdentity = ni?.identity;
          if (myIdentity) {
            const packRadius = Math.max(1, (def.packRadius ?? 8) | 0);
            forEachInRadius(world, pos.x, pos.y, packRadius, (neighborId) => {
              if (neighborId === id) return;
              const neighborNI = world.get(neighborId, NamedIdentity);
              if (!neighborNI || neighborNI.identity !== myIdentity) return;
              const neighborAggro = world.get(neighborId, AggroState);
              if (!neighborAggro || neighborAggro.alertLevel === AGGRO_LEVELS.hunting) return;
              neighborAggro.alertLevel      = AGGRO_LEVELS.alerted;
              neighborAggro.lastKnownX      = playerPos.x | 0;
              neighborAggro.lastKnownY      = playerPos.y | 0;
              neighborAggro.searchTurnsLeft = SEARCH_TURNS_ALERTED;
              const nPos = world.get(neighborId, Position);
              if (nPos) world.emit('status', { id: neighborId, kind: 'alert', at: { x: nPos.x | 0, y: nPos.y | 0 } });
            });
          }
        }
      }

      // ── whileLOS hooks: fire every turn the monster has LOS ──────────
      const whileLOSHooks = def?.hooks?.whileLOS;
      if (Array.isArray(whileLOSHooks) && whileLOSHooks.length > 0) {
        const losCtx = new SeenCallbackContext(world, {
          actor:     id,
          target:    playerId,
          actorPos:  { x: pos.x | 0, y: pos.y | 0 },
          targetPos: { x: playerPos.x | 0, y: playerPos.y | 0 },
          canActThisTurn,
          hasQueuedMove,
        });
        runCallbackList(whileLOSHooks, losCtx);
        if (losCtx.handled || losCtx.cancelled) return;
      }
    } else {
      // No LOS — tick down the search budget.
      switch (aggro.alertLevel) {
        case AGGRO_LEVELS.hunting:
          // Just lost LOS; transition to alerted with existing lastKnown.
          aggro.alertLevel      = AGGRO_LEVELS.alerted;
          aggro.searchTurnsLeft = SEARCH_TURNS_ALERTED;
          break;
        case AGGRO_LEVELS.alerted:
          aggro.searchTurnsLeft--;
          if (aggro.searchTurnsLeft <= 0) {
            aggro.alertLevel      = AGGRO_LEVELS.curious;
            aggro.searchTurnsLeft = SEARCH_TURNS_CURIOUS;
          }
          break;
        case AGGRO_LEVELS.curious:
          aggro.searchTurnsLeft--;
          if (aggro.searchTurnsLeft <= 0) {
            aggro.alertLevel      = AGGRO_LEVELS.unaware;
            aggro.searchTurnsLeft = 0;
            aggro.retreating      = false; // clear retreat flag on de-aggro
          }
          break;
        default:
          break; // unaware — do nothing
      }
    }

    if (aggro.alertLevel === AGGRO_LEVELS.unaware) return;

    // Awareness keeps updating every turn; cadence only gates intent production.
    if (!canActThisTurn || hasQueuedMove) return;

    // ── Retreat: update flag based on current HP ────────────────────
    const retreatThreshold = def?.retreatHpPct ?? 0;
    if (retreatThreshold > 0 && aggro.alertLevel === AGGRO_LEVELS.hunting) {
      const vit = world.get(id, Vitality);
      const hpFraction = vit ? vit.hp / Math.max(1, vit.maxHp) : 1;
      aggro.retreating = hpFraction < retreatThreshold;
    } else {
      aggro.retreating = false;
    }

    // ── Ambush: hold position until player is adjacent ──────────────
    // Ambushers (floating eye, carrion shade, mimic) stay still until the
    // player walks into melee range, then strike.
    if (def?.ambush && aggro.alertLevel === AGGRO_LEVELS.hunting) {
      const dxa = (playerPos.x | 0) - (pos.x | 0);
      const dya = (playerPos.y | 0) - (pos.y | 0);
      const chebDist = Math.max(Math.abs(dxa), Math.abs(dya));
      if (chebDist > 1) return; // hold position — don't move yet
      // Player is adjacent; fall through to normal attack/move logic.
    }

    // ── Choose movement target ──────────────────────────────────────
    const targetX = aggro.alertLevel === AGGRO_LEVELS.hunting
      ? playerPos.x | 0
      : aggro.lastKnownX;
    const targetY = aggro.alertLevel === AGGRO_LEVELS.hunting
      ? playerPos.y | 0
      : aggro.lastKnownY;

    const dxt = targetX - (pos.x | 0);
    const dyt = targetY - (pos.y | 0);

    // Reached last-known position without finding the player; give up sooner.
    if (dxt === 0 && dyt === 0 && aggro.alertLevel !== AGGRO_LEVELS.hunting) {
      aggro.alertLevel = aggro.alertLevel === AGGRO_LEVELS.alerted
        ? AGGRO_LEVELS.curious
        : AGGRO_LEVELS.unaware;
      aggro.searchTurnsLeft = aggro.alertLevel === AGGRO_LEVELS.curious
        ? SEARCH_TURNS_CURIOUS
        : 0;
      return;
    }

    // ── Ranged attack: prefer shooting when hunting and in LOS ──────
    if (aggro.alertLevel === AGGRO_LEVELS.hunting && canSee && !aggro.retreating) {
      const eq = world.get(id, Equipment);
      if (eq && eq.ranged && eq.ammo && world.isAlive(eq.ammo)) {
        const weaponInfo = eq.ranged ? world.get(eq.ranged, ItemInfo) : null;
        const maxRange   = weaponInfo?.range || 8;
        const dist       = Math.max(Math.abs(dxt), Math.abs(dyt));
        if (dist > 1 && dist <= maxRange) {
          try { world.add(id, RangedAttackIntent, { targetId: playerId }); } catch {}
          return;
        }
      }
    }

    // ── Chase / retreat: step on dominant axis ──────────────────────
    if (dxt === 0 && dyt === 0) return;

    const ax = Math.abs(dxt);
    const ay = Math.abs(dyt);
    let dx = 0, dy = 0;
    if (ax >= ay) { dx = Math.sign(dxt); dy = 0; } else { dy = Math.sign(dyt); dx = 0; }

    // Retreating creatures flip their direction — run away from the target.
    if (aggro.retreating) {
      dx = -dx;
      dy = -dy;
    }

    try { world.add(id, MoveIntent, { dx, dy }); } catch {}
  });
}
