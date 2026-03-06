// src/rules/systems/petBehaviorSystem.js
// State-aware pet AI system - replaces petFollowSystem

import { Position } from '../components/Position.js';
import { Pet } from '../components/Pet.js';
import { PetState } from '../components/PetState.js';
import { Player } from '../components/Player.js';
import { Inventory } from '../components/Inventory.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { inventoryContains, inventoryItems, removeFromInventory } from '../utils/inventoryFacade.js';
import { Consumable } from '../components/Consumable.js';
import { FoodDecay } from '../components/FoodDecay.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { MoveIntent } from '../components/Intents/MoveIntent.js';
import { PickupIntent } from '../components/Intents/PickupIntent.js';
import { MeleeAttackIntent } from '../components/Intents/MeleeAttackIntent.js';
import { Vitality } from '../components/Vitality.js';
import { Faction } from '../components/Faction.js';
import { findNearestValidTileAround } from '../utils/queries.js';
import { areFactionsHostile } from '../utils/factionHostility.js';
import { getItemsAt } from '../utils/tileQueryCache.js';
import { worldRand } from '../utils/rng.js';
import { getDecayStage } from '../data/food.js';
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";
import { computeFOV } from "../../shared/math/fov.js";
import { dealDamage } from "../utils/dealDamage.js";
import { FOLLOW_DISTANCE, TELEPORT_DISTANCE, GUARD_RADIUS, FLEE_THRESHOLD } from './petConstants.js';

const PET_CORPSE_HEAL_THRESHOLD = 0.75;
const FAMILIAR_FIRE_RANGE = 8;
const FAMILIAR_FIRE_COOLDOWN = 10;
const FAMILIAR_FIRE_DMG = 4;
const CORPSE_HEAL_NUTRITION_DIVISOR = 120;
const FELINE_TOXIC_IMMUNITY = 0.85;
const FLEE_CORPSE_SEARCH_RADIUS = 8;
const FLEE_CORPSE_THREAT_RADIUS = 2;

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

  const consumedCorpseIds = new Set();

  for (const [id, _pet, pos, vit] of world.query(Pet, Position, Vitality)) {
    if (!vit || vit.hp <= 0) continue;

    if (tryMunchCorpseUnderfoot(world, id, pos, vit, consumedCorpseIds)) {
      continue;
    }

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

    // Tick down ranged cooldown and attempt familiar fire bolt
    if (petState.rangedCooldown > 0) {
      petState.rangedCooldown -= 1;
      if (petState.rangedCooldown <= 0 && isFamiliar(world, id)) {
        try { world.emit?.('familiar:ready', { id }); } catch { /* */ }
      }
    }
    if (petState.rangedCooldown <= 0 && isFamiliar(world, id)) {
      if (tryFamiliarFireBolt(world, id, pos, petState)) {
        continue; // used turn on ranged attack
      }
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

function tryMunchCorpseUnderfoot(world, petId, petPos, vit, consumedCorpseIds) {
  if (!vit || (vit.maxHp | 0) <= 0) return false;
  if ((vit.hp / vit.maxHp) >= PET_CORPSE_HEAL_THRESHOLD) return false;

  const itemIds = getItemsAt(world, petPos.x, petPos.y);
  if (!itemIds || itemIds.length <= 0) return false;

  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i] | 0;
    if (!(itemId > 0)) continue;
    if (consumedCorpseIds.has(itemId)) continue;
    if (!isCorpseItemOnFloor(world, itemId)) continue;

    consumedCorpseIds.add(itemId);
    consumeCorpseForPet(world, petId, itemId, vit);
    return true;
  }

  return false;
}

function isCorpseItemOnFloor(world, itemId) {
  if (!(itemId > 0) || !world.isAlive(itemId)) return false;
  if (!world.has(itemId, Position)) return false;

  const info = world.get(itemId, ItemInfo);
  if (!info || String(info.type || '').toLowerCase() !== 'food') return false;

  const ident = String(world.get(itemId, NamedIdentity)?.identity || '').toLowerCase();
  if (!ident.startsWith('corpse_')) return false;
  return true;
}

function consumeCorpseForPet(world, petId, corpseId, vit) {
  const cons = world.get(corpseId, Consumable);
  const baseNutrition = Math.max(0, Number(cons?.effectParams?.nutrition || 0));
  const biteNutrition = Math.max(1, Math.ceil(baseNutrition / 2));
  const decay = world.get(corpseId, FoodDecay);
  const decayInfo = decay ? getDecayStage(decay.turnsHeld, decay.shelfLife) : null;
  const nutrition = decayInfo ? Math.floor(biteNutrition * decayInfo.nutritionMult) : biteNutrition;

  const missing = Math.max(0, (vit.maxHp | 0) - (vit.hp | 0));
  const healBase = Math.max(1, Math.floor(Math.max(0, nutrition) / CORPSE_HEAL_NUTRITION_DIVISOR));
  const healAmount = Math.min(missing, healBase);

  if (healAmount > 0) {
    vit.hp = Math.min(vit.maxHp, vit.hp + healAmount);
    try { world.emit?.('healed', { id: petId, amount: healAmount }); } catch {}
  }

  const feline = isFelinePet(world, petId);
  const toxinApplied = maybeApplyDecayToxin(world, petId, corpseId, decayInfo, feline);
  const toxinResisted = !toxinApplied && feline && Number(decayInfo?.sicknessChance || 0) > 0;

  const corpseIdent = world.get(corpseId, NamedIdentity);
  const corpseIdentity = String(corpseIdent?.identity || '');
  const corpseNameBefore = String(corpseIdent?.name || 'corpse');
  const remainingNutrition = Math.max(0, baseNutrition - biteNutrition);
  const partial = remainingNutrition > 0;
  if (cons && cons.effectParams && typeof cons.effectParams === 'object') {
    cons.effectParams.nutrition = remainingNutrition;
  }
  if (partial && corpseIdent && !/^half-eaten\s+/i.test(corpseNameBefore)) {
    corpseIdent.name = `Half-eaten ${corpseNameBefore}`;
  }
  const corpseNameAfter = String(world.get(corpseId, NamedIdentity)?.name || corpseNameBefore);
  if (!partial) {
    try { world.destroy(corpseId); } catch {}
  }
  try {
    world.emit?.('pet:corpse-munch', {
      petId,
      corpseId,
      corpseName: corpseNameAfter,
      corpseIdentity,
      heal: healAmount,
      nutrition: Number.isFinite(nutrition) ? nutrition : 0,
      remainingNutrition,
      partial,
      decayStage: String(decayInfo?.stage || 'fresh'),
      resistedToxin: toxinResisted,
    });
  } catch (e) { console.debug('[petBehaviorSystem] emit pet:corpse-munch failed:', e); }
}

function maybeApplyDecayToxin(world, petId, corpseId, decayInfo, feline) {
  const baseChance = Number(decayInfo?.sicknessChance || 0);
  if (!(baseChance > 0)) return false;

  const finalChance = feline ? (baseChance * (1 - FELINE_TOXIC_IMMUNITY)) : baseChance;
  if (!(finalChance > 0)) return false;

  const roll = worldRand(world);
  if (!(roll < finalChance)) return false;

  addActiveEffect(world, petId, {
    key: 'disease',
    turnsLeft: 15,
    potency: 1,
    stacks: 1,
    sourceId: corpseId,
  });
  try { world.emit?.('hunger:sickened', { actor: petId, type: 'decay' }); } catch {}
  return true;
}

function addActiveEffect(world, entityId, effect) {
  if (!(entityId > 0) || !effect || typeof effect !== 'object') return;
  let ae = world.get(entityId, ActiveEffects);
  if (!ae) {
    try {
      world.add(entityId, ActiveEffects, { effects: [{ ...effect }] });
      return;
    } catch {}
    ae = world.get(entityId, ActiveEffects);
    if (!ae) return;
  }
  if (!Array.isArray(ae.effects)) ae.effects = [];
  ae.effects.push({ stacks: 1, ...effect });
}

function isFamiliar(world, petId) {
  const ni = world.get(petId, NamedIdentity);
  return String(ni?.identity || '').toLowerCase() === 'familiar';
}

/**
 * Familiar fire bolt: find nearest enemy in LOS within range and shoot a fire bolt.
 * Returns true if a bolt was fired (consuming the pet's turn).
 */
function tryFamiliarFireBolt(world, petId, petPos, petState) {
  const petFaction = String(world.get(petId, Faction)?.key || 'pet');

  // Build visible set using shadowcasting — same algorithm as player FOV
  const isBlocked = blockedCallback(buildBlocksVisionMap(world));
  const visible = computeFOV(petPos.x | 0, petPos.y | 0, FAMILIAR_FIRE_RANGE, isBlocked);

  let bestId = 0;
  let bestDist = Infinity;
  for (const [eid, fac, epos, evit] of world.query(Faction, Position, Vitality)) {
    if (!evit || (evit.hp | 0) <= 0) continue;
    if (!areFactionsHostile(petFaction, fac?.key)) continue;
    const dx = (epos.x | 0) - (petPos.x | 0);
    const dy = (epos.y | 0) - (petPos.y | 0);
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist < 1 || dist > FAMILIAR_FIRE_RANGE) continue;
    if (dist < bestDist && visible.has(`${epos.x | 0},${epos.y | 0}`)) {
      bestId = eid;
      bestDist = dist;
    }
  }

  if (!bestId) return false;

  // Capture target position before damage (target may die)
  const targetPos = world.get(bestId, Position);
  const toX = targetPos?.x ?? 0;
  const toY = targetPos?.y ?? 0;

  // Fire the bolt
  dealDamage(world, {
    target: bestId,
    amount: FAMILIAR_FIRE_DMG,
    source: petId,
    type: 'fire',
    cause: 'familiar:fire_bolt',
  });
  petState.rangedCooldown = FAMILIAR_FIRE_COOLDOWN;

  // Emit dedicated fireball VFX event with pre-resolved positions (not ranged:shot)
  try {
    world.emit?.('familiar:fireball', {
      from: { x: petPos.x, y: petPos.y },
      to: { x: toX, y: toY },
    });
  } catch (e) { console.debug('[petBehaviorSystem] emit familiar:fireball failed:', e); }

  // Tell display to suppress familiar ambient particles during cooldown
  try {
    world.emit?.('familiar:fired', { id: petId });
  } catch { /* */ }

  return true;
}

function isFelinePet(world, petId) {
  const ni = world.get(petId, NamedIdentity);
  const identity = String(ni?.identity || '').toLowerCase();
  const name = String(ni?.name || '').toLowerCase();
  return (
    identity.includes('cat')
    || identity.includes('kitty')
    || identity.includes('feline')
    || name.includes('cat')
    || name.includes('kitty')
    || name.includes('feline')
  );
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
    if (petState.targetItemId > 0 && inventoryContains(world, petId, petState.targetItemId)) {
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

function findSafeCorpseForFleeing(world, petId, petPos, playerPos) {
  const petFaction = String(world.get(petId, Faction)?.key || 'pet');
  let best = null;
  let bestScore = Infinity;

  for (const [itemId, itemPos, info] of world.query(Position, ItemInfo)) {
    if (!info || String(info.type || '').toLowerCase() !== 'food') continue;
    if (!isCorpseItemOnFloor(world, itemId)) continue;

    const distFromPet = Math.abs((itemPos.x | 0) - (petPos.x | 0)) + Math.abs((itemPos.y | 0) - (petPos.y | 0));
    if (distFromPet > FLEE_CORPSE_SEARCH_RADIUS) continue;

    if (countHostilesNearTile(world, itemPos.x | 0, itemPos.y | 0, petFaction) > 0) continue;

    const distFromPlayer = Math.abs((itemPos.x | 0) - (playerPos.x | 0)) + Math.abs((itemPos.y | 0) - (playerPos.y | 0));
    const score = distFromPet + distFromPlayer;
    if (score < bestScore) {
      bestScore = score;
      best = { x: itemPos.x | 0, y: itemPos.y | 0 };
    }
  }

  return best;
}

function countHostilesNearTile(world, x, y, petFaction) {
  let threats = 0;
  for (const [, fac, pos, vit] of world.query(Faction, Position, Vitality)) {
    if (!vit || (vit.hp | 0) <= 0) continue;
    if (!areFactionsHostile(petFaction, fac?.key)) continue;

    const dist = Math.max(Math.abs((pos.x | 0) - x), Math.abs((pos.y | 0) - y));
    if (dist <= FLEE_CORPSE_THREAT_RADIUS) threats += 1;
    if (threats > 0) return threats;
  }
  return threats;
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
 * Fleeing behavior: attempt to recover by reaching a safe nearby corpse.
 * If no safe corpse exists, retreat toward player.
 */
function behaviorFleeing(world, petId, petPos, playerPos) {
  const corpseTarget = findSafeCorpseForFleeing(world, petId, petPos, playerPos);
  if (corpseTarget) {
    moveToward(world, petId, corpseTarget.x, corpseTarget.y);
    return;
  }

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
  const items = inventoryItems(world, petId);
  if (items.length === 0) return;

  for (const itemId of items) {
    const itemName = world.get(itemId, NamedIdentity)?.name ||
                     world.get(itemId, ItemInfo)?.description || 'item';
    removeFromInventory(world, petId, itemId);
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
}
