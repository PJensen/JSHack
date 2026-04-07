// src/rules/systems/petBehaviorSystem.js
// State-aware pet AI system - replaces petFollowSystem

import { Position } from "../components/Position.js";
import { Pet } from "../components/Pet.js";
import { PetState } from "../components/PetState.js";
import { Player } from "../components/Player.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import {
  inventoryContains,
  inventoryItems,
  removeFromInventory,
} from "../utils/inventoryFacade.js";
import { Consumable } from "../components/Consumable.js";
import { FoodDecay } from "../components/FoodDecay.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { PickupIntent } from "../components/Intents/PickupIntent.js";
import { Vitality } from "../components/Vitality.js";
import { Faction } from "../components/Faction.js";
import { findNearestValidTileAround, playerEntity, queryFactionActors } from "../utils/queries.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import { getItemsAt } from "../utils/tileQueryCache.js";
import { worldRand } from "../utils/rng.js";
import { getDecayStage } from "../data/food.js";
import { blockedCallback, buildBlocksVisionMap } from "../utils/vision.js";
import { computeFOV } from "../../shared/math/fov.js";
import { dealDamage } from "../utils/dealDamage.js";
import {
  getTile,
  isLoaded,
  isWalkable,
} from "../environment/dungeon/tileMap.js";
import { TILE_LAVA } from "../environment/dungeon/constants.js";
import {
  FLEE_THRESHOLD,
  FOLLOW_DISTANCE,
  GUARD_RADIUS,
  TELEPORT_DISTANCE,
} from "./petConstants.js";
import { chebyshevScalar, manhattanScalar } from "../utils/distance.js";
import { getMonster } from "../data/monsters.js";
import { SeenCallbackContext } from "../data/callbacks/ai.js";
import { runCallbackList } from "../interaction/dispatch.js";
import { canActThisTurn as speedGateCheck } from "../utils/speedGate.js";

const AGGRESSIVE_RADIUS = 8;
const PET_CORPSE_HEAL_THRESHOLD = 0.75;
const FAMILIAR_FIRE_RANGE = 8;
const FAMILIAR_FIRE_COOLDOWN = 10;
const FAMILIAR_FIRE_DMG = 4;
const FAMILIAR_FIRE_SPEED = 8;
const FAMILIAR_FIRE_MIN_DURATION = 0.1;
const FAMILIAR_FIRE_MAX_DURATION = 0.6;
const CORPSE_HEAL_NUTRITION_DIVISOR = 120;
const FELINE_TOXIC_IMMUNITY = 0.85;
const FLEE_CORPSE_SEARCH_RADIUS = 8;
const FLEE_CORPSE_THREAT_RADIUS = 2;
const FELINE_LAVA_MISSTEP_CHANCE = 0.05;
const PET_ABILITY_SIGHT_RANGE = 8;

const PET_SEEN_KEY = Symbol.for("jshack:pet:seenEnemies");

/** @param {any} world @returns {Map<number, Set<number>>} petId → Set of enemy ids already "first sighted" */
function ensurePetSeenState(world) {
  if (world[PET_SEEN_KEY] instanceof Map) return world[PET_SEEN_KEY];
  const m = new Map();
  world[PET_SEEN_KEY] = m;
  return m;
}

/**
 * Fire whileLOS / onSeen hooks for a pet that has LOS to a hostile target.
 * Returns true if a hook consumed the pet's turn (setHandled).
 */
function tryPetAbilityHooks(world, petId, petPos, targetId, targetPos) {
  if (!speedGateCheck(world, petId)) return false;
  if (world.has(petId, MoveIntent)) return false;

  const ni = world.get(petId, NamedIdentity);
  const def = ni ? getMonster(String(ni.identity || "")) : null;
  if (!def?.hooks) return false;

  const onSeenHooks = def.hooks.onSeen;
  const whileLOSHooks = def.hooks.whileLOS;
  if (!Array.isArray(onSeenHooks) && !Array.isArray(whileLOSHooks)) return false;
  if ((!onSeenHooks || onSeenHooks.length === 0) &&
      (!whileLOSHooks || whileLOSHooks.length === 0)) return false;

  // onSeen: fire once per enemy
  const seenState = ensurePetSeenState(world);
  let seenSet = seenState.get(petId);
  if (!seenSet) { seenSet = new Set(); seenState.set(petId, seenSet); }

  const firstSighting = !seenSet.has(targetId);
  if (firstSighting) seenSet.add(targetId);

  if (firstSighting && Array.isArray(onSeenHooks) && onSeenHooks.length > 0) {
    const ctx = new SeenCallbackContext(world, {
      actor: petId,
      target: targetId,
      actorPos: { x: petPos.x | 0, y: petPos.y | 0 },
      targetPos: { x: targetPos.x | 0, y: targetPos.y | 0 },
      canActThisTurn: true,
      hasQueuedMove: false,
    });
    runCallbackList(onSeenHooks, ctx);
    if (ctx.handled) return true;
  }

  if (Array.isArray(whileLOSHooks) && whileLOSHooks.length > 0) {
    const ctx = new SeenCallbackContext(world, {
      actor: petId,
      target: targetId,
      actorPos: { x: petPos.x | 0, y: petPos.y | 0 },
      targetPos: { x: targetPos.x | 0, y: targetPos.y | 0 },
      canActThisTurn: true,
      hasQueuedMove: false,
    });
    runCallbackList(whileLOSHooks, ctx);
    if (ctx.handled) return true;
  }

  return false;
}

/**
 * petBehaviorSystem - state-aware pet AI
 * Replaces petFollowSystem with comprehensive state machine behavior
 */
export function petBehaviorSystem(world) {
  // Find player
  const _player = playerEntity(world);
  if (!_player) return;
  const playerId  = _player.id;
  const playerPos = _player.pos;

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
        state: "following",
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
        try {
          world.emit?.("familiar:ready", { id });
        } catch { /* */ }
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
      case "following":
        behaviorFollowing(world, id, pos, playerPos, playerId);
        break;

      case "fetching":
        behaviorFetching(world, id, petState, pos, playerPos);
        break;

      case "returning":
        behaviorReturning(world, id, petState, pos, playerPos, playerId);
        break;

      case "guarding":
        behaviorGuarding(world, id, petState, pos, playerPos);
        break;

      case "aggressive":
        behaviorAggressive(world, id, pos, playerPos, playerId);
        break;

      case "staying":
        behaviorStaying(world, id, petState, pos, playerPos);
        break;

      case "fleeing":
        behaviorFleeing(world, id, pos, playerPos);
        break;

      case "idle":
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
  if (!info || String(info.type || "").toLowerCase() !== "food") return false;

  const ident = String(world.get(itemId, NamedIdentity)?.identity || "")
    .toLowerCase();
  if (!ident.startsWith("corpse_")) return false;
  return true;
}

function consumeCorpseForPet(world, petId, corpseId, vit) {
  const cons = world.get(corpseId, Consumable);
  const baseNutrition = Math.max(0, Number(cons?.effectParams?.nutrition || 0));
  const biteNutrition = Math.max(1, Math.ceil(baseNutrition / 2));
  const decay = world.get(corpseId, FoodDecay);
  const decayInfo = decay
    ? getDecayStage(decay.turnsHeld, decay.shelfLife)
    : null;
  const nutrition = decayInfo
    ? Math.floor(biteNutrition * decayInfo.nutritionMult)
    : biteNutrition;

  const missing = Math.max(0, (vit.maxHp | 0) - (vit.hp | 0));
  const healBase = Math.max(
    1,
    Math.floor(Math.max(0, nutrition) / CORPSE_HEAL_NUTRITION_DIVISOR),
  );
  const healAmount = Math.min(missing, healBase);

  if (healAmount > 0) {
    vit.hp = Math.min(vit.maxHp, vit.hp + healAmount);
    try {
      world.emit?.("healed", { id: petId, amount: healAmount });
    } catch {}
  }

  const feline = isFelinePet(world, petId);
  const toxinApplied = maybeApplyDecayToxin(
    world,
    petId,
    corpseId,
    decayInfo,
    feline,
  );
  const toxinResisted = !toxinApplied && feline &&
    Number(decayInfo?.sicknessChance || 0) > 0;

  const corpseIdent = world.get(corpseId, NamedIdentity);
  const corpseIdentity = String(corpseIdent?.identity || "");
  const corpseNameBefore = String(corpseIdent?.name || "corpse");
  const remainingNutrition = Math.max(0, baseNutrition - biteNutrition);
  const partial = remainingNutrition > 0;
  if (cons && cons.effectParams && typeof cons.effectParams === "object") {
    cons.effectParams.nutrition = remainingNutrition;
  }
  if (partial && corpseIdent && !/^half-eaten\s+/i.test(corpseNameBefore)) {
    corpseIdent.name = `Half-eaten ${corpseNameBefore}`;
  }
  const corpseNameAfter = String(
    world.get(corpseId, NamedIdentity)?.name || corpseNameBefore,
  );
  if (!partial) {
    try {
      world.destroy(corpseId);
    } catch {}
  }
  try {
    world.emit?.("pet:corpse-munch", {
      petId,
      corpseId,
      corpseName: corpseNameAfter,
      corpseIdentity,
      heal: healAmount,
      nutrition: Number.isFinite(nutrition) ? nutrition : 0,
      remainingNutrition,
      partial,
      decayStage: String(decayInfo?.stage || "fresh"),
      resistedToxin: toxinResisted,
    });
  } catch (e) {
    console.debug("[petBehaviorSystem] emit pet:corpse-munch failed:", e);
  }
}

function maybeApplyDecayToxin(world, petId, corpseId, decayInfo, feline) {
  const baseChance = Number(decayInfo?.sicknessChance || 0);
  if (!(baseChance > 0)) return false;

  const finalChance = feline
    ? (baseChance * (1 - FELINE_TOXIC_IMMUNITY))
    : baseChance;
  if (!(finalChance > 0)) return false;

  const roll = worldRand(world);
  if (!(roll < finalChance)) return false;

  addActiveEffect(world, petId, {
    key: "disease",
    turnsLeft: 15,
    potency: 1,
    stacks: 1,
    sourceId: corpseId,
  });
  try {
    world.emit?.("hunger:sickened", { actor: petId, type: "decay" });
  } catch {}
  return true;
}

function addActiveEffect(world, entityId, effect) {
  if (!(entityId > 0) || !effect || typeof effect !== "object") return;
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
  return String(ni?.identity || "").toLowerCase() === "familiar";
}

function computeProjectileDelay(from, to, speed, minDuration, maxDuration) {
  const dx = Number(to?.x || 0) - Number(from?.x || 0);
  const dy = Number(to?.y || 0) - Number(from?.y || 0);
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0) || !(speed > 0)) return Number(minDuration) || 0;
  const raw = dist / speed;
  return Math.max(
    Number(minDuration) || 0,
    Math.min(Number(maxDuration) || raw, raw),
  );
}

/**
 * Familiar fire bolt: find nearest enemy in LOS within range and shoot a fire bolt.
 * Returns true if a bolt was fired (consuming the pet's turn).
 */
function tryFamiliarFireBolt(world, petId, petPos, petState) {
  const petFaction = String(world.get(petId, Faction)?.key || "pet");

  // Build visible set using shadowcasting — same algorithm as player FOV
  const isBlocked = blockedCallback(buildBlocksVisionMap(world));
  const visible = computeFOV(
    petPos.x | 0,
    petPos.y | 0,
    FAMILIAR_FIRE_RANGE,
    isBlocked,
  );

  let bestId = 0;
  let bestDist = Infinity;
  for (const [eid, fac, epos, evit] of queryFactionActors(world)) {
    if (!evit || (evit.hp | 0) <= 0) continue;
    if (!areFactionsHostile(petFaction, fac?.key)) continue;
    const dist = chebyshevScalar(epos.x, epos.y, petPos.x, petPos.y);
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
    type: "fire",
    cause: "familiar:fire_bolt",
    projectileDelay: computeProjectileDelay(
      petPos,
      { x: toX, y: toY },
      FAMILIAR_FIRE_SPEED,
      FAMILIAR_FIRE_MIN_DURATION,
      FAMILIAR_FIRE_MAX_DURATION,
    ),
  });
  petState.rangedCooldown = FAMILIAR_FIRE_COOLDOWN;

  // Emit dedicated fireball VFX event with pre-resolved positions (not ranged:shot)
  try {
    world.emit?.("familiar:fireball", {
      from: { x: petPos.x, y: petPos.y },
      to: { x: toX, y: toY },
    });
  } catch (e) {
    console.debug("[petBehaviorSystem] emit familiar:fireball failed:", e);
  }

  // Tell display to suppress familiar ambient particles during cooldown
  try {
    world.emit?.("familiar:fired", { id: petId });
  } catch { /* */ }

  return true;
}

function isFelinePet(world, petId) {
  const ni = world.get(petId, NamedIdentity);
  const identity = String(ni?.identity || "").toLowerCase();
  const name = String(ni?.name || "").toLowerCase();
  return (
    identity.includes("cat") ||
    identity.includes("kitty") ||
    identity.includes("feline") ||
    name.includes("cat") ||
    name.includes("kitty") ||
    name.includes("feline")
  );
}

/**
 * Check for automatic state transitions based on conditions
 */
function checkAutoTransitions(world, petId, petState, petPos, playerPos) {
  // Flee if low health (overrides all other states except fleeing)
  if (petState.state !== "fleeing") {
    const vit = world.get(petId, Vitality);
    if (vit && vit.hp > 0 && (vit.hp / vit.maxHp) < FLEE_THRESHOLD) {
      petState.state = "fleeing";
      petState.stateEnteredTurn = world.step;
      petState.targetX = null;
      petState.targetY = null;
      petState.targetItemId = 0;
      try {
        world.emit?.("pet:state:auto", {
          petId,
          newState: "fleeing",
          reason: "low_health",
        });
      } catch (e) {
        console.debug("[petBehaviorSystem] emit pet:state:auto failed:", e);
      }
      return;
    }
  }

  // Return to following if health restored while fleeing
  if (petState.state === "fleeing") {
    const vit = world.get(petId, Vitality);
    if (vit && (vit.hp / vit.maxHp) >= FLEE_THRESHOLD + 0.1) { // +0.1 for hysteresis
      petState.state = "following";
      petState.stateEnteredTurn = world.step;
      try {
        world.emit?.("pet:state:auto", {
          petId,
          newState: "following",
          reason: "health_restored",
        });
      } catch (e) {
        console.debug("[petBehaviorSystem] emit pet:state:auto failed:", e);
      }
      return;
    }
  }

  // Teleport if too far from player (except when staying/guarding)
  // Pets that are commanded to stay or guard should remain at their post
  const shouldTeleport = petState.state !== "staying" &&
    petState.state !== "guarding";

  if (shouldTeleport) {
    const dist = manhattanScalar(petPos.x, petPos.y, playerPos.x, playerPos.y);
    if (dist > TELEPORT_DISTANCE) {
      const teleportTile = findNearestValidTileAround(world, playerPos, {
        maxDistance: 1,
        exclude: [{ x: playerPos.x, y: playerPos.y }],
      });
      if (teleportTile) {
        world.set(petId, Position, teleportTile);
        try {
          world.emit?.("pet:teleported", {
            petId,
            from: petPos,
            to: teleportTile,
          });
        } catch (e) {
          console.debug("[petBehaviorSystem] emit pet:teleported failed:", e);
        }
      }
      return;
    }
  }

  // Auto-transition from fetching to returning when item is picked up
  if (petState.state === "fetching") {
    if (
      petState.targetItemId > 0 &&
      inventoryContains(world, petId, petState.targetItemId)
    ) {
      petState.state = "returning";
      petState.stateEnteredTurn = world.step;
      petState.targetX = null;
      petState.targetY = null;
      try {
        world.emit?.("pet:state:auto", {
          petId,
          newState: "returning",
          reason: "item_picked_up",
        });
      } catch (e) {
        console.debug("[petBehaviorSystem] emit pet:state:auto failed:", e);
      }
      return;
    }

    // Cancel fetch if target item no longer exists or moved
    if (petState.targetItemId > 0) {
      if (
        !world.isAlive(petState.targetItemId) ||
        !world.has(petState.targetItemId, Position)
      ) {
        petState.state = "following";
        petState.targetItemId = 0;
        petState.targetX = null;
        petState.targetY = null;
        petState.stateEnteredTurn = world.step;
        try {
          world.emit?.("pet:state:auto", {
            petId,
            newState: "following",
            reason: "fetch_target_lost",
          });
        } catch (e) {
          console.debug("[petBehaviorSystem] emit pet:state:auto failed:", e);
        }
        return;
      }
    }
  }
}

function findSafeCorpseForFleeing(world, petId, petPos, playerPos) {
  const petFaction = String(world.get(petId, Faction)?.key || "pet");
  let best = null;
  let bestScore = Infinity;

  for (const [itemId, itemPos, info] of world.query(Position, ItemInfo)) {
    if (!info || String(info.type || "").toLowerCase() !== "food") continue;
    if (!isCorpseItemOnFloor(world, itemId)) continue;

    const distFromPet = manhattanScalar(itemPos.x, itemPos.y, petPos.x, petPos.y);
    if (distFromPet > FLEE_CORPSE_SEARCH_RADIUS) continue;

    if (
      countHostilesNearTile(world, itemPos.x | 0, itemPos.y | 0, petFaction) > 0
    ) continue;

    const distFromPlayer = manhattanScalar(itemPos.x, itemPos.y, playerPos.x, playerPos.y);
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
  for (const [, fac, pos, vit] of queryFactionActors(world)) {
    if (!vit || (vit.hp | 0) <= 0) continue;
    if (!areFactionsHostile(petFaction, fac?.key)) continue;

    const dist = chebyshevScalar(pos.x, pos.y, x, y);
    if (dist <= FLEE_CORPSE_THREAT_RADIUS) threats += 1;
    if (threats > 0) return threats;
  }
  return threats;
}

/**
 * Following behavior: standard pet follow logic
 */
function behaviorFollowing(world, petId, petPos, playerPos, playerId) {
  const dist = manhattanScalar(petPos.x, petPos.y, playerPos.x, playerPos.y);

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
    petState.state = "following";
    petState.stateEnteredTurn = world.step;
    return;
  }

  const dist = manhattanScalar(petPos.x, petPos.y, petState.targetX, petState.targetY);

  // At target - try to pick up
  if (dist === 0) {
    if (petState.targetItemId > 0 && world.isAlive(petState.targetItemId)) {
      if (!world.has(petId, PickupIntent)) {
        try {
          world.add(petId, PickupIntent, {
            targetId: petState.targetItemId,
            count: null,
          });
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
function behaviorReturning(
  world,
  petId,
  petState,
  petPos,
  playerPos,
  playerId,
) {
  const dist = manhattanScalar(petPos.x, petPos.y, playerPos.x, playerPos.y);

  // Adjacent to player - deliver items
  if (dist <= 1) {
    deliverItemsToPlayer(world, petId, playerId, playerPos);

    // After delivery, return to following
    petState.state = "following";
    petState.targetItemId = 0;
    petState.stateEnteredTurn = world.step;
    try {
      world.emit?.("pet:state:auto", {
        petId,
        newState: "following",
        reason: "delivery_complete",
      });
    } catch (e) {
      console.debug("[petBehaviorSystem] emit pet:state:auto failed:", e);
    }
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
    petState.state = "following";
    petState.stateEnteredTurn = world.step;
    return;
  }

  const dist = manhattanScalar(petPos.x, petPos.y, petState.targetX, petState.targetY);

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

    const edist = manhattanScalar(petPos.x, petPos.y, enemyPos.x, enemyPos.y);

    if (edist <= GUARD_RADIUS && edist < closestDist) {
      closestEnemy = enemyId;
      closestDist = edist;
    }
  }

  // Try ability hooks if enemy in LOS (spells, breath, gaze, etc.)
  if (closestEnemy) {
    const enemyPos = world.get(closestEnemy, Position);
    if (enemyPos) {
      const isBlocked = blockedCallback(buildBlocksVisionMap(world));
      const visible = computeFOV(petPos.x | 0, petPos.y | 0, PET_ABILITY_SIGHT_RANGE, isBlocked);
      if (visible.has(`${enemyPos.x | 0},${enemyPos.y | 0}`)) {
        if (tryPetAbilityHooks(world, petId, petPos, closestEnemy, enemyPos)) {
          return; // ability consumed the turn
        }
      }
      moveToward(world, petId, enemyPos.x, enemyPos.y);
    }
  }
}

/**
 * Aggressive behavior: follow player but actively seek and attack nearby enemies.
 * Prioritises attacking over following — only follows when no enemies in range.
 */
function behaviorAggressive(world, petId, petPos, playerPos, playerId) {
  const petFaction = world.get(petId, Faction)?.key || "";

  // Build FOV for ability hook LOS checks
  const isBlocked = blockedCallback(buildBlocksVisionMap(world));
  const visible = computeFOV(
    petPos.x | 0,
    petPos.y | 0,
    PET_ABILITY_SIGHT_RANGE,
    isBlocked,
  );

  // Find nearest hostile within radius
  let closestEnemy = 0;
  let closestDist = AGGRESSIVE_RADIUS + 1;
  let closestHasLOS = false;

  for (const [enemyId, fac, enemyPos, evit] of queryFactionActors(world)) {
    if (!evit || (evit.hp | 0) <= 0) continue;
    if (!areFactionsHostile(petFaction, fac?.key)) continue;

    const edist = manhattanScalar(enemyPos.x, enemyPos.y, petPos.x, petPos.y);

    if (edist < closestDist) {
      closestEnemy = enemyId;
      closestDist = edist;
      closestHasLOS = visible.has(`${enemyPos.x | 0},${enemyPos.y | 0}`);
    }
  }

  // If enemy found with LOS, try ability hooks first (spells, breath, gaze, etc.)
  if (closestEnemy && closestHasLOS) {
    const enemyPos = world.get(closestEnemy, Position);
    if (enemyPos && tryPetAbilityHooks(world, petId, petPos, closestEnemy, enemyPos)) {
      return; // ability consumed the turn
    }
  }

  // If enemy found, move toward it (bump handles melee)
  if (closestEnemy) {
    const enemyPos = world.get(closestEnemy, Position);
    if (enemyPos) {
      moveToward(world, petId, enemyPos.x, enemyPos.y);
      return;
    }
  }

  // No enemy — fall back to following the player
  behaviorFollowing(world, petId, petPos, playerPos, playerId);
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
  const corpseTarget = findSafeCorpseForFleeing(
    world,
    petId,
    petPos,
    playerPos,
  );
  if (corpseTarget) {
    moveToward(world, petId, corpseTarget.x, corpseTarget.y);
    return;
  }

  const dist = manhattanScalar(petPos.x, petPos.y, playerPos.x, playerPos.y);

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
  if (ax >= ay) mx = Math.sign(dx);
  else my = Math.sign(dy);

  const feline = isFelinePet(world, petId);
  if (feline && wouldStepIntoLoadedLava(pos.x, pos.y, mx, my)) {
    const alt = pickNonLavaStep(pos, dx, dy);
    if (alt) {
      mx = alt.dx;
      my = alt.dy;
    } else if (worldRand(world) >= FELINE_LAVA_MISSTEP_CHANCE) {
      return;
    }
  }

  if ((mx | my) === 0) return;

  if (!world.has(petId, MoveIntent)) {
    try {
      world.add(petId, MoveIntent, { dx: mx, dy: my });
    } catch {} // ECS: may already exist
  }
}

function wouldStepIntoLoadedLava(x, y, dx, dy) {
  const nx = (x | 0) + (dx | 0);
  const ny = (y | 0) + (dy | 0);
  if (!isLoaded(nx, ny)) return false;
  return getTile(nx, ny) === TILE_LAVA;
}

function pickNonLavaStep(pos, dx, dy) {
  const candidates = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if ((dy | 0) !== 0) candidates.push({ dx: 0, dy: Math.sign(dy) });
    if ((dx | 0) !== 0) candidates.push({ dx: Math.sign(dx), dy: 0 });
  } else {
    if ((dx | 0) !== 0) candidates.push({ dx: Math.sign(dx), dy: 0 });
    if ((dy | 0) !== 0) candidates.push({ dx: 0, dy: Math.sign(dy) });
  }

  for (let i = 0; i < candidates.length; i++) {
    const step = candidates[i];
    const nx = (pos.x | 0) + step.dx;
    const ny = (pos.y | 0) + step.dy;
    if (isLoaded(nx, ny) && !isWalkable(nx, ny)) continue;
    if (wouldStepIntoLoadedLava(pos.x, pos.y, step.dx, step.dy)) continue;
    return step;
  }

  return null;
}

/**
 * Helper: deliver items from pet inventory to player position
 */
function deliverItemsToPlayer(world, petId, playerId, playerPos) {
  const items = inventoryItems(world, petId);
  if (items.length === 0) return;

  for (const itemId of items) {
    const itemName = world.get(itemId, NamedIdentity)?.name ||
      world.get(itemId, ItemInfo)?.description || "item";
    removeFromInventory(world, petId, itemId);
    try {
      world.add(itemId, Position, { x: playerPos.x, y: playerPos.y });
    } catch {} // ECS: may already exist
    try {
      world.emit?.("pet:deliver", {
        petId,
        actor: playerId,
        itemId,
        itemName,
      });
    } catch (e) {
      console.debug("[petBehaviorSystem] emit pet:deliver failed:", e);
    }
  }
}
