// src/rules/systems/petBehaviorSystem.js
// State-aware pet AI system - replaces petFollowSystem

import { Position } from '../components/Position.js';
import { Pet } from '../components/Pet.js';
import { PetState } from '../components/PetState.js';
import { Player } from '../components/Player.js';
import { Inventory } from '../components/Inventory.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { MoveIntent } from '../components/Intents/MoveIntent.js';
import { PickupIntent } from '../components/Intents/PickupIntent.js';
import { MeleeAttackIntent } from '../components/Intents/MeleeAttackIntent.js';
import { Vitality } from '../components/Vitality.js';
import { Faction } from '../components/Faction.js';
import { findNearestValidTileAround } from '../utils/queries.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { FOLLOW_DISTANCE, TELEPORT_DISTANCE, GUARD_RADIUS, FLEE_THRESHOLD } from './petConstants.js';

/**
 * petBehaviorSystem - state-aware pet AI
 * Replaces petFollowSystem with comprehensive state machine behavior
 */
export function petBehaviorSystem(world) {
  // Find player
  let playerId = 0;
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerId = id;
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  for (const [id, _pet, pos, vit] of world.query(Pet, Position, Vitality)) {
    if (!vit || vit.hp <= 0) continue;
    // Get or create PetState
    let petState = world.get(id, PetState);
    if (!petState) {
      world.add(id, PetState, {
        state: 'following',
        targetX: null,
        targetY: null,
        targetItemId: 0,
        stateEnteredTurn: world.step,
        lastPlayerX: playerPos.x,
        lastPlayerY: playerPos.y,
        commandCooldown: 0,
      });
      petState = world.get(id, PetState);
    }

    // Tick down command cooldown
    if (petState.commandCooldown > 0) {
      petState.commandCooldown -= 1;
    }

    // Check for automatic state transitions
    checkAutoTransitions(world, id, petState, pos, playerPos);

    // Execute behavior based on current state
    switch (petState.state) {
      case 'following':
        behaviorFollowing(world, id, pos, playerPos, playerId);
        break;

      case 'fetching':
        behaviorFetching(world, id, petState, pos, playerPos);
        break;

      case 'returning':
        behaviorReturning(world, id, petState, pos, playerPos, playerId);
        break;

      case 'guarding':
        behaviorGuarding(world, id, petState, pos, playerPos);
        break;

      case 'staying':
        behaviorStaying(world, id, petState, pos, playerPos);
        break;

      case 'fleeing':
        behaviorFleeing(world, id, pos, playerPos);
        break;

      case 'idle':
        // Do nothing
        break;
    }
  }
}

/**
 * Check for automatic state transitions based on conditions
 */
function checkAutoTransitions(world, petId, petState, petPos, playerPos) {
  // Flee if low health (overrides all other states except fleeing)
  if (petState.state !== 'fleeing') {
    const vit = world.get(petId, Vitality);
    if (vit && vit.hp > 0 && (vit.hp / vit.maxHp) < FLEE_THRESHOLD) {
      petState.state = 'fleeing';
      petState.stateEnteredTurn = world.step;
      petState.targetX = null;
      petState.targetY = null;
      petState.targetItemId = 0;
      try { world.emit?.('pet:state:auto', { petId, newState: 'fleeing', reason: 'low_health' }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:state:auto failed:', e); }
      return;
    }
  }

  // Return to following if health restored while fleeing
  if (petState.state === 'fleeing') {
    const vit = world.get(petId, Vitality);
    if (vit && (vit.hp / vit.maxHp) >= FLEE_THRESHOLD + 0.1) { // +0.1 for hysteresis
      petState.state = 'following';
      petState.stateEnteredTurn = world.step;
      try { world.emit?.('pet:state:auto', { petId, newState: 'following', reason: 'health_restored' }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:state:auto failed:', e); }
      return;
    }
  }

  // Teleport if too far from player (except when staying/guarding)
  // Pets that are commanded to stay or guard should remain at their post
  const shouldTeleport = petState.state !== 'staying' && petState.state !== 'guarding';

  if (shouldTeleport) {
    const dx = playerPos.x - petPos.x;
    const dy = playerPos.y - petPos.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist > TELEPORT_DISTANCE) {
      const teleportTile = findNearestValidTileAround(world, playerPos, {
        maxDistance: 1,
        exclude: [{ x: playerPos.x, y: playerPos.y }],
      });
      if (teleportTile) {
        world.set(petId, Position, teleportTile);
        try { world.emit?.('pet:teleported', { petId, from: petPos, to: teleportTile }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:teleported failed:', e); }
      }
      return;
    }
  }

  // Auto-transition from fetching to returning when item is picked up
  if (petState.state === 'fetching') {
    const inv = world.get(petId, Inventory);
    if (inv && inv.items.length > 0 && inv.items.includes(petState.targetItemId)) {
      petState.state = 'returning';
      petState.stateEnteredTurn = world.step;
      petState.targetX = null;
      petState.targetY = null;
      try { world.emit?.('pet:state:auto', { petId, newState: 'returning', reason: 'item_picked_up' }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:state:auto failed:', e); }
      return;
    }

    // Cancel fetch if target item no longer exists or moved
    if (petState.targetItemId > 0) {
      if (!world.isAlive(petState.targetItemId) || !world.has(petState.targetItemId, Position)) {
        petState.state = 'following';
        petState.targetItemId = 0;
        petState.targetX = null;
        petState.targetY = null;
        petState.stateEnteredTurn = world.step;
        try { world.emit?.('pet:state:auto', { petId, newState: 'following', reason: 'fetch_target_lost' }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:state:auto failed:', e); }
        return;
      }
    }
  }
}

/**
 * Following behavior: standard pet follow logic
 */
function behaviorFollowing(world, petId, petPos, playerPos, playerId) {
  const dx = playerPos.x - petPos.x;
  const dy = playerPos.y - petPos.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  // When adjacent, drop carried items at player's feet
  if (dist <= 1) {
    deliverItemsToPlayer(world, petId, playerId, playerPos);
  }

  // Already close enough - stay put
  if (dist <= FOLLOW_DISTANCE) return;

  // Move one step toward player
  moveToward(world, petId, playerPos.x, playerPos.y);
}

/**
 * Fetching behavior: move to item and pick it up
 */
function behaviorFetching(world, petId, petState, petPos, playerPos) {
  // Update target position if item moved
  if (petState.targetItemId > 0) {
    const itemPos = world.get(petState.targetItemId, Position);
    if (itemPos) {
      petState.targetX = itemPos.x;
      petState.targetY = itemPos.y;
    }
  }

  if (petState.targetX === null || petState.targetY === null) {
    // No target - return to following
    petState.state = 'following';
    petState.stateEnteredTurn = world.step;
    return;
  }

  const dx = petState.targetX - petPos.x;
  const dy = petState.targetY - petPos.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  // At target - try to pick up
  if (dist === 0) {
    if (petState.targetItemId > 0 && world.isAlive(petState.targetItemId)) {
      if (!world.has(petId, PickupIntent)) {
        try {
          world.add(petId, PickupIntent, { targetId: petState.targetItemId, count: null });
        } catch {} // ECS: may already exist
      }
    }
    return;
  }

  // Move toward target
  moveToward(world, petId, petState.targetX, petState.targetY);
}

/**
 * Returning behavior: return to player with fetched item
 */
function behaviorReturning(world, petId, petState, petPos, playerPos, playerId) {
  const dx = playerPos.x - petPos.x;
  const dy = playerPos.y - petPos.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  // Adjacent to player - deliver items
  if (dist <= 1) {
    deliverItemsToPlayer(world, petId, playerId, playerPos);

    // After delivery, return to following
    petState.state = 'following';
    petState.targetItemId = 0;
    petState.stateEnteredTurn = world.step;
    try { world.emit?.('pet:state:auto', { petId, newState: 'following', reason: 'delivery_complete' }); } catch (e) { console.debug('[petBehaviorSystem] emit pet:state:auto failed:', e); }
    return;
  }

  // Move toward player
  moveToward(world, petId, playerPos.x, playerPos.y);
}

/**
 * Guarding behavior: stay near guard position, attack nearby enemies
 */
function behaviorGuarding(world, petId, petState, petPos, playerPos) {
  if (petState.targetX === null || petState.targetY === null) {
    // No guard position - return to following
    petState.state = 'following';
    petState.stateEnteredTurn = world.step;
    return;
  }

  const dx = petState.targetX - petPos.x;
  const dy = petState.targetY - petPos.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  // Too far from guard position - return
  if (dist > 1) {
    moveToward(world, petId, petState.targetX, petState.targetY);
    return;
  }

  // At guard position - look for enemies
  let closestEnemy = null;
  let closestDist = GUARD_RADIUS + 1;
  const petFaction = world.get(petId, Faction)?.key || "";

  for (const [enemyId, fac, enemyPos] of world.query(Faction, Position)) {
    if (!areFactionsHostile(petFaction, fac?.key)) continue;

    const edx = enemyPos.x - petPos.x;
    const edy = enemyPos.y - petPos.y;
    const edist = Math.abs(edx) + Math.abs(edy);

    if (edist <= GUARD_RADIUS && edist < closestDist) {
      closestEnemy = enemyId;
      closestDist = edist;
    }
  }

  // Attack closest enemy if adjacent
  if (closestEnemy && closestDist === 1) {
    if (!world.has(petId, MeleeAttackIntent)) {
      try {
        world.add(petId, MeleeAttackIntent, {
          sourceId: petId,
          targetId: closestEnemy
        });
      } catch {} // ECS: may already exist
    }
  } else if (closestEnemy && closestDist > 1) {
    // Chase enemy if within guard radius
    const enemyPos = world.get(closestEnemy, Position);
    if (enemyPos) {
      moveToward(world, petId, enemyPos.x, enemyPos.y);
    }
  }
}

/**
 * Staying behavior: stay at commanded position
 */
function behaviorStaying(world, petId, petState, petPos, playerPos) {
  // Just hold position - no movement
  // Pet will remain here until commanded otherwise
}

/**
 * Fleeing behavior: move away from danger (toward player)
 */
function behaviorFleeing(world, petId, petPos, playerPos) {
  const dx = playerPos.x - petPos.x;
  const dy = playerPos.y - petPos.y;
  const dist = Math.abs(dx) + Math.abs(dy);

  // Already adjacent - stop fleeing
  if (dist <= 1) return;

  // Move toward player (safety)
  moveToward(world, petId, playerPos.x, playerPos.y);
}

/**
 * Helper: move one step toward target
 */
function moveToward(world, petId, targetX, targetY) {
  const pos = world.get(petId, Position);
  if (!pos) return;

  const dx = targetX - pos.x;
  const dy = targetY - pos.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);

  let mx = 0, my = 0;
  if (ax >= ay) { mx = Math.sign(dx); } else { my = Math.sign(dy); }

  if ((mx | my) === 0) return;

  if (!world.has(petId, MoveIntent)) {
    try { world.add(petId, MoveIntent, { dx: mx, dy: my }); } catch {} // ECS: may already exist
  }
}

/**
 * Helper: deliver items from pet inventory to player position
 */
function deliverItemsToPlayer(world, petId, playerId, playerPos) {
  const petInv = world.get(petId, Inventory);
  if (!petInv || petInv.items.length === 0) return;

  for (const itemId of petInv.items) {
    const itemName = world.get(itemId, NamedIdentity)?.name ||
                     world.get(itemId, ItemInfo)?.description || 'item';
    try {
      world.add(itemId, Position, { x: playerPos.x, y: playerPos.y });
    } catch {} // ECS: may already exist
    try {
      world.emit?.('pet:deliver', {
        petId,
        actor: playerId,
        itemId,
        itemName
      });
    } catch (e) { console.debug('[petBehaviorSystem] emit pet:deliver failed:', e); }
  }
  petInv.items.length = 0;
}
