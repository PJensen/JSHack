// src/rules/systems/summonedBehaviorSystem.js
// State-aware AI for summoned creatures (e.g. summoned skeletons).
// Respects PetState commands broadcast from pet command handlers.
// Fallback: creatures without PetState use original aggressive chase.

import { Position } from '../components/Position.js';
import { Faction } from '../components/Faction.js';
import { Vitality } from '../components/Vitality.js';
import { Speed } from '../components/Speed.js';
import { MoveIntent } from '../components/Intents/MoveIntent.js';
import { PetState } from '../components/PetState.js';
import { Player } from '../components/Player.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { statusStrength } from '../utils/statusFacade.js';
import { forEachInRadius } from '../utils/spatialIndex.js';
import { findNearestValidTileAround } from '../utils/queries.js';
import {
  FOLLOW_DISTANCE,
  TELEPORT_DISTANCE,
  GUARD_RADIUS,
  FLEE_THRESHOLD,
} from './petConstants.js';

const ACTIVE_RADIUS = 20;
const AGGRESSIVE_RADIUS = 8;

/** @param {any} world */
export function summonedBehaviorSystem(world) {
  // Find player (needed for following/teleport)
  let playerId = 0;
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerId = id;
    playerPos = { x: pos.x, y: pos.y };
    break;
  }

  for (const [id, fac, pos, vit] of world.query(Faction, Position, Vitality)) {
    if (!fac || fac.key !== 'summoned') continue;
    if (!vit || (vit.hp | 0) <= 0) continue;

    // Speed gate
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) continue;

    if (world.has(id, MoveIntent)) continue;

    // Check PetState for commanded behavior
    const petState = world.get(id, PetState);
    if (petState && playerPos) {
      checkSummonAutoTransitions(world, id, petState, pos, vit, playerPos);
      executeSummonState(world, id, petState, fac, pos, playerPos);
      continue;
    }

    // Fallback: no PetState — original aggressive chase logic
    chaseNearestHostile(world, id, fac, pos);
  }
}

// ---------------------------------------------------------------------------
// Auto-transitions (flee on low HP, teleport when far)
// ---------------------------------------------------------------------------

function checkSummonAutoTransitions(world, id, petState, pos, vit, playerPos) {
  // Flee if low health (overrides all states except fleeing)
  if (petState.state !== 'fleeing') {
    if (vit.hp > 0 && (vit.hp / vit.maxHp) < FLEE_THRESHOLD) {
      petState.state = 'fleeing';
      petState.stateEnteredTurn = world.step;
      petState.targetX = null;
      petState.targetY = null;
      petState.targetItemId = 0;
      try {
        world.emit?.('summon:state:auto', { id, newState: 'fleeing', reason: 'low_health' });
      } catch {}
      return;
    }
  }

  // Restore to aggressive if health recovered while fleeing
  if (petState.state === 'fleeing') {
    if ((vit.hp / vit.maxHp) >= FLEE_THRESHOLD + 0.1) {
      petState.state = 'aggressive';
      petState.stateEnteredTurn = world.step;
      try {
        world.emit?.('summon:state:auto', { id, newState: 'aggressive', reason: 'health_restored' });
      } catch {}
      return;
    }
  }

  // Teleport to player if too far (except staying/guarding)
  if (petState.state !== 'staying' && petState.state !== 'guarding') {
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist > TELEPORT_DISTANCE) {
      const tile = findNearestValidTileAround(world, playerPos, {
        maxDistance: 2,
        exclude: [{ x: playerPos.x, y: playerPos.y }],
      });
      if (tile) {
        world.set(id, Position, tile);
        try {
          world.emit?.('summon:teleported', { id, from: { x: pos.x, y: pos.y }, to: tile });
        } catch {}
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// State dispatcher
// ---------------------------------------------------------------------------

function executeSummonState(world, id, petState, fac, pos, playerPos) {
  switch (petState.state) {
    case 'aggressive':
      summonAggressive(world, id, fac, pos, playerPos);
      break;
    case 'following':
      summonFollowing(world, id, pos, playerPos);
      break;
    case 'staying':
    case 'idle':
      break; // hold position
    case 'guarding':
      summonGuarding(world, id, petState, fac, pos);
      break;
    case 'fleeing':
      summonFleeing(world, id, pos, playerPos);
      break;
    default:
      summonAggressive(world, id, fac, pos, playerPos);
      break;
  }
}

// ---------------------------------------------------------------------------
// Behavior: aggressive — chase nearest hostile, fallback to following
// ---------------------------------------------------------------------------

function summonAggressive(world, id, fac, pos, playerPos) {
  let bestTarget = 0;
  let bestDist = Infinity;
  let bestPos = null;

  forEachInRadius(world, pos.x, pos.y, AGGRESSIVE_RADIUS, (eid, epos) => {
    if (eid === id) return;
    const eFac = world.get(eid, Faction);
    if (!eFac || !areFactionsHostile(fac.key, eFac.key)) return;
    const eVit = world.get(eid, Vitality);
    if (!eVit || (eVit.hp | 0) <= 0) return;
    const dist = Math.abs((epos.x | 0) - (pos.x | 0)) + Math.abs((epos.y | 0) - (pos.y | 0));
    if (dist < bestDist) {
      bestTarget = eid;
      bestDist = dist;
      bestPos = { x: epos.x | 0, y: epos.y | 0 };
    }
  });

  if (bestTarget && bestPos) {
    moveTowardSimple(world, id, bestPos.x, bestPos.y);
    return;
  }

  // No enemy — follow the player
  summonFollowing(world, id, pos, playerPos);
}

// ---------------------------------------------------------------------------
// Behavior: following — stay near player
// ---------------------------------------------------------------------------

function summonFollowing(world, id, pos, playerPos) {
  const dx = playerPos.x - pos.x;
  const dy = playerPos.y - pos.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist <= FOLLOW_DISTANCE) return;
  moveTowardSimple(world, id, playerPos.x, playerPos.y);
}

// ---------------------------------------------------------------------------
// Behavior: guarding — hold position, attack enemies within radius
// ---------------------------------------------------------------------------

function summonGuarding(world, id, petState, fac, pos) {
  if (petState.targetX === null || petState.targetY === null) {
    petState.state = 'aggressive';
    petState.stateEnteredTurn = world.step;
    return;
  }

  // Return to guard position if too far
  const dx = petState.targetX - pos.x;
  const dy = petState.targetY - pos.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist > 1) {
    moveTowardSimple(world, id, petState.targetX, petState.targetY);
    return;
  }

  // At guard position — look for enemies within radius
  let closestEnemy = 0;
  let closestDist = GUARD_RADIUS + 1;

  forEachInRadius(world, pos.x, pos.y, GUARD_RADIUS, (eid, epos) => {
    if (eid === id) return;
    const eFac = world.get(eid, Faction);
    if (!eFac || !areFactionsHostile(fac.key, eFac.key)) return;
    const eVit = world.get(eid, Vitality);
    if (!eVit || (eVit.hp | 0) <= 0) return;
    const edist = Math.abs((epos.x | 0) - (pos.x | 0)) + Math.abs((epos.y | 0) - (pos.y | 0));
    if (edist < closestDist) {
      closestEnemy = eid;
      closestDist = edist;
    }
  });

  if (closestEnemy) {
    const enemyPos = world.get(closestEnemy, Position);
    if (enemyPos) {
      moveTowardSimple(world, id, enemyPos.x, enemyPos.y);
    }
  }
}

// ---------------------------------------------------------------------------
// Behavior: fleeing — retreat toward player
// ---------------------------------------------------------------------------

function summonFleeing(world, id, pos, playerPos) {
  const dx = playerPos.x - pos.x;
  const dy = playerPos.y - pos.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  if (dist <= 1) return;
  moveTowardSimple(world, id, playerPos.x, playerPos.y);
}

// ---------------------------------------------------------------------------
// Fallback: original chase-nearest-hostile (no PetState)
// ---------------------------------------------------------------------------

function chaseNearestHostile(world, id, fac, pos) {
  let bestTarget = 0;
  let bestDist = Infinity;
  let bestPos = null;

  forEachInRadius(world, pos.x, pos.y, ACTIVE_RADIUS, (eid, epos) => {
    if (eid === id) return;
    const eFac = world.get(eid, Faction);
    if (!eFac || !areFactionsHostile(fac.key, eFac.key)) return;
    const eVit = world.get(eid, Vitality);
    if (!eVit || (eVit.hp | 0) <= 0) return;
    const dist = Math.abs((epos.x | 0) - (pos.x | 0)) + Math.abs((epos.y | 0) - (pos.y | 0));
    if (dist < bestDist) {
      bestTarget = eid;
      bestDist = dist;
      bestPos = { x: epos.x | 0, y: epos.y | 0 };
    }
  });

  if (!bestTarget || !bestPos) return;

  const dx = bestPos.x - (pos.x | 0);
  const dy = bestPos.y - (pos.y | 0);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let mx = 0, my = 0;
  if (ax >= ay) { mx = Math.sign(dx); } else { my = Math.sign(dy); }
  if ((mx | my) !== 0) {
    try { world.add(id, MoveIntent, { dx: mx, dy: my }); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Movement helper (no pet-specific lava avoidance)
// ---------------------------------------------------------------------------

function moveTowardSimple(world, id, targetX, targetY) {
  const pos = world.get(id, Position);
  if (!pos) return;
  const dx = targetX - pos.x;
  const dy = targetY - pos.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let mx = 0, my = 0;
  if (ax >= ay) mx = Math.sign(dx);
  else my = Math.sign(dy);
  if ((mx | my) === 0) return;
  if (!world.has(id, MoveIntent)) {
    try { world.add(id, MoveIntent, { dx: mx, dy: my }); } catch {}
  }
}
