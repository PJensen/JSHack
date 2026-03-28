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
import { Collider } from "../components/Collider.js";
import { Faction }      from "../components/Faction.js";
import { Speed }        from "../components/Speed.js";
import { Player }       from "../components/Player.js";
import { Equipment }    from "../components/Equipment.js";
import { ItemInfo }     from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Brain } from "../components/Brain.js";
import { Flying } from "../components/Flying.js";
import { Vitality }     from "../components/Vitality.js";
import { MoveIntent }   from "../components/Intents/MoveIntent.js";
import { FlyIntent } from "../components/Intents/FlyIntent.js";
import { RangedAttackIntent } from "../components/Intents/RangedAttackIntent.js";
import {
  AggroState,
  AGGRO_LEVELS,
  SEARCH_TURNS_HUNTING_GRACE,
  SEARCH_TURNS_ALERTED,
  SEARCH_TURNS_CURIOUS,
} from "../components/AggroState.js";
import { CreatureType, CREATURE_TYPES } from "../components/CreatureType.js";
import { getMonster }        from "../data/monsters.js";
import { SeenCallbackContext } from "../data/callbacks/ai.js";
import { runCallbackList }   from "../interaction/dispatch.js";
import { playerEntity }      from "../utils/queries.js";
import { findNextCardinalStep } from "../utils/gridPathfind.js";
import { forEachInRadius }   from "../utils/spatialIndex.js";
import { statusStrength }    from "../utils/statusFacade.js";
import { hasLOS }            from "../../shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { hasOverworldAerialLOS } from "../utils/flyingEligibility.js";
import { getTile, isFlyable, isWalkable } from "../environment/dungeon/tileMap.js";
import { TILE_STAIR_DOWN, TILE_STAIR_UP } from "../environment/dungeon/constants.js";
import { getEffectiveVisionRange } from "../utils/blind.js";
import { chebyshevScalar } from "../utils/distance.js";
import { CentipedeSegment } from "../components/CentipedeSegment.js";

const ACTIVE_RADIUS = 32; // tiles; keep AI work bounded to nearby entities

function isSmartPathingMonster(brain, def) {
  return Number(brain?.intelligence ?? def?.intelligence ?? 10) > 3;
}

/**
 * Returns true if this monster's creature type grants it the ability to open doors.
 * Humanoids, undead (skeletal hands), and demons can operate door handles.
 */
function monsterCanOpenDoors(world, id) {
  const ct = world.get(id, CreatureType);
  const type = ct?.type;
  return type === CREATURE_TYPES.humanoid
      || type === CREATURE_TYPES.undead
      || type === CREATURE_TYPES.demon;
}

function isStepTraversable(world, actorId, x, y, targetX, targetY, canTraverseTile) {
  if (!canTraverseTile(x, y)) return false;

  const tile = getTile(x, y);
  if (tile === TILE_STAIR_DOWN || tile === TILE_STAIR_UP) return false;

  // If the actor belongs to a centipede chain, skip same-chain segments
  const actorSeg = world.get(actorId, CentipedeSegment);
  const actorChainId = actorSeg ? actorSeg.chainId : 0;

  for (const [id, pos] of world.query(Position)) {
    if (id === actorId) continue;
    if (!pos || pos.x !== x || pos.y !== y) continue;
    if (x === targetX && y === targetY) continue;

    if (actorChainId) {
      const otherSeg = world.get(id, CentipedeSegment);
      if (otherSeg && otherSeg.chainId === actorChainId) continue;
    }

    const col = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const solid = !!col?.solid;
    const living = Number(vit?.hp || 0) > 0;
    if (solid || living) return false;
  }

  return true;
}

// ── Damage-triggered aggro listener ──────────────────────────────────

const AGGRO_DAMAGE_INSTALLED = Symbol.for("jshack:aggroFromDamage:installed");
const AGGRO_STEALTH_OFFENSE_INSTALLED = Symbol.for("jshack:aggroFromStealthOffense:installed");

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

/**
 * Witness-based aggro for hidden attacks:
 * enemies that have LOS to the attacker at the moment of stealth offense
 * enter hunting and track attacker last-known position.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installAggroFromStealthOffenseListener(world) {
  if (world[AGGRO_STEALTH_OFFENSE_INSTALLED]) return;
  world[AGGRO_STEALTH_OFFENSE_INSTALLED] = true;

  world.on("stealth:offense", ({ entityId, at }) => {
    const attackerId = Number(entityId || 0) | 0;
    if (!(attackerId > 0)) return;
    const attackerPos = at && Number.isFinite(at.x) && Number.isFinite(at.y)
      ? { x: at.x | 0, y: at.y | 0 }
      : world.get(attackerId, Position);
    if (!attackerPos) return;

    const isBlocked = blockedCallback(buildBlocksVisionMap(world));
    forEachInRadius(world, attackerPos.x, attackerPos.y, ACTIVE_RADIUS, (id, pos) => {
      if (id === attackerId) return;
      const fac = world.get(id, Faction);
      if (!fac || fac.key !== "enemy") return;
      const aggro = world.get(id, AggroState);
      if (!aggro) return;

      const sightRange = Math.max(0, Math.trunc(getEffectiveVisionRange(world, id)));
      if (chebyshevScalar(pos.x, pos.y, attackerPos.x, attackerPos.y) > sightRange) return;
      const canWitness = (
        hasOverworldAerialLOS(world, {
          sourceId: id,
          targetId: attackerId,
          sourcePos: pos,
          targetPos: attackerPos,
          range: sightRange,
        }) || hasLOS(
          pos.x | 0, pos.y | 0,
          attackerPos.x | 0, attackerPos.y | 0,
          isBlocked,
        )
      );
      if (!canWitness) return;

      aggro.alertLevel = AGGRO_LEVELS.hunting;
      aggro.lastKnownX = attackerPos.x | 0;
      aggro.lastKnownY = attackerPos.y | 0;
      aggro.searchTurnsLeft = SEARCH_TURNS_HUNTING_GRACE;
      world.emit?.("status", { id, kind: "alert", at: { x: pos.x | 0, y: pos.y | 0 } });
    });
  });
}

// ── AI chase system ───────────────────────────────────────────────────

/** @param {any} world */
export function aiChaseSystem(world) {
  // Locate the player.
  const _player = playerEntity(world);
  if (!_player) return;
  const playerId  = _player.id;
  const playerPos = _player.pos;

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
    const hasQueuedAction = world.has(id, MoveIntent) || world.has(id, FlyIntent);

    // Perception is driven by Brain data rather than action cadence.
    // Use getEffectiveVisionRange so that stat envelope effects (e.g. blindness) apply.
    const sightRange = Math.max(0, Math.trunc(getEffectiveVisionRange(world, id)));
    const withinSightRange = chebyshevScalar(pos.x, pos.y, playerPos.x, playerPos.y) <= sightRange;
    const invisibleTarget = statusStrength(world, playerId, "invisible") > 0;
    const adjacentToTarget = chebyshevScalar(pos.x, pos.y, playerPos.x, playerPos.y) <= 1;
    const canSeeNormally = withinSightRange && (
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
    // Stealth rule: non-adjacent invisible targets should not keep enemies in chase mode.
    // They fall back to unaware state so idle movement (scurry/patrol) takes over.
    if (invisibleTarget && !adjacentToTarget) {
      if (aggro.alertLevel !== AGGRO_LEVELS.unaware) {
        aggro.alertLevel = AGGRO_LEVELS.unaware;
        aggro.searchTurnsLeft = 0;
        aggro.retreating = false;
      }
      return;
    }
    const canSee = canSeeNormally;

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
        if (!hasQueuedAction && canActThisTurn && Array.isArray(onSeenHooks) && onSeenHooks.length > 0) {
          const seenCtx = new SeenCallbackContext(world, {
            actor:     id,
            target:    playerId,
            actorPos:  { x: pos.x | 0, y: pos.y | 0 },
            targetPos: { x: playerPos.x | 0, y: playerPos.y | 0 },
            canActThisTurn,
            hasQueuedMove: hasQueuedAction,
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
          hasQueuedMove: hasQueuedAction,
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
    if (!canActThisTurn || hasQueuedAction) return;

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
      if (chebyshevScalar(pos.x, pos.y, playerPos.x, playerPos.y) > 1) return; // hold position — don't move yet
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
          try {
            world.emit?.('combat:telegraph', {
              actor: id,
              target: playerId,
              mode: 'ranged',
              turns: 0,
            });
          } catch {}
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

    if (!aggro.retreating && isSmartPathingMonster(brain, def)) {
      const canTraverseTile = world.has(id, Flying) ? isFlyable : isWalkable;
      const canOpenDoors = monsterCanOpenDoors(world, id);
      const nx = (pos.x | 0) + dx;
      const ny = (pos.y | 0) + dy;
      if (!isStepTraversable(world, id, nx, ny, targetX, targetY, canTraverseTile)) {
        const next = findNextCardinalStep(world, pos.x | 0, pos.y | 0, targetX, targetY, id, {
          goalRadius: 0,
          maxNodes: 256,
          isPassable: canTraverseTile,
          passThroughDoors: canOpenDoors,
        });
        if (next) {
          dx = next.dx | 0;
          dy = next.dy | 0;
        }
      }
    }

    // Retreating creatures flip their direction — run away from the target.
    if (aggro.retreating) {
      dx = -dx;
      dy = -dy;
    }

    try { world.add(id, MoveIntent, { dx, dy }); } catch {}
  });
}
