// src/rules/content/interaction/interactPayloads.js
//
// All interactable hook payloads, keyed by Interactable.action string.
//
// Each payload may define:
//   beforeInteract(ctx)  — gates and pre-checks; call ctx.cancel() to abort
//   onInteract(ctx)      — main interaction logic
//   afterInteract(ctx)   — cleanup, state changes, and event emission
//
// ctx shape: see interactRunner.js
//
// This file is the single authoritative registry of what every interactable
// thing in the world does. Adding a new interaction = adding a new key here.

import { DoorState } from "../../components/DoorState.js";
import { Collider } from "../../components/Collider.js";
import { Inventory } from "../../components/Inventory.js";
import {
  addToInventory,
  consumeFromStack,
  getStackCount,
  hasCapacity,
  inventoryContains,
  inventoryItems,
  placeOnGround,
  removeFromInventory,
} from "../../utils/inventoryFacade.js";
import { Vitality } from "../../components/Vitality.js";
import { Mana } from "../../components/Mana.js";
import { Stamina } from "../../components/Stamina.js";
import { ShopInventory } from "../../components/ShopInventory.js";
import { HarvestNode } from "../../components/HarvestNode.js";
import { GrowthStage } from "../../components/GrowthStage.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Equipment, GEAR_SLOTS } from "../../components/Equipment.js";
import { Position } from "../../components/Position.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { Beatitude } from "../../components/Beatitude.js";
import { Owner } from "../../components/Owner.js";
import { Interactable } from "../../components/Interactable.js";
import { ObjectState } from "../../components/ObjectState.js";
import { DungeonState } from "../../components/DungeonState.js";
import { Tombstone as TombstoneComponent } from "../../components/Tombstone.js";
import { createFrom } from "../../../lib/ecs-js/archetype.js";
import {
  Carrot,
  CoalOre,
  Corn,
  DungeonMushrooms,
  EmberRoot,
  IronOre,
  Moonleaf,
  StoneChip,
  ThornPods,
  VenomFronds,
  Wheat,
  WildBerries,
  WildHerbs,
} from "../../archetypes/Food.js";
import { LumberBundle } from "../../archetypes/TownGoods.js";
import { Monster } from "../../archetypes/Creatures.js";
import { equipMonster } from "../../environment/dungeon/populate.js";
import { combatSeed, mulberry32 } from "../../utils/rng.js";
import { createRng } from "../../../lib/ecs-js/rng.js";
import { resolveLootTable, materializeDrop } from "../../data/lootResolver.js";
import { spawnHazard } from "../../utils/hazardSpawn.js";
import { dealDamage } from "../../utils/dealDamage.js";
import { getCatalogItem } from "../../data/itemCatalog.js";
import { Ashes, GoldStack } from "../../archetypes/Items.js";
import { Encumbrance } from "../../components/Encumbrance.js";
import {
  brewAtAlchemyBench,
  emitAlchemyBenchOpen,
} from "../alchemy/benchGame.js";
import {
  craftAtEnchantingBench,
  emitEnchantingBenchOpen,
} from "../enchanting/benchGame.js";
import { cookAtFire, emitCookingFireOpen } from "../cooking/cookingGame.js";
import { emitAnvilOpen, forgeAtAnvil } from "../smithing/anvilGame.js";
import { createItemById } from "../../utils/itemFactory.js";
import { actorHasDoorKey, setDoorState } from "../../utils/doorAccess.js";
import { effectiveMaxHp, effectiveMaxMana, effectiveMaxStamina } from "../../utils/passiveBonuses.js";
import { buildNoticeBoardPayload } from "../../quests/localGenerator.js";
import { GroundStackOrder } from "../../components/GroundStackOrder.js";
import { HazardArea } from "../../components/HazardArea.js";
import { HydraulicsLink } from "../../components/HydraulicsLink.js";
import { setPortcullisRaised, setLinkedPortcullisState } from "../../utils/hydraulicsUtils.js";
import { emitSafe } from "../../utils/emitSafe.js";
import { isWalkable, forEachLoadedTile, setTile, getTile } from "../../environment/dungeon/tileMap.js";
import { TILE_SHALLOW_WATER, TILE_FLOOR } from "../../environment/dungeon/constants.js";
import { ActiveEffects } from "../../components/ActiveEffects.js";
import { ensureActiveEffects } from "../../utils/effects.js";
import { upsertTimedEffect } from "../../utils/effectSemantics.js";
import { spawnMonsterEntity } from "../../utils/spawnMonsterEntity.js";
import { findNearestValidTileAround } from "../../utils/queries.js";
import { isEntityOnCurrentFloor } from "../../utils/floorEntities.js";
import { SoundEmitter } from "../../components/SoundEmitter.js";
import {
  applyWaterExposure,
} from "../../utils/waterExposure.js";

// Maps catalog item IDs → archetypes for harvest yield entity creation.
const CATALOG_ARCHETYPES = {
  "food_wild_berries": WildBerries,
  "food_wild_herbs": WildHerbs,
  "food_mushrooms": DungeonMushrooms,
  "reagent_thorn_pod": ThornPods,
  "reagent_venom_frond": VenomFronds,
  "reagent_moonleaf": Moonleaf,
  "reagent_ember_root": EmberRoot,
  "ore_iron": IronOre,
  "ore_coal": CoalOre,
  "ore_stone": StoneChip,
  "food_wheat": Wheat,
  "food_carrot": Carrot,
  "food_corn": Corn,
  "material_lumber": LumberBundle,
};

const HARVEST_SEED_SALT = 0x48415256;
const SEED_DROP_SALT = 0x5345ED01;
const HARVEST_BONUS_DROP_SALT = 0x48B0A5D1;

const SEED_ITEM_IDS = Object.freeze({
  wheat: "seed_wheat",
  carrot: "seed_carrot",
  corn: "seed_corn",
});
const HARVEST_BONUS_DROPS = Object.freeze({
  tree: Object.freeze({ itemId: "reagent_resin", chance: 0.65, count: 1 }),
  thorn_bramble: Object.freeze({ itemId: "reagent_resin", chance: 0.55, count: 1 }),
});
const HARVEST_EXHAUSTED_IDENTITY = Object.freeze({
  iron_ore:      "ore_vein_iron_exhausted",
  coal_ore:      "ore_vein_coal_exhausted",
  stone:         "ore_vein_stone_exhausted",
  berries:       "harvest_node_bare",
  herbs:         "harvest_node_bare",
  thorn_bramble: "harvest_node_bare",
  venom_fern:    "harvest_node_bare",
  moonleaf:      "harvest_node_bare",
  ember_root:    "harvest_node_bare",
});
const FOUNTAIN_MIN_CHARGES = 2;
const FOUNTAIN_MAX_CHARGES = 4;
const FOUNTAIN_COOLDOWN_MIN = 201;
const FOUNTAIN_COOLDOWN_MAX = 259;
function deriveFountainCooldownTurns(world, targetId, params) {
  const explicit = Number(params?.cooldownTurns);
  if (Number.isFinite(explicit) && explicit > 0) return explicit | 0;

  const seed =
    ((world.seed >>> 0) ^ (((targetId | 0) * 0xc2b2ae35) >>> 0) ^ 0xF0CD) >>> 0;
  const r = mulberry32(seed);
  const span = FOUNTAIN_COOLDOWN_MAX - FOUNTAIN_COOLDOWN_MIN + 1;
  let turns = FOUNTAIN_COOLDOWN_MIN + Math.floor(r() * span);
  // "200 some odd": enforce odd cooldown length.
  if ((turns & 1) === 0) turns += 1;
  if (turns > FOUNTAIN_COOLDOWN_MAX) turns -= 2;
  return turns;
}

function ensureFountainState(world, targetId) {
  const inter = world.get(targetId, Interactable);
  if (!inter) return null;

  const params = (inter.params && typeof inter.params === "object")
    ? { ...inter.params }
    : {};

  let charges = Number(params.chargesRemaining);
  let maxCharges = Number(params.maxCharges);
  let primaryEffect = String(params.primaryEffect || "");
  let cooldownTurns = Number(params.cooldownTurns);
  let dryUntilStep = Number(params.dryUntilStep);
  let changed = false;

  if (primaryEffect !== "heal" && primaryEffect !== "mana") {
    const modeSeed =
      ((world.seed >>> 0) ^ (((targetId | 0) * 0x85ebca6b) >>> 0) ^ 0xF0AD) >>>
      0;
    primaryEffect = mulberry32(modeSeed)() < 0.5 ? "heal" : "mana";
    changed = true;
  }

  if (!Number.isFinite(charges) || charges < 0) {
    const seed =
      ((world.seed >>> 0) ^ (((targetId | 0) * 0x9e3779b9) >>> 0) ^ 0xF017) >>>
      0;
    const r = mulberry32(seed);
    const span = FOUNTAIN_MAX_CHARGES - FOUNTAIN_MIN_CHARGES + 1;
    charges = FOUNTAIN_MIN_CHARGES + Math.floor(r() * span);
    changed = true;
  }

  if (!Number.isFinite(maxCharges) || maxCharges <= 0) {
    maxCharges = Math.max(1, charges | 0);
    changed = true;
  }
  if (!Number.isFinite(charges) || charges > maxCharges) {
    charges = maxCharges;
    changed = true;
  }

  if (!Number.isFinite(cooldownTurns) || cooldownTurns <= 0) {
    cooldownTurns = deriveFountainCooldownTurns(world, targetId, params);
    changed = true;
  }
  if (!Number.isFinite(dryUntilStep)) {
    dryUntilStep = -1;
    changed = true;
  }

  charges = Math.max(0, charges | 0);
  if (charges !== Number(params.chargesRemaining)) {
    changed = true;
  }

  if (changed) {
    params.chargesRemaining = charges;
    params.maxCharges = maxCharges;
    params.primaryEffect = primaryEffect;
    params.cooldownTurns = cooldownTurns;
    params.dryUntilStep = dryUntilStep;
    world.set(targetId, Interactable, { action: inter.action, params });
  }

  return {
    inter,
    params,
    charges,
    maxCharges,
    primaryEffect,
    cooldownTurns,
    dryUntilStep,
  };
}

const FIERY_WEAPON_AFFIXES = new Set(["flaming", "firestorm1"]);
const GROUND_STACK_SEQ_KEY = Symbol.for("jshack:groundStack:seq");
const CHEST_BURST_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: -2 },
  { x: 2, y: 1 }, { x: 2, y: -1 }, { x: -2, y: 1 }, { x: -2, y: -1 },
  { x: 1, y: 2 }, { x: -1, y: 2 }, { x: 1, y: -2 }, { x: -1, y: -2 },
  { x: 2, y: 2 }, { x: -2, y: 2 }, { x: 2, y: -2 }, { x: -2, y: -2 },
]);

function nextGroundStackSeq(world) {
  const current = Number((/** @type {any} */ (world))[GROUND_STACK_SEQ_KEY] || 0) | 0;
  const next = (current + 1) | 0;
  (/** @type {any} */ (world))[GROUND_STACK_SEQ_KEY] = next;
  return next;
}

function stampGroundTop(world, itemId) {
  if (!(Number(itemId) > 0)) return;
  world.add(itemId, GroundStackOrder, { seq: nextGroundStackSeq(world) });
}

function buildChestBurstOffsets(world, chestId, count) {
  const n = Math.max(0, Number(count || 0) | 0);
  if (n <= 0) return [];
  const out = [];
  const base = ((world.seed >>> 0) ^ ((Number(chestId || 0) * 0x9e3779b9) >>> 0) ^ ((world.step | 0) >>> 0)) >>> 0;
  const start = Math.abs(base | 0) % CHEST_BURST_OFFSETS.length;
  for (let i = 0; i < n; i++) {
    out.push(CHEST_BURST_OFFSETS[(start + i) % CHEST_BURST_OFFSETS.length]);
  }
  return out;
}

function isSolidBlockedAt(world, x, y, ignoreId = 0) {
  const tx = x | 0;
  const ty = y | 0;
  for (const [id, pos, col] of world.query(Position, Collider)) {
    if ((Number(id) | 0) === (Number(ignoreId) | 0)) continue;
    if (!col?.solid) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    return true;
  }
  return false;
}

function buildChestBurstTargets(world, chestId, chestPos, count) {
  const n = Math.max(0, Number(count || 0) | 0);
  if (n <= 0) return [];
  const cx = chestPos.x | 0;
  const cy = chestPos.y | 0;

  const walkableReachable = [];
  const q = [{ x: cx, y: cy, d: 0 }];
  const seen = new Set([`${cx},${cy}`]);
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur.d > 2) continue;
    if (isWalkable(cur.x, cur.y) && !isSolidBlockedAt(world, cur.x, cur.y, chestId)) {
      walkableReachable.push(cur);
    }
    if (cur.d === 2) continue;
    const next = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (const p of next) {
      const k = `${p.x},${p.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ x: p.x, y: p.y, d: cur.d + 1 });
    }
  }

  let candidates = [];
  if (walkableReachable.length > 0) {
    const away = walkableReachable
      .filter((p) => (p.x | 0) !== cx || (p.y | 0) !== cy)
      .sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
    const origin = walkableReachable
      .filter((p) => (p.x | 0) === cx && (p.y | 0) === cy);
    candidates = away.length > 0 ? away.concat(origin) : walkableReachable.slice();
  } else {
    const offsets = buildChestBurstOffsets(world, chestId, n);
    candidates = offsets.map((off, i) => ({
      x: cx + (off.x | 0),
      y: cy + (off.y | 0),
      d: i,
    }));
  }

  if (!candidates.length) return [];
  const base = ((world.seed >>> 0) ^ ((Number(chestId || 0) * 0x9e3779b9) >>> 0) ^ ((world.step | 0) >>> 0)) >>> 0;
  const start = Math.abs(base | 0) % candidates.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = candidates[(start + i) % candidates.length];
    out.push({ x: p.x | 0, y: p.y | 0 });
  }
  return out;
}

function actorHasFieryWieldedWeapon(world, actor) {
  const eq = world.get(actor, Equipment);
  if (!eq) return false;
  const wieldedSlots = ["weapon", "offhand"];
  for (let i = 0; i < wieldedSlots.length; i++) {
    const slot = wieldedSlots[i];
    const itemId = Number(eq[slot] || 0) | 0;
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;
    const info = world.get(itemId, ItemInfo);
    if (!info) continue;
    if (String(info.damageType || "").toLowerCase() === "fire") return true;
    const affixes = Array.isArray(info.affixes) ? info.affixes : [];
    if (affixes.some((id) => FIERY_WEAPON_AFFIXES.has(String(id || "").toLowerCase()))) return true;
  }
  return false;
}

function hasFloorFireHazardAt(world, x, y) {
  const tx = x | 0;
  const ty = y | 0;
  for (const [, pos, hazard] of world.query(Position, HazardArea)) {
    if (!pos || !hazard) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    if (String(hazard.kind || "").toLowerCase() !== "fire") continue;
    if (String(hazard.medium || "air").toLowerCase() !== "floor") continue;
    if (Number(hazard.turnsLeft || 0) <= 0) continue;
    return true;
  }
  return false;
}

function toggleFloodArea(world, cx, cy, radius, toFlood) {
  const r = Math.max(1, Number(radius || 1) | 0);
  let changed = 0;
  for (let y = (cy | 0) - r; y <= (cy | 0) + r; y++) {
    for (let x = (cx | 0) - r; x <= (cx | 0) + r; x++) {
      const dx = Math.abs((x | 0) - (cx | 0));
      const dy = Math.abs((y | 0) - (cy | 0));
      if (Math.max(dx, dy) > r) continue;
      const tile = getTile(x, y);
      if (toFlood) {
        if (tile !== TILE_FLOOR) continue;
        setTile(x, y, TILE_SHALLOW_WATER);
        changed++;
      } else {
        if (tile !== TILE_SHALLOW_WATER) continue;
        setTile(x, y, TILE_FLOOR);
        changed++;
      }
    }
  }
  return changed;
}

function setFountainState(world, targetId, updates) {
  const inter = world.get(targetId, Interactable);
  if (!inter) return;
  const params = (inter.params && typeof inter.params === "object")
    ? { ...inter.params }
    : {};
  if (updates && typeof updates === "object") {
    for (const [k, v] of Object.entries(updates)) params[k] = v;
  }
  params.chargesRemaining = Math.max(
    0,
    Number(params.chargesRemaining || 0) | 0,
  );
  if (
    !Number.isFinite(Number(params.maxCharges)) ||
    Number(params.maxCharges) <= 0
  ) {
    params.maxCharges = Math.max(1, params.chargesRemaining | 0);
  }
  world.set(targetId, Interactable, { action: inter.action, params });
}

function _fountainPrimary(world, actor, targetId, primaryEffect, vit, r) {
  if (primaryEffect === "heal") {
    const fountainCap = effectiveMaxHp(world, actor, vit);
    const healAmt = Math.max(1, Math.floor(fountainCap * (0.2 + r() * 0.2)));
    const newHp = Math.min(fountainCap, vit.hp + healAmt);
    world.set(actor, Vitality, { maxHp: vit.maxHp, hp: newHp });
    world.emit?.("fountain:drink", {
      actor, targetId, effect: "heal", amount: healAmt,
    });
  } else {
    const mana = world.get(actor, Mana);
    if (mana && mana.maxMana > 0) {
      const maxM = effectiveMaxMana(world, actor, mana);
      const amt = Math.max(1, Math.floor(maxM * 0.3));
      world.set(actor, Mana, { ...mana, mana: Math.min(maxM, mana.mana + amt) });
      world.emit?.("fountain:drink", {
        actor, targetId, effect: "mana", amount: amt,
      });
    } else {
      world.emit?.("fountain:drink", {
        actor, targetId, effect: "nothing", amount: 0,
      });
    }
  }
}

/**
 * Dip an inventory item into a fountain.
 * Outcome table loosely inspired by NetHack — weighted random.
 *
 *  0.00–0.30  uncurse (if cursed → uncursed)
 *  0.30–0.50  bless   (if uncursed → blessed)
 *  0.50–0.65  curse   (uncursed/blessed → cursed)
 *  0.65–0.80  nothing (water ripples, no effect)
 *  0.80–0.90  rust    (metallic items take damage — placeholder event)
 *  0.90–1.00  spawn water creature (nymph or snake)
 */
function _fountainDip(ctx) {
  const { world, actor, targetId, intent } = ctx;
  const itemId = intent?.itemId | 0;
  if (!(itemId > 0) || !world.isAlive(itemId)) return;

  const state = ensureFountainState(world, targetId);
  const charges = Number(state?.charges || 0);
  if (charges <= 0) return;

  const fSeed = combatSeed(world.seed, world.step, actor | 0, targetId | 0, 0xD1B5);
  const r = mulberry32(fSeed);
  const roll = r();

  const beat = world.get(itemId, Beatitude);
  const prevState = String(beat?.state || "uncursed");
  const ni = world.get(itemId, NamedIdentity);
  const itemName = ni?.name || "the item";

  if (roll < 0.30) {
    // ── Uncurse ──────────────────────────────────────────────────
    if (prevState === "cursed") {
      world.set(itemId, Beatitude, { state: "uncursed" });
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "uncurse", itemName });
    } else {
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "nothing", itemName });
    }
  } else if (roll < 0.50) {
    // ── Bless ────────────────────────────────────────────────────
    if (prevState === "uncursed") {
      world.set(itemId, Beatitude, { state: "blessed" });
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "bless", itemName });
    } else {
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "nothing", itemName });
    }
  } else if (roll < 0.65) {
    // ── Curse ────────────────────────────────────────────────────
    if (prevState !== "cursed") {
      world.set(itemId, Beatitude, { state: "cursed" });
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "curse", itemName });
    } else {
      world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "nothing", itemName });
    }
  } else if (roll < 0.80) {
    // ── Nothing ──────────────────────────────────────────────────
    world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "nothing", itemName });
  } else if (roll < 0.90) {
    // ── Water damage to the dipped item ──────────────────────────
    const exposure = applyWaterExposure(world, itemId, {
      actor,
      sourceId: targetId,
      waterType: "plain",
    });
    world.emit?.("fountain:dip", {
      actor,
      targetId,
      itemId,
      effect: String(exposure?.effect || "wet"),
      itemName,
      stacks: Number(exposure?.stacks || 0) | 0,
      ruined: exposure?.ruined === true,
    });
  } else {
    // ── Spawn water creature ─────────────────────────────────────
    const fPos = world.get(targetId, Position);
    let spawnedName = null;
    if (fPos) {
      const tile = findNearestValidTileAround(world, fPos, { maxDistance: 2 });
      if (tile) {
        const isNymph = r() < 0.5;
        const def = isNymph
          ? { name: "Water Nymph", identity: "nymph", maxHp: 14, baseHp: 14, attack: 2, defense: 1, damageDice: "1d4", faction: "enemy", speed: 3 }
          : { name: "Water Snake", identity: "cave_snake", maxHp: 10, baseHp: 10, attack: 3, defense: 0, damageDice: "1d6", faction: "enemy", speed: 2 };
        const eid = spawnMonsterEntity(world, { ...def, x: tile.x, y: tile.y });
        if (eid > 0) spawnedName = def.name;
      }
    }
    world.emit?.("fountain:dip", { actor, targetId, itemId, effect: "creature", spawnedName, itemName });
  }

  // ── Charge bookkeeping (same as drink) ─────────────────────────
  const nextCharges = Math.max(0, charges - 1);
  if (nextCharges <= 0) {
    const cooldownTurns = Math.max(1, Number(state?.cooldownTurns || 1) | 0);
    const dryUntilStep = (Number(world.step || 0) | 0) + cooldownTurns;
    setFountainState(world, targetId, {
      chargesRemaining: 0,
      maxCharges: Math.max(1, Number(state?.maxCharges || 1) | 0),
      primaryEffect: String(state?.primaryEffect || "heal"),
      cooldownTurns,
      dryUntilStep,
    });
    world.emit?.("fountain:dry", {
      actor, targetId, chargesRemaining: 0, cooldownTurns, dryUntilStep,
    });
  } else {
    setFountainState(world, targetId, { chargesRemaining: nextCharges });
  }
}

function setWorkstationActive(world, targetId, fallbackState) {
  const inter = world.get(targetId, Interactable);
  if (!inter) return;
  const params = (inter.params && typeof inter.params === "object")
    ? { ...inter.params }
    : {};
  const activeState = String(params.activeState || fallbackState || "working");
  const duration = Math.max(1, Number(params.activeDuration || 4) | 0);
  params.activeUntilStep = (Number(world.step || 0) | 0) + duration;
  if (world.has(targetId, ObjectState)) {
    world.set(targetId, ObjectState, { state: activeState });
  }
  world.set(targetId, Interactable, { action: inter.action, params });
}

function consumeIdentityUnits(world, ownerId, identity, amount) {
  const result = consumeFromStack(world, ownerId, identity, amount);
  if (result.consumed < amount) return false;
  for (const itemId of result.entities) {
    try {
      world.destroy(itemId);
    } catch {}
  }
  return true;
}

function giveCraftedItem(world, ownerId, itemId) {
  const createdId = createItemById(world, itemId);
  if (!(createdId > 0)) return 0;
  if (
    world.has(ownerId, Inventory) && addToInventory(world, ownerId, createdId)
  ) return createdId;
  const pos = world.get(ownerId, Position);
  if (pos) world.add(createdId, Position, { x: pos.x, y: pos.y });
  return createdId;
}

function smeltOreAtFurnace(world, actor, targetId) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("smithy:failed", {
      actor,
      targetId,
      reason: "no_inventory",
      station: "furnace",
    });
    return;
  }
  const oreCount = getStackCount(world, actor, "ore_iron");
  const coalCount = getStackCount(world, actor, "ore_coal");
  if (oreCount <= 0) {
    world.emit?.("smithy:failed", {
      actor,
      targetId,
      reason: "missing_ore",
      station: "furnace",
    });
    return;
  }
  if (coalCount <= 0) {
    world.emit?.("smithy:failed", {
      actor,
      targetId,
      reason: "missing_fuel",
      station: "furnace",
    });
    return;
  }
  if (
    !consumeIdentityUnits(world, actor, "ore_iron", 1) ||
    !consumeIdentityUnits(world, actor, "ore_coal", 1)
  ) {
    world.emit?.("smithy:failed", {
      actor,
      targetId,
      reason: "consume_failed",
      station: "furnace",
    });
    return;
  }
  const itemId = giveCraftedItem(world, actor, "material_iron");
  setWorkstationActive(world, targetId, "lit");
  world.emit?.("smithy:smelted", {
    actor,
    targetId,
    itemId,
    outputIdentity: "material_iron",
  });
}

// ─── Payload definitions ──────────────────────────────────────────────────────

export const INTERACT_PAYLOADS = {
  // ── Doors ──────────────────────────────────────────────────────────────────

  toggleDoor: {
    beforeInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const ds = world.get(targetId, DoorState);
      if (ds?.locked && !actorHasDoorKey(world, actor, targetId)) {
        world.emit?.("interaction", {
          actor,
          targetId,
          action: "toggleDoor",
          result: "locked",
        });
        ctx.cancel("LOCKED", "The door is locked.");
      }
    },
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const ds = world.get(targetId, DoorState);
      const nowOpen = !(ds?.open);
      // Don't close a door while a living creature occupies the tile.
      if (!nowOpen) {
        const doorPos = world.get(targetId, Position);
        if (doorPos) {
          for (const [id, pos] of world.query(Position, Vitality)) {
            if (pos.x === doorPos.x && pos.y === doorPos.y && (world.get(id, Vitality)?.hp | 0) > 0) {
              return;
            }
          }
        }
      }
      setDoorState(world, targetId, {
        open: nowOpen,
        locked: nowOpen ? false : !!ds?.locked,
      }, actor);
    },
  },

  // ── Chests / containers ────────────────────────────────────────────────────

  openChest: {
    onInteract(ctx) {
      const { world, actor, targetId, params } = ctx;
      if (!world.has(targetId, Inventory)) return;
      const useInventoryUi = !!(
        params?.inventoryChest
        || params?.legacyInventory
        || String(params?.mode || "") === "inventory"
      );
      const chestItems = inventoryItems(world, targetId);
      if (useInventoryUi) {
        world.emit?.("chest:open", {
          actor,
          targetId,
          chestItems: chestItems.slice(),
        });
        return;
      }
      const chestPos = world.get(targetId, Position);
      if (!chestPos) {
        // Non-ground containers (if any) still use UI-driven inventory transfer.
        world.emit?.("chest:open", {
          actor,
          targetId,
          chestItems: chestItems.slice(),
        });
        return;
      }
      const consumeChestShell = () => {
        try { if (world.has(targetId, Interactable)) world.remove(targetId, Interactable); } catch {}
        try { if (world.has(targetId, Collider)) world.remove(targetId, Collider); } catch {}
      };
      if (!chestItems.length) {
        world.emit?.("chest:empty", { actor, targetId });
        consumeChestShell();
        return;
      }

      const targets = buildChestBurstTargets(world, targetId, chestPos, chestItems.length);
      const drops = [];
      for (let i = 0; i < chestItems.length; i++) {
        const itemId = chestItems[i];
        if (!removeFromInventory(world, targetId, itemId)) continue;
        const target = targets[i] || { x: chestPos.x | 0, y: chestPos.y | 0 };
        const px = target.x | 0;
        const py = target.y | 0;
        const placed = placeOnGround(world, itemId, px, py, { mergeCompatibleAmmo: true });
        const finalId = Number(placed.itemId || itemId) | 0;
        if (!(finalId > 0)) continue;
        stampGroundTop(world, finalId);
        const finalPos = world.get(finalId, Position);
        const at = {
          x: Number(finalPos?.x ?? px) | 0,
          y: Number(finalPos?.y ?? py) | 0,
        };
        const info = world.get(finalId, ItemInfo);
        emitSafe(world, "item:dropped", {
          actor,
          itemId: finalId,
          count: Math.max(1, Number(placed.movedCount || info?.count || 1) | 0),
          at,
          source: "chest",
          targetId,
        });
        drops.push({ itemId: finalId, at });
      }

      world.emit?.("chest:burst", {
        actor,
        targetId,
        origin: { x: chestPos.x | 0, y: chestPos.y | 0 },
        drops,
      });
      consumeChestShell();
    },
  },

  touchMimic: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      world.emit?.("polymorph:request", {
        entityId: targetId,
        actorId: actor,
        trigger: "touch",
        reason: "mimic_touched",
      });
    },
  },

  // ── Townfolk NPC dialogue ──────────────────────────────────────────────────

  talkToNPC: {
    onInteract(ctx) {
      const { world, actor, targetId, params } = ctx;
      if (!isEntityOnCurrentFloor(world, targetId)) return;
      const dialogId = String(params?.dialogId || "").trim();
      if (dialogId) {
        world.emit?.("dialog:openRequest", {
          actorId: actor,
          targetId,
          dialogId,
        });
        return;
      }
      world.emit?.("npc:dialogue", {
        actor,
        targetId,
        text: params?.dialogue || "...",
      });
    },
  },

  // ── Signs & text ───────────────────────────────────────────────────────────

  readText: {
    onInteract(ctx) {
      const { world, actor, targetId, params } = ctx;
      world.emit?.("interaction", {
        actor,
        targetId,
        action: "readText",
        textId: params?.textId,
      });
    },
  },

  readTownBulletin: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const board = buildNoticeBoardPayload(world, actor);
      world.emit?.("town:bulletinBoard", {
        actor,
        targetId,
        districts: board.districts,
        opportunityView: board.opportunityView,
        questBoard: board.questBoard,
      });
    },
  },

  readTombstone: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const tombstone = world.get(targetId, TombstoneComponent);
      if (tombstone) {
        world.emit?.("interaction", {
          actor,
          targetId,
          action: "readTombstone",
          epitaph: tombstone.epitaph,
          tombstoneData: {
            playerName: tombstone.playerName,
            depth: tombstone.depth,
            cause: tombstone.cause,
            killerName: tombstone.killerName,
          },
        });
      }
    },
  },

  // ── Weapon racks ───────────────────────────────────────────────────────────

  browseRack: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const rackInv = /** @type {any} */ (world.get(targetId, Inventory));
      const rackPos = world.get(targetId, Position);
      if (!rackInv || !rackPos) return;

      const rackItems = inventoryItems(world, targetId);
      if (rackItems.length === 0) {
        world.emit?.("rack:empty", { actor, targetId });
        return;
      }

      const actorPos = world.get(actor, Position);
      const dropPos = actorPos ?? rackPos;

      // Pull one weapon off the rack and fling it at the player.
      const itemId = rackItems[0];
      removeFromInventory(world, targetId, itemId);
      world.add(itemId, Position, { x: dropPos.x, y: dropPos.y });
      world.emit?.("item:thrown", {
        itemId,
        from: { x: rackPos.x, y: rackPos.y },
        to: { x: dropPos.x, y: dropPos.y },
      });

      // Rack is now passable — player can walk through it.
      const col = world.get(targetId, Collider);
      if (col) {
        world.set(targetId, Collider, {
          solid: false,
          blocksSight: col.blocksSight,
        });
      }

      world.emit?.("rack:looted", { actor, targetId, count: 1 });
    },
  },

  // ── Crafting ───────────────────────────────────────────────────────────────

  brewAlchemy: {
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      const interactionMode = String(intent?.mode || "").toLowerCase();
      const requestedRecipe = String(intent?.recipe || "").toLowerCase();
      if (interactionMode !== "brew" || !requestedRecipe) {
        emitAlchemyBenchOpen(world, actor, targetId);
        return;
      }
      brewAtAlchemyBench(world, actor, targetId, requestedRecipe);
    },
  },

  craftEnchants: {
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      const interactionMode = String(intent?.mode || "").toLowerCase();
      const requestedRecipe = String(intent?.recipe || "").toLowerCase();
      if (interactionMode !== "enchant" || !requestedRecipe) {
        emitEnchantingBenchOpen(world, actor, targetId);
        return;
      }
      craftAtEnchantingBench(world, actor, targetId, requestedRecipe);
    },
  },

  openEnchantressServices: {
    onInteract(ctx) {
      const { world, actor, targetId, intent, params } = ctx;
      const interactionMode = String(intent?.mode || "").toLowerCase();
      const requestedRecipe = String(intent?.recipe || "").toLowerCase();
      if (interactionMode === "enchant" && requestedRecipe) {
        craftAtEnchantingBench(world, actor, targetId, requestedRecipe, {
          title: "✧ Enchantress",
          subtitle: "Choose the binding you want and I'll scribe the scroll if you've brought the price.",
        });
        return;
      }
      const dialogId = String(params?.dialogId || "").trim();
      if (dialogId) {
        world.emit?.("dialog:openRequest", {
          actorId: actor,
          targetId,
          dialogId,
        });
        return;
      }
      emitEnchantingBenchOpen(world, actor, targetId, {
        title: "✧ Enchantress",
        subtitle: "Bring themed reagents, gold, and the gear you want changed forever.",
      });
    },
  },

  // ── Cooking ───────────────────────────────────────────────────────────────

  cookFood: {
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      if (String(intent?.mode || "") === "cook" && (intent?.itemId | 0) > 0) {
        cookAtFire(world, actor, targetId, intent.itemId | 0);
        return;
      }
      emitCookingFireOpen(world, actor, targetId);
    },
  },

  millGrain: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      if (!world.has(actor, Inventory)) {
        world.emit?.("mill:failed", {
          actor,
          targetId,
          reason: "no_inventory",
        });
        return;
      }
      const wheatCount = getStackCount(world, actor, "food_wheat");
      if (wheatCount <= 0) {
        world.emit?.("mill:failed", {
          actor,
          targetId,
          reason: "missing_wheat",
        });
        return;
      }
      if (!consumeIdentityUnits(world, actor, "food_wheat", 1)) {
        world.emit?.("mill:failed", {
          actor,
          targetId,
          reason: "consume_failed",
        });
        return;
      }
      const itemId = giveCraftedItem(world, actor, "food_flour");
      setWorkstationActive(world, targetId, "working");
      world.emit?.("mill:milled", {
        actor,
        targetId,
        itemId,
        outputIdentity: "food_flour",
      });
    },
  },

  // ── Furnace ────────────────────────────────────────────────────────────────

  smeltOre: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      smeltOreAtFurnace(world, actor, targetId);
    },
  },

  toggleFurnace: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const hasInventory = world.has(actor, Inventory);
      const oreCount = hasInventory
        ? getStackCount(world, actor, "ore_iron")
        : 0;
      const coalCount = hasInventory
        ? getStackCount(world, actor, "ore_coal")
        : 0;
      if (oreCount > 0 && coalCount > 0) {
        smeltOreAtFurnace(world, actor, targetId);
        return;
      }
      const os = world.get(targetId, ObjectState);
      const nowLit = os?.state !== "lit";
      if (os) {
        world.set(targetId, ObjectState, { state: nowLit ? "lit" : "unlit" });
      }
      world.emit?.("interaction", {
        actor,
        targetId,
        action: "toggleFurnace",
        result: nowLit ? "lit" : "extinguished",
      });
    },
  },

  forgeTools: {
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      const recipeKey = String(intent?.recipe || "").trim().toLowerCase();
      if (!recipeKey) {
        emitAnvilOpen(world, actor, targetId);
        return;
      }
      if (forgeAtAnvil(world, actor, targetId, recipeKey)) {
        setWorkstationActive(world, targetId, "working");
      }
    },
  },

  toggleLantern: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const os = world.get(targetId, ObjectState);
      const nowLit = os?.state !== "lit";
      if (os) {
        world.set(targetId, ObjectState, { state: nowLit ? "lit" : "unlit" });
      }
      world.emit?.("interaction", {
        actor,
        targetId,
        action: "toggleLantern",
        result: nowLit ? "lit" : "extinguished",
      });
    },
  },

  // ── Rest & recovery ────────────────────────────────────────────────────────

  restAtBed: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const vit = world.get(actor, Vitality);
      if (vit) world.set(actor, Vitality, { maxHp: vit.maxHp, hp: effectiveMaxHp(world, actor, vit) });
      const mana = world.get(actor, Mana);
      if (mana) world.set(actor, Mana, { ...mana, mana: effectiveMaxMana(world, actor, mana) });
      const stamina = world.get(actor, Stamina);
      if (stamina) {
        world.set(actor, Stamina, {
          ...stamina,
          stamina: effectiveMaxStamina(world, actor, stamina),
          regenCooldown: 0,
        });
      }
      world.emit?.("bed:rested", { actor, targetId });
    },
  },

  // ── Commerce ───────────────────────────────────────────────────────────────

  openShop: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const shop = world.get(targetId, ShopInventory);
      if (shop) {
        world.emit?.("shop:open", {
          actor,
          targetId,
          buyMarkup: shop.buyMarkup ?? 1.0,
          sellDiscount: shop.sellDiscount ?? 0.5,
        });
      }
    },
  },

  openGemVendor: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const shop = world.get(targetId, ShopInventory);
      if (shop) {
        world.emit?.("shop:open", {
          actor,
          targetId,
          buyMarkup: shop.buyMarkup ?? 1.5,
          sellDiscount: shop.sellDiscount ?? 0.5,
          vendorKind: "gem",
        });
      }
    },
  },

  openBookVendor: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const shop = world.get(targetId, ShopInventory);
      if (shop) {
        world.emit?.("shop:open", {
          actor,
          targetId,
          buyMarkup: shop.buyMarkup ?? 1.2,
          sellDiscount: shop.sellDiscount ?? 0.5,
          vendorKind: "book",
        });
      }
    },
  },

  // ── Stairs ─────────────────────────────────────────────────────────────────
  // Traversal is owned by the UI/app layer (tooltip tap / Enter key).
  // These entries exist so the interactable component is valid and the system
  // returns true, but they are intentional no-ops in the rules layer.

  descendStair: { onInteract() {} },
  ascendStair: { onInteract() {} },

  // ── Well ───────────────────────────────────────────────────────────────────

  drinkWell: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const stamina = world.get(actor, Stamina);
      if (stamina) {
        const maxStam = effectiveMaxStamina(world, actor, stamina);
        const restoreAmt = Math.floor(maxStam * 0.3);
        const prev = stamina.stamina;
        const next = Math.min(maxStam, prev + restoreAmt);
        world.set(actor, Stamina, {
          ...stamina,
          stamina: next,
          regenCooldown: 0,
        });
        world.emit?.("well:drink", { actor, targetId, amount: next - prev });
      } else {
        world.emit?.("well:drink", { actor, targetId, amount: 0 });
      }
    },
  },

  // ── Fountain ───────────────────────────────────────────────────────────────
  // Multi-action: menu gate in interactRunner shows Drink / Dip chooser.
  // When intent.mode arrives, dispatch to the appropriate branch below.

  fountain: {
    beforeInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      const mode = String(intent?.mode || "");
      if (!mode || mode === "drink") {
        const state = ensureFountainState(world, targetId);
        const charges = Number(state?.charges || 0);
        const cooldownTurns = Math.max(1, Number(state?.cooldownTurns || 1) | 0);
        const dryUntilStep = Number(state?.dryUntilStep ?? -1);
        if (charges <= 0) {
          world.emit?.("fountain:dry", {
            actor,
            targetId,
            chargesRemaining: 0,
            cooldownTurns,
            dryUntilStep: dryUntilStep >= 0
              ? dryUntilStep
              : ((Number(world.step || 0) | 0) + cooldownTurns),
          });
          ctx.cancel("FOUNTAIN_DRY", "The fountain has run dry.");
          return;
        }
      }
      if (mode === "drink") {
        if (!world.get(actor, Vitality)) {
          ctx.cancel("NO_VITALITY", "Actor has no vitality component.");
          return;
        }
      } else if (mode === "dip") {
        // Phase 1: no item yet — emit prompt so the UI can ask which item.
        if (!(intent?.itemId > 0)) {
          const items = inventoryItems(world, actor).filter(
            iid => world.isAlive(iid),
          );
          world.emit?.("fountain:dipPrompt", { actor, targetId, items });
          ctx.cancel("DIP_PROMPT", "");
          return;
        }
        // Phase 2: item selected — validate charges.
        const state = ensureFountainState(world, targetId);
        const charges = Number(state?.charges || 0);
        if (charges <= 0) {
          world.emit?.("fountain:dry", { actor, targetId, chargesRemaining: 0 });
          ctx.cancel("FOUNTAIN_DRY", "The fountain has run dry.");
        }
      }
    },
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;
      const mode = String(intent?.mode || "");

      // ── Dip ────────────────────────────────────────────────────────
      if (mode === "dip") {
        _fountainDip(ctx);
        return;
      }

      // ── Drink (default) ────────────────────────────────────────────
      const state = ensureFountainState(world, targetId);
      const charges = Number(state?.charges || 0);
      const primaryEffect = String(state?.primaryEffect || "heal");
      if (charges <= 0) return;

      const vit = world.get(actor, Vitality);
      const fSeed = combatSeed(
        world.seed,
        world.step,
        actor | 0,
        targetId | 0,
        0xF0C5,
      );
      const r = mulberry32(fSeed);

      // ── Weighted outcome table ─────────────────────────────────────
      // Outcomes are cumulative-weight bands.  Each drink is a pull of
      // the slot machine — mostly good, sometimes weird, rarely great.
      //
      //  0.00–0.30  primary (heal or mana restore)
      //  0.30–0.42  attribute buff (lucky / keen_eye / bear_vigor)
      //  0.42–0.52  see invisible (temporary)
      //  0.52–0.60  nothing (stale water)
      //  0.60–0.68  gold bubbles up
      //  0.68–0.75  curse a random inventory item
      //  0.75–0.82  poison
      //  0.82–0.88  spawn water creature (nymph or snake)
      //  0.88–0.93  teleport
      //  0.93–0.97  gushing flood (destroys fountain, creates water)
      //  0.97–1.00  wish (rare loot drop)
      const roll = r();

      if (roll < 0.30) {
        // ── Primary: heal or mana ──────────────────────────────────
        _fountainPrimary(world, actor, targetId, primaryEffect, vit, r);
      } else if (roll < 0.42) {
        // ── Attribute buff ─────────────────────────────────────────
        const buffs = ["lucky", "keen_eye", "bear_vigor"];
        const pick = buffs[Math.floor(r() * buffs.length)];
        const turns = 30 + Math.floor(r() * 40);
        const ae = ensureActiveEffects(world, actor);
        if (ae) {
          upsertTimedEffect(ae.effects, { key: pick, turnsLeft: turns, potency: 1 });
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "buff", buff: pick, turns,
        });
      } else if (roll < 0.52) {
        // ── See invisible ──────────────────────────────────────────
        const turns = 40 + Math.floor(r() * 60);
        const ae = ensureActiveEffects(world, actor);
        if (ae) {
          upsertTimedEffect(ae.effects, { key: "esp_sense", turnsLeft: turns, potency: 1 });
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "see_invisible", turns,
        });
      } else if (roll < 0.60) {
        // ── Nothing ────────────────────────────────────────────────
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "nothing", amount: 0,
        });
      } else if (roll < 0.68) {
        // ── Gold bubbles up ────────────────────────────────────────
        const fPos = world.get(targetId, Position);
        const goldAmt = 8 + Math.floor(r() * 25);
        if (fPos) {
          const gid = createFrom(world, GoldStack, { x: fPos.x, y: fPos.y });
          if (gid > 0) {
            try { world.add(gid, Position, { x: fPos.x, y: fPos.y }); } catch { /* already has Position */ }
            const gi = world.get(gid, ItemInfo);
            if (gi) world.set(gid, ItemInfo, { ...gi, count: goldAmt });
          }
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "gold", amount: goldAmt,
        });
      } else if (roll < 0.75) {
        // ── Curse a random inventory item ──────────────────────────
        const items = inventoryItems(world, actor);
        const curseable = items.filter(iid => {
          if (!world.isAlive(iid)) return false;
          const b = world.get(iid, Beatitude);
          return !b || String(b.state) !== "cursed";
        });
        let cursedName = null;
        if (curseable.length > 0) {
          const pick = curseable[Math.floor(r() * curseable.length)];
          world.set(pick, Beatitude, { state: "cursed" });
          const ni = world.get(pick, NamedIdentity);
          cursedName = ni?.name || "an item";
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "curse", cursedName,
        });
      } else if (roll < 0.82) {
        // ── Poison ─────────────────────────────────────────────────
        const dmgAmt = Math.max(1, Math.floor(vit.maxHp * (0.05 + r() * 0.05)));
        dealDamage(world, {
          target: actor, amount: dmgAmt, type: "poison",
          source: targetId, cause: "fountain",
        });
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "poison", amount: dmgAmt,
        });
      } else if (roll < 0.88) {
        // ── Spawn water creature ───────────────────────────────────
        const fPos = world.get(targetId, Position);
        let spawnedName = null;
        if (fPos) {
          const tile = findNearestValidTileAround(world, fPos, { maxDistance: 2 });
          if (tile) {
            const isNymph = r() < 0.5;
            const def = isNymph
              ? { name: "Water Nymph", identity: "nymph", maxHp: 14, baseHp: 14, attack: 2, defense: 1, damageDice: "1d4", faction: "enemy", speed: 3 }
              : { name: "Water Snake", identity: "cave_snake", maxHp: 10, baseHp: 10, attack: 3, defense: 0, damageDice: "1d6", faction: "enemy", speed: 2 };
            const eid = spawnMonsterEntity(world, { ...def, x: tile.x, y: tile.y });
            if (eid > 0) spawnedName = def.name;
          }
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "creature", spawnedName,
        });
      } else if (roll < 0.93) {
        // ── Teleport ───────────────────────────────────────────────
        const pos = world.get(actor, Position);
        if (pos) {
          const from = { x: pos.x | 0, y: pos.y | 0 };
          const candidates = [];
          forEachLoadedTile((x, y) => {
            if (!isWalkable(x, y)) return;
            const dx = x - from.x, dy = y - from.y;
            if (dx * dx + dy * dy < 36) return; // min distance 6
            candidates.push({ x, y });
          });
          if (candidates.length > 0) {
            const to = candidates[Math.floor(r() * candidates.length)];
            world.set(actor, Position, { x: to.x, y: to.y });
            emitSafe(world, "moved", { id: actor, from, to });
            world.emit?.("fountain:drink", {
              actor, targetId, effect: "teleport", from, to,
            });
          } else {
            world.emit?.("fountain:drink", {
              actor, targetId, effect: "nothing", amount: 0,
            });
          }
        }
      } else if (roll < 0.97) {
        // ── Gushing flood ──────────────────────────────────────────
        // Fountain explodes: converts nearby floor tiles to shallow water,
        // permanently destroys the fountain.
        const fPos = world.get(targetId, Position);
        let tilesFlooded = 0;
        if (fPos) {
          const cx = fPos.x | 0, cy = fPos.y | 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (dx * dx + dy * dy > 5) continue; // rough circle r~2
              const tx = cx + dx, ty = cy + dy;
              const t = getTile(tx, ty);
              if (t === TILE_FLOOR) {
                setTile(tx, ty, TILE_SHALLOW_WATER);
                tilesFlooded++;
              }
            }
          }
        }
        // Destroy the fountain entity
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "gush", tilesFlooded,
        });
        world.emit?.("fountain:destroyed", { actor, targetId, tilesFlooded });
        if (world.isAlive(targetId)) world.destroy(targetId);
        // Skip normal charge decrement — fountain is gone
        return;
      } else {
        // ── Wish: rare loot drop ───────────────────────────────────
        const fPos = world.get(targetId, Position);
        let wishedItem = null;
        if (fPos) {
          let depth = 1;
          for (const [, ds] of world.query(DungeonState)) {
            depth = Math.max(1, Number(ds?.currentDepth ?? 1));
          }
          const lootRng = createRng(
            (world.seed ^ (targetId * 0xBEEF) ^ (world.step * 0x1337)) >>> 0,
          );
          const drops = resolveLootTable("chest:magic", lootRng, depth, 0, {});
          if (drops.length > 0) {
            const drop = drops[0];
            const eid = materializeDrop(world, drop, { x: fPos.x, y: fPos.y });
            if (eid > 0) {
              const ni = world.get(eid, NamedIdentity);
              wishedItem = ni?.name || "something";
            }
          }
        }
        world.emit?.("fountain:drink", {
          actor, targetId, effect: "wish", wishedItem,
        });
      }

      // ── Charge bookkeeping ─────────────────────────────────────
      const nextCharges = Math.max(0, charges - 1);
      if (nextCharges <= 0) {
        const cooldownTurns = Math.max(
          1,
          Number(state?.cooldownTurns || 1) | 0,
        );
        const dryUntilStep = (Number(world.step || 0) | 0) + cooldownTurns;
        setFountainState(world, targetId, {
          chargesRemaining: 0,
          maxCharges: Math.max(1, Number(state?.maxCharges || 1) | 0),
          primaryEffect,
          cooldownTurns,
          dryUntilStep,
        });
        world.emit?.("fountain:dry", {
          actor,
          targetId,
          chargesRemaining: 0,
          cooldownTurns,
          dryUntilStep,
        });
      } else {
        setFountainState(world, targetId, { chargesRemaining: nextCharges });
      }
    },
  },

  // ── Altar ──────────────────────────────────────────────────────────────────
  //
  // Two-phase flow:
  //   Phase 1 (no mode): gather offerable items, emit prompt, emit prayers.
  //   Phase 2 (intent.mode === "offer", intent.itemId > 0): consume the chosen
  //     item and emit the divine response.

  prayAltar: {
    onInteract(ctx) {
      const { world, actor, targetId, intent } = ctx;

      if (
        String(intent?.mode || "").toLowerCase() === "offer" &&
        (intent?.itemId | 0) > 0
      ) {
        _altarExecuteOffer(world, actor, targetId, intent.itemId | 0);
        return;
      }

      // Phase 1 — collect offerable items and prompt the UI.
      const offerableItems = [];
      const eq = world.get(actor, Equipment);
      for (const iid of inventoryItems(world, actor)) {
        if (!world.isAlive(iid)) continue;
        if (!world.get(iid, ItemInfo)) continue;
        // Skip equipped items — player must unequip first.
        if (eq && GEAR_SLOTS.some(s => eq[s] === iid)) continue;
        offerableItems.push(iid);
      }
      world.emit?.("altar:offerPrompt", {
        actor,
        targetId,
        items: offerableItems,
      });
      world.emit?.("prayer", { actor, distress: null, altarBonus: true });
      world.emit?.("altar:pray", { actor, targetId });
    },
  },

  // ── Town Bell ────────────────────────────────────────────────────────────────

  ringBell: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      world.emit?.("bell:rung", { actor, targetId });
    },
  },

  operateChainWinch: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const inter = world.get(targetId, Interactable);
      const params = (inter?.params && typeof inter.params === "object") ? { ...inter.params } : {};
      const linkId = String(params.linkId || "").trim();
      if (!linkId) {
        world.emit?.("hydraulics:winch", {
          actor,
          targetId,
          ok: false,
          reason: "unlinked",
        });
        return;
      }

      let hasRaised = false;
      let hasLowered = false;
      for (const [id, link] of world.query(HydraulicsLink)) {
        if ((id | 0) === (targetId | 0)) continue;
        if (String(link?.role || "") !== "portcullis") continue;
        if (String(link?.linkId || "") !== linkId) continue;
        const state = String(world.get(id, ObjectState)?.state || "lowered");
        if (state === "raised") hasRaised = true;
        else hasLowered = true;
      }
      const toRaised = hasLowered || !hasRaised;
      const changed = setLinkedPortcullisState(world, linkId, toRaised, "operateChainWinch");
      if (changed > 0) {
        world.set(targetId, ObjectState, { state: toRaised ? "pull_up" : "pull_down" });
        world.set(targetId, Interactable, {
          action: inter.action,
          params: {
            ...params,
            togglesTo: toRaised ? "lower" : "raise",
            activeUntilStep: (Number(world.step || 0) | 0) + 2,
            idleState: "idle",
          },
        });
      }
      world.emit?.("hydraulics:winch", {
        actor,
        targetId,
        linkId,
        gatesChanged: changed,
        raised: toRaised,
      });
    },
  },

  toggleFloodGateWheel: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const inter = world.get(targetId, Interactable);
      const params = (inter?.params && typeof inter.params === "object") ? { ...inter.params } : {};
      const floodRadius = Math.max(1, Number(params.floodRadius || 2) | 0);
      const currentlyActive = !!params.active;
      const nextActive = !currentlyActive;
      const pos = world.get(targetId, Position);
      if (!pos) return;

      const changed = toggleFloodArea(world, pos.x | 0, pos.y | 0, floodRadius, nextActive);
      world.set(targetId, ObjectState, { state: nextActive ? "open" : "closed" });
      world.set(targetId, Interactable, {
        action: inter.action,
        params: {
          ...params,
          active: nextActive,
          activeUntilStep: (Number(world.step || 0) | 0) + 2,
          idleState: nextActive ? "open" : "closed",
        },
      });
      world.emit?.("hydraulics:floodgate", {
        actor,
        targetId,
        active: nextActive,
        floodRadius,
        tilesChanged: changed,
      });
    },
  },

  inspectPressurePlinth: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const inter = world.get(targetId, Interactable);
      const thresholdWeight = Math.max(1, Number(inter?.params?.thresholdWeight || 25) | 0);
      const state = String(world.get(targetId, ObjectState)?.state || "unpressed");
      world.emit?.("hydraulics:plinthInspect", {
        actor,
        targetId,
        thresholdWeight,
        state,
      });
    },
  },

  inspectSteamVent: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const inter = world.get(targetId, Interactable);
      const params = (inter?.params && typeof inter.params === "object") ? inter.params : {};
      world.emit?.("hydraulics:ventInspect", {
        actor,
        targetId,
        periodTurns: Math.max(1, Number(params.periodTurns || 6) | 0),
        activeTurns: Math.max(1, Number(params.activeTurns || 2) | 0),
        range: Math.max(1, Number(params.range || 4) | 0),
      });
    },
  },

  ringBoneChime: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const pos = world.get(targetId, Position);
      const sourceId = (actor | 0) > 0 ? actor | 0 : targetId | 0;
      const emitter = world.get(sourceId, SoundEmitter);
      if (emitter) {
        world.set(sourceId, SoundEmitter, {
          ambient: Number(emitter.ambient || 0) | 0,
          lastActionNoise: Math.max(Number(emitter.lastActionNoise || 0) | 0, 88),
        });
      } else {
        world.add(sourceId, SoundEmitter, { ambient: 0, lastActionNoise: 88 });
      }
      world.emit?.("boneChime:rung", {
        actor,
        targetId,
        at: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
        sourceDbAt1Tile: 88,
      });
    },
  },

  // ── Shrine ─────────────────────────────────────────────────────────────────

  touchShrine: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      world.emit?.("shrine:touch", { actor, targetId });
    },
  },

  // ── Harvest nodes ──────────────────────────────────────────────────────────

  harvestNode: {
    beforeInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const node = world.get(targetId, HarvestNode);

      if (!node) {
        ctx.cancel("NO_NODE");
        return;
      }

      if (!node.ready) {
        // Allow seed planting on needsPlanting crop nodes.
        if (node.needsPlanting) {
          const seedCatalogId = SEED_ITEM_IDS[node.kind];
          if (seedCatalogId) {
            const items = inventoryItems(world, actor);
            for (let i = 0; i < items.length; i++) {
              const ni = world.get(items[i], NamedIdentity);
              if (ni && ni.identity === seedCatalogId) {
                ctx.data.plantMode = true;
                ctx.data.seedEntityId = items[i];
                ctx.data.node = node;
                return;
              }
            }
          }
        }
        world.emit?.("harvest:empty", {
          actor,
          targetId,
          kind: node.kind,
          regrowCountdown: node.regrowCountdown | 0,
        });
        ctx.cancel("NOT_READY");
        return;
      }

      // Tool + stamina gate (data-driven: node.requiresTool matches equipment bonus key).
      if (node.requiresTool) {
        const eq = world.get(actor, Equipment);
        const weaponId = eq?.weapon || 0;
        const wInfo = weaponId ? world.get(weaponId, ItemInfo) : null;
        if (!wInfo?.bonuses?.[node.requiresTool]) {
          world.emit?.("harvest:no_tool", {
            actor,
            targetId,
            kind: node.kind,
            requiredTool: node.requiresTool,
          });
          ctx.cancel("NO_TOOL");
          return;
        }
        const stam = world.get(actor, Stamina);
        const cost = Number(wInfo.staminaCost ?? 25);
        if (stam && Number(stam.stamina ?? 0) < cost) {
          world.emit?.("harvest:no_stamina", {
            actor,
            targetId,
            kind: node.kind,
            cost,
          });
          ctx.cancel("NO_STAMINA");
          return;
        }
        // Deduct stamina here so onInteract can focus on the reward.
        if (stam) stam.stamina = Math.max(0, Number(stam.stamina) - cost);
      }

      // Cache node on ctx.data for downstream phases.
      ctx.data.node = node;
    },

    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const node = ctx.data.node;

      // Seed planting mode — consume seed and start growth.
      if (ctx.data.plantMode) {
        removeFromInventory(world, actor, ctx.data.seedEntityId);
        try {
          world.destroy(ctx.data.seedEntityId);
        } catch {}
        world.mutate(targetId, HarvestNode, (n) => {
          n.needsPlanting = false;
          n.regrowCountdown = n.regrowTurns;
        });
        world.emit?.("seed:planted", { actor, targetId, kind: node.kind });
        return;
      }

      const r = mulberry32(
        combatSeed(
          world.seed,
          world.step,
          actor | 0,
          targetId | 0,
          HARVEST_SEED_SALT,
        ),
      );
      const spread = Math.max(1, (node.yieldMax - node.yieldMin + 1) | 0);
      const count = Math.max(1, (node.yieldMin + ((r() * spread) | 0)) | 0);

      // Yield item — drops at actor's feet if inventory is full or overweight.
      let resultItemId = 0;
      const catalogId = node.yield;
      const arch = catalogId ? CATALOG_ARCHETYPES[catalogId] : null;
      if (arch) {
        const def = getCatalogItem(catalogId);
        const inv = world.get(actor, Inventory);
        const actorPos = world.get(actor, Position);

        const enc = world.get(actor, Encumbrance);
        const overweight = enc ? enc.overloaded : false;
        const overCapacity = !hasCapacity(world, actor);

        const itemId = createFrom(world, arch, {});
        world.mutate(itemId, ItemInfo, (rec) => {
          rec.count = count;
        });
        resultItemId = itemId;

        if (!overweight && !overCapacity) {
          addToInventory(world, actor, itemId);
        } else {
          if (actorPos) {
            world.add(itemId, Position, { x: actorPos.x, y: actorPos.y });
          }
          world.emit?.("harvest:overweight", {
            actor,
            targetId,
            kind: node.kind,
            count,
            reason: overweight ? "weight" : "capacity",
          });
        }
      }

      // Danger and hazard side-effects (fully data-driven from HarvestNode component).
      const actorPos = world.get(actor, Position);
      if (node.danger) {
        const dmg = node.danger.dmgMin +
          ((r() * (node.danger.dmgMax - node.danger.dmgMin + 1)) | 0);
        const hit = dealDamage(world, {
          target: actor,
          amount: dmg,
          type: node.danger.type || "physical",
          source: targetId,
          cause: node.danger.cause || node.kind,
          at: actorPos ? { x: actorPos.x, y: actorPos.y } : undefined,
        });
        world.emit?.("harvest:danger", {
          actor,
          targetId,
          kind: node.kind,
          effect: node.danger.type,
          damage: hit.applied ? hit.amount : 0,
        });
      }
      if (node.hazard) {
        const hazardAt = actorPos || world.get(targetId, Position);
        let hazardId = 0;
        if (hazardAt) {
          hazardId = spawnHazard(world, {
            x: hazardAt.x,
            y: hazardAt.y,
            kind: node.hazard.kind,
            medium: "floor",
            turnsLeft: node.hazard.turnsLeft ?? 2,
            radius: 0,
            tickDamage: node.hazard.tickDamage ?? 1,
            damageType: node.hazard.kind,
            cause: node.kind,
            sourceId: targetId,
            sourceKind: node.kind,
            identity: node.hazard.identity || node.hazard.kind,
            name: node.hazard.name || node.hazard.kind,
            meta: { source: node.kind + "_harvest" },
          });
        }
        world.emit?.("harvest:danger", {
          actor,
          targetId,
          kind: node.kind,
          effect: "hazard",
          hazardId,
        });
      }

      // Stash yield info for afterInteract.
      ctx.data.count = count;
      ctx.data.resultItemId = resultItemId;
    },

    afterInteract(ctx) {
      if (ctx.data.plantMode) return; // planting handled in onInteract
      const { world, actor, targetId } = ctx;
      const node = ctx.data.node;

      // Start regrowth countdown (or mark for replanting if crop).
      world.mutate(targetId, HarvestNode, (n) => {
        n.ready = false;
        if (n.replantable) {
          n.needsPlanting = true;
          n.regrowCountdown = 0;
        } else {
          n.regrowCountdown = n.regrowTurns;
        }
      });

      // Reset visual to bare soil (stage 0) immediately on harvest.
      const gs = world.get(targetId, GrowthStage);
      if (gs && gs.currentStage !== 0) {
        world.mutate(targetId, GrowthStage, (r) => {
          r.currentStage = 0;
        });
        const bareIdentity = gs.stageIdentities?.[0];
        if (bareIdentity) {
          const ni = world.get(targetId, NamedIdentity);
          if (ni) {
            world.set(targetId, NamedIdentity, {
              ...ni,
              identity: bareIdentity,
            });
          }
        }
      }

      // Chopped trees and picked mushrooms become walkable.
      if (node.kind === "tree" || node.kind === "mushrooms") {
        const col = world.get(targetId, Collider);
        if (col) {
          world.set(targetId, Collider, { solid: false, blocksSight: false });
        }
      }
      // Picked dungeon mushrooms should visually disappear until regrowth.
      if (node.kind === "mushrooms") {
        const ni = world.get(targetId, NamedIdentity);
        if (ni) {
          world.set(targetId, NamedIdentity, {
            ...ni,
            identity: "mushrooms_picked",
          });
        }
      }
      // Ore veins and plant nodes: disable collider and swap to exhausted glyph.
      const exhaustedIdentity = HARVEST_EXHAUSTED_IDENTITY[node.kind];
      if (exhaustedIdentity) {
        const col = world.get(targetId, Collider);
        if (col) world.set(targetId, Collider, { solid: false, blocksSight: false });
        const ni = world.get(targetId, NamedIdentity);
        if (ni) world.set(targetId, NamedIdentity, { ...ni, identity: exhaustedIdentity });
      }

      world.emit?.("harvest:picked", {
        actor,
        targetId,
        kind: node.kind,
        count: ctx.data.count,
        itemId: ctx.data.resultItemId,
        regrowTurns: node.regrowTurns,
      });

      // Always drop a seed for replantable crops.
      if (node.replantable) {
        const seedCatalogId = SEED_ITEM_IDS[node.kind];
        if (seedCatalogId) {
          const seedEntity = createItemById(world, seedCatalogId);
          if (seedEntity) {
            addToInventory(world, actor, seedEntity);
            world.emit?.("harvest:seed_drop", {
              actor,
              targetId,
              kind: node.kind,
              seedItemId: seedCatalogId,
            });
          }
        }
      }

      const bonusDrop = HARVEST_BONUS_DROPS[node.kind];
      if (bonusDrop?.itemId) {
        const seed = (((world.seed >>> 0) ^ Math.imul((targetId | 0), HARVEST_BONUS_DROP_SALT) ^ Math.imul((world.step | 0), 0x9e3779b9)) >>> 0);
        const rng = createRng(seed);
        if (rng.next() < Number(bonusDrop.chance || 0)) {
          const bonusItemId = createItemById(world, bonusDrop.itemId);
          if (bonusItemId) {
            addToInventory(world, actor, bonusItemId);
            world.emit?.("harvest:bonus_drop", {
              actor,
              targetId,
              kind: node.kind,
              itemId: bonusItemId,
              identity: bonusDrop.itemId,
              count: Math.max(1, Number(bonusDrop.count || 1) | 0),
            });
          }
        }
      }
    },
  },

  // ── Urns ───────────────────────────────────────────────────────────────────

  breakUrn: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const pos = world.get(targetId, Position);
      if (pos) {
        // Resolve bonus loot from the urn table (jewelry / gem).
        const urnSeed = ((world.seed >>> 0) ^ (((targetId | 0) * 0x9e3779b9) >>> 0) ^ 0xA5E5) >>> 0;
        const rng = createRng(urnSeed);
        let depth = 1;
        for (const [, ds] of world.query(DungeonState)) { depth = ds.currentDepth || 1; break; }
        const drops = resolveLootTable("urn:contents", rng, depth);

        // Ashes always present at stack bottom.
        const ashId = createFrom(world, Ashes, {});
        world.add(ashId, Position, { x: pos.x, y: pos.y });

        // Materialize all drops, then stamp GroundStackOrder sorted by value
        // so the most valuable item renders on top and appears first in pickup.
        const dropEntities = [];
        for (const drop of drops) {
          const eid = materializeDrop(world, drop, pos);
          if (eid != null) dropEntities.push(eid);
        }
        dropEntities.sort((a, b) => {
          const va = Number(world.get(a, ItemInfo)?.value || 0);
          const vb = Number(world.get(b, ItemInfo)?.value || 0);
          return va - vb; // ascending: least valuable first, most valuable last
        });
        for (let i = 0; i < dropEntities.length; i++) {
          world.add(dropEntities[i], GroundStackOrder, { seq: i + 1 });
          const dp = world.get(dropEntities[i], Position);
          if (dp) {
            world.emit?.("item:dropped", {
              itemId: dropEntities[i],
              actor,
              source: "urn",
              origin: { x: pos.x, y: pos.y },
              at: { x: dp.x, y: dp.y },
              targetId,
            });
          }
        }
      }
      world.emit?.("urn:broken", { actor, targetId });
      try {
        world.destroy(targetId);
      } catch {}
    },
  },

  // ── Webs ───────────────────────────────────────────────────────────────────

  clearWeb: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const targetPos = world.get(targetId, Position);
      world.emit?.("web:cleared", { actor, targetId });

      if (targetPos && actorHasFieryWieldedWeapon(world, actor)) {
        if (!hasFloorFireHazardAt(world, targetPos.x, targetPos.y)) {
          const hazardId = spawnHazard(world, {
            x: targetPos.x,
            y: targetPos.y,
            kind: "fire",
            medium: "floor",
            turnsLeft: 2,
            radius: 0,
            tickDamage: 1,
            damageType: "fire",
            cause: "weapon_web_ignite",
            sourceId: actor,
            sourceKind: "weapon",
            identity: "weapon_web_fire",
            name: "Burning Web",
            meta: { source: "weapon_web_ignite", fireSpreadChance: 0.45, fireSpreadTurns: 2 },
          });
          world.emit?.("web:ignited", { actor, targetId, hazardId, at: { x: targetPos.x, y: targetPos.y } });
        }
        return;
      }

      if (targetPos) {
        const toDestroy = [];
        for (const [id, ni, pos] of world.query(NamedIdentity, Position)) {
          if (ni?.identity !== "web") continue;
          if (pos.x !== targetPos.x || pos.y !== targetPos.y) continue;
          toDestroy.push(id);
        }
        for (let i = 0; i < toDestroy.length; i++) {
          try {
            world.destroy(toDestroy[i]);
          } catch {}
        }
        return;
      }

      try {
        world.destroy(targetId);
      } catch {}
    },
  },

  // ── Sarcophagus ────────────────────────────────────────────────────────────
  //
  // One-time interaction: disturbing the sarcophagus awakens its occupant.
  // Removes Interactable so it cannot be triggered again.

  openSarcophagus: {
    onInteract(ctx) {
      const { world, actor, targetId, params } = ctx;
      const pos = world.get(targetId, Position);
      if (!pos) return;

      const depth = ((params?.depth) | 0) || 1;

      // Scale the undead guardian by depth tier.
      let name,
        identity,
        maxHp,
        accuracyDerived,
        damagePowerDerived,
        evadeDerived,
        naturalDamageDice,
        count;
      if (depth >= 13) {
        name = "Skeleton Lord";
        identity = "skeleton_lord";
        maxHp = 50;
        accuracyDerived = 20;
        damagePowerDerived = 20;
        evadeDerived = 12;
        naturalDamageDice = "2d8";
        count = 2;
      } else if (depth >= 9) {
        name = "Skeleton Champion";
        identity = "skeleton_champion";
        maxHp = 35;
        accuracyDerived = 14;
        damagePowerDerived = 14;
        evadeDerived = 8;
        naturalDamageDice = "2d6";
        count = 2;
      } else if (depth >= 5) {
        name = "Skeleton Warrior";
        identity = "skeleton_warrior";
        maxHp = 20;
        accuracyDerived = 8;
        damagePowerDerived = 8;
        evadeDerived = 4;
        naturalDamageDice = "1d8";
        count = 1;
      } else {
        // ~33% chance of a skeleton archer at low depths
        const seed = combatSeed(world.seed, world.step, targetId, 0x5A5C);
        const isArcher = mulberry32(seed)() < 0.33;
        if (isArcher) {
          name = "Skeleton Archer";
          identity = "skeleton_archer";
          maxHp = 6;
          accuracyDerived = 2;
          damagePowerDerived = 2;
          evadeDerived = 0;
          naturalDamageDice = "1d4";
          count = 1;
        } else {
          name = "Skeleton";
          identity = "skeleton";
          maxHp = 12;
          accuracyDerived = 4;
          damagePowerDerived = 4;
          evadeDerived = 2;
          naturalDamageDice = "1d6";
          count = 1;
        }
      }

      // Build list of adjacent offsets, excluding the player's tile.
      const actorPos = world.get(actor, Position);
      const ADJACENT = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      const safeSlots = actorPos
        ? ADJACENT.filter(o => pos.x + o.dx !== actorPos.x || pos.y + o.dy !== actorPos.y)
        : ADJACENT;

      for (let i = 0; i < count; i++) {
        const pool = safeSlots.length > 0 ? safeSlots : ADJACENT;
        const { dx, dy } = pool[i % pool.length];
        const eid = createFrom(world, Monster, {
          x: pos.x + dx,
          y: pos.y + dy,
          name,
          identity,
          faction: "enemy",
          maxHp,
          accuracyDerived,
          damagePowerDerived,
          evadeDerived,
          naturalDamageDice,
          speed: 1,
        });
        if (identity === "skeleton_archer") {
          equipMonster(world, eid, { ranged: "bow_short", ammo: "arrows" });
        }
      }

      world.emit?.("sarcophagus:opened", {
        actor,
        targetId,
        depth,
        spawned: count,
      });
    },
    afterInteract(ctx) {
      const { world, targetId, params } = ctx;
      const depth = ((params?.depth) | 0) || 1;

      // Make the sarcophagus walkable so the player can step onto it.
      try {
        world.mutate(targetId, Collider, c => { c.solid = false; });
      } catch {}

      // Convert to a lootable container — stock burial goods inside.
      try { world.remove(targetId, Interactable); } catch {}
      if (!world.has(targetId, Inventory)) {
        world.add(targetId, Inventory, { capacity: 20 });
      }
      const pos = world.get(targetId, Position);
      if (pos) {
        const sarcSeed = ((world.seed >>> 0) ^ (((targetId | 0) * 0x9e3779b9) >>> 0) ^ 0x5A5C) >>> 0;
        const rng = createRng(sarcSeed);
        const drops = resolveLootTable("sarcophagus:contents", rng, depth);
        const dummyPos = { x: 0, y: 0 };
        for (const drop of drops) {
          const eid = materializeDrop(world, drop, dummyPos);
          if (eid != null) {
            try { world.remove(eid, Position); } catch {}
            addToInventory(world, targetId, eid);
          }
        }
      }
    },
  },

  // ── Portcullis ─────────────────────────────────────────────────────────────

  bumpPortcullis: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const os = world.get(targetId, ObjectState);
      const isRaised = os?.state === "raised";

      if (isRaised) {
        // Gate is open, no message needed
        return;
      }

      // Gate is lowered — player bumped it. Emit a message.
      const messages = [
        "The gate is closed.",
        "Hmm, closed.",
        "It feels closed. Maybe something opens this.",
        "You pull at the bars. It's shut.",
        "You have a sneaky suspicion this is opened elsewhere.",
        "The portcullis won't budge.",
        "Locked in place by some mechanism.",
      ];

      const messageIdx = (world.step || 0) % messages.length;
      const message = messages[messageIdx];

      world.emit?.("bump:message", {
        actor,
        targetId,
        message,
      });
    },
  },
};

// ─── Altar offer helper ───────────────────────────────────────────────────────

function _altarExecuteOffer(world, actor, targetId, itemId) {
  if (!inventoryContains(world, actor, itemId)) {
    world.emit?.("altar:offerFailed", {
      actor,
      targetId,
      itemId,
      reason: "not_owned",
    });
    return;
  }
  const eq = world.get(actor, Equipment);
  if (eq && GEAR_SLOTS.some(s => eq[s] === itemId)) {
    world.emit?.("altar:offerFailed", {
      actor,
      targetId,
      itemId,
      reason: "equipped",
    });
    return;
  }
  const info = world.get(itemId, ItemInfo);
  const ident = world.get(itemId, NamedIdentity);
  const beatitude = world.get(itemId, Beatitude);
  const owner = world.get(itemId, Owner);
  const rawValue = (info?.value || 0) * Math.max(1, info?.count || 1);
  const value = Math.min(
    1,
    Math.max(0.05, rawValue > 0 ? rawValue / 200 : 0.1),
  );
  const itemName = ident?.name || info?.name || info?.description || "item";
  const itemIdentity = String(ident?.identity || "");
  const beatitudeState = String(beatitude?.state || "").toLowerCase();
  removeFromInventory(world, actor, itemId);
  try {
    world.destroy(itemId);
  } catch {}
  // Emit altar:offer so the deity system records the offering and emits altar:offered.
  world.emit?.("altar:offer", {
    actor,
    targetId,
    itemId,
    itemName,
    itemIdentity,
    ownerId: Number(owner?.ownerId || 0),
    beatitudeState,
    value,
  });
  world.emit?.("prayer", {
    actor,
    distress: null,
    altarBonus: true,
    offered: true,
    itemValue: value,
  });
}
