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
  inventoryItems,
  inventoryContains,
  addToInventory,
  removeFromInventory,
  hasCapacity,
  consumeFromStack,
  getStackCount,
} from "../../utils/inventoryFacade.js";
import { Vitality } from "../../components/Vitality.js";
import { Mana } from "../../components/Mana.js";
import { Stamina } from "../../components/Stamina.js";
import { ShopInventory } from "../../components/ShopInventory.js";
import { HarvestNode } from "../../components/HarvestNode.js";
import { GrowthStage } from "../../components/GrowthStage.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Equipment } from "../../components/Equipment.js";
import { Position } from "../../components/Position.js";
import { ItemInfo } from "../../components/ItemInfo.js";
import { Interactable } from "../../components/Interactable.js";
import { ObjectState } from "../../components/ObjectState.js";
import { DistrictProfile } from "../../components/DistrictProfile.js";
import { DistrictState } from "../../components/DistrictState.js";
import { DungeonState } from "../../components/DungeonState.js";
import TombstoneComponent from "../../components/Tombstone.js";
import { createFrom } from "../../../lib/ecs-js/archetype.js";
import {
  WildBerries, WildHerbs, ThornPods, VenomFronds, Moonleaf, EmberRoot,
  DungeonMushrooms, IronOre, CoalOre, StoneChip,
  Wheat, Carrot, Corn,
} from "../../archetypes/Food.js";
import { LumberBundle } from "../../archetypes/TownGoods.js";
import { Monster } from "../../archetypes/Creatures.js";
import { equipMonster } from "../../environment/dungeon/populate.js";
import { combatSeed, mulberry32 } from "../../utils/rng.js";
import { spawnHazard } from "../../utils/hazardSpawn.js";
import { dealDamage } from "../../utils/dealDamage.js";
import { getCatalogItem } from "../../data/itemCatalog.js";
import { Ashes } from "../../archetypes/Items.js";
import { Encumbrance } from "../../components/Encumbrance.js";
import { brewAtAlchemyBench, emitAlchemyBenchOpen } from "../alchemy/benchGame.js";
import { cookAtFire, emitCookingFireOpen } from "../cooking/cookingGame.js";
import { emitAnvilOpen, forgeAtAnvil } from "../smithing/anvilGame.js";
import { createItemById } from "../../utils/itemFactory.js";
import { actorHasDoorKey, setDoorState } from "../../utils/doorAccess.js";
import { getDistrictBulletinVirtual, getPlayerOpportunityViewVirtual } from "../../utils/townInterpretationVirtuals.js";

// Maps catalog item IDs → archetypes for harvest yield entity creation.
const CATALOG_ARCHETYPES = {
  "food_wild_berries":   WildBerries,
  "food_wild_herbs":     WildHerbs,
  "food_mushrooms":      DungeonMushrooms,
  "reagent_thorn_pod":   ThornPods,
  "reagent_venom_frond": VenomFronds,
  "reagent_moonleaf":    Moonleaf,
  "reagent_ember_root":  EmberRoot,
  "ore_iron":            IronOre,
  "ore_coal":            CoalOre,
  "ore_stone":           StoneChip,
  "food_wheat":          Wheat,
  "food_carrot":         Carrot,
  "food_corn":           Corn,
  "material_lumber":     LumberBundle,
};

const HARVEST_SEED_SALT = 0x48415256;
const SEED_DROP_SALT = 0x5345ED01;

function isEntityOnCurrentFloor(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) return false;
  for (const [, ds] of world.query(DungeonState)) {
    return Array.isArray(ds?.floorEntityIds) && ds.floorEntityIds.includes(id);
  }
  return false;
}
const SEED_ITEM_IDS = Object.freeze({
  wheat: "seed_wheat",
  carrot: "seed_carrot",
  corn: "seed_corn",
});
const FOUNTAIN_MIN_CHARGES = 2;
const FOUNTAIN_MAX_CHARGES = 4;
const FOUNTAIN_COOLDOWN_MIN = 201;
const FOUNTAIN_COOLDOWN_MAX = 259;
function deriveFountainCooldownTurns(world, targetId, params) {
  const explicit = Number(params?.cooldownTurns);
  if (Number.isFinite(explicit) && explicit > 0) return explicit | 0;

  const seed = ((world.seed >>> 0) ^ (((targetId | 0) * 0xc2b2ae35) >>> 0) ^ 0xF0CD) >>> 0;
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
    const modeSeed = ((world.seed >>> 0) ^ (((targetId | 0) * 0x85ebca6b) >>> 0) ^ 0xF0AD) >>> 0;
    primaryEffect = mulberry32(modeSeed)() < 0.5 ? "heal" : "mana";
    changed = true;
  }

  if (!Number.isFinite(charges) || charges < 0) {
    const seed = ((world.seed >>> 0) ^ (((targetId | 0) * 0x9e3779b9) >>> 0) ^ 0xF017) >>> 0;
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

  return { inter, params, charges, maxCharges, primaryEffect, cooldownTurns, dryUntilStep };
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
  params.chargesRemaining = Math.max(0, Number(params.chargesRemaining || 0) | 0);
  if (!Number.isFinite(Number(params.maxCharges)) || Number(params.maxCharges) <= 0) {
    params.maxCharges = Math.max(1, params.chargesRemaining | 0);
  }
  world.set(targetId, Interactable, { action: inter.action, params });
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
    try { world.destroy(itemId); } catch {}
  }
  return true;
}

function giveCraftedItem(world, ownerId, itemId) {
  const createdId = createItemById(world, itemId);
  if (!(createdId > 0)) return 0;
  if (world.has(ownerId, Inventory) && addToInventory(world, ownerId, createdId)) return createdId;
  const pos = world.get(ownerId, Position);
  if (pos) world.add(createdId, Position, { x: pos.x, y: pos.y });
  return createdId;
}

function smeltOreAtFurnace(world, actor, targetId) {
  if (!world.has(actor, Inventory)) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "no_inventory", station: "furnace" });
    return;
  }
  const oreCount = getStackCount(world, actor, "ore_iron");
  const coalCount = getStackCount(world, actor, "ore_coal");
  if (oreCount <= 0) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "missing_ore", station: "furnace" });
    return;
  }
  if (coalCount <= 0) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "missing_fuel", station: "furnace" });
    return;
  }
  if (!consumeIdentityUnits(world, actor, "ore_iron", 1) || !consumeIdentityUnits(world, actor, "ore_coal", 1)) {
    world.emit?.("smithy:failed", { actor, targetId, reason: "consume_failed", station: "furnace" });
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
        world.emit?.("interaction", { actor, targetId, action: "toggleDoor", result: "locked" });
        ctx.cancel("LOCKED", "The door is locked.");
      }
    },
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const ds = world.get(targetId, DoorState);
      const nowOpen = !(ds?.open);
      setDoorState(world, targetId, {
        open: nowOpen,
        locked: nowOpen ? false : !!ds?.locked,
      }, actor);
    },
  },

  // ── Chests / containers ────────────────────────────────────────────────────

  openChest: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      if (world.has(targetId, Inventory)) {
        world.emit?.("chest:open", {
          actor,
          targetId,
          chestItems: inventoryItems(world, targetId),
        });
      }
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
      world.emit?.("npc:dialogue", { actor, targetId, text: params?.dialogue || "..." });
    },
  },

  // ── Signs & text ───────────────────────────────────────────────────────────

  readText: {
    onInteract(ctx) {
      const { world, actor, targetId, params } = ctx;
      world.emit?.("interaction", { actor, targetId, action: "readText", textId: params?.textId });
    },
  },

  readTownBulletin: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const districtBulletinVirtual = getDistrictBulletinVirtual(world);
      const playerOpportunityVirtual = getPlayerOpportunityViewVirtual(world);
      const districts = [];
      for (const [districtId] of world.query(DistrictProfile, DistrictState)) {
        const bulletin = districtBulletinVirtual ? world.vget(districtId, districtBulletinVirtual) : null;
        if (bulletin) districts.push(bulletin);
      }
      districts.sort((a, b) => String(a?.label || "").localeCompare(String(b?.label || "")));
      const opportunityView = playerOpportunityVirtual ? world.vget(actor, playerOpportunityVirtual) : null;
      world.emit?.("town:bulletinBoard", { actor, targetId, districts, opportunityView });
    },
  },

  readTombstone: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const tombstone = world.get(targetId, TombstoneComponent);
      if (tombstone) {
        world.emit?.("interaction", {
          actor, targetId,
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
        to:   { x: dropPos.x, y: dropPos.y },
      });

      // Rack is now passable — player can walk through it.
      const col = world.get(targetId, Collider);
      if (col) world.set(targetId, Collider, { solid: false, blocksSight: col.blocksSight });

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
        world.emit?.("mill:failed", { actor, targetId, reason: "no_inventory" });
        return;
      }
      const wheatCount = getStackCount(world, actor, "food_wheat");
      if (wheatCount <= 0) {
        world.emit?.("mill:failed", { actor, targetId, reason: "missing_wheat" });
        return;
      }
      if (!consumeIdentityUnits(world, actor, "food_wheat", 1)) {
        world.emit?.("mill:failed", { actor, targetId, reason: "consume_failed" });
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
      const oreCount = hasInventory ? getStackCount(world, actor, "ore_iron") : 0;
      const coalCount = hasInventory ? getStackCount(world, actor, "ore_coal") : 0;
      if (oreCount > 0 && coalCount > 0) {
        smeltOreAtFurnace(world, actor, targetId);
        return;
      }
      const os = world.get(targetId, ObjectState);
      const nowLit = os?.state !== "lit";
      if (os) world.set(targetId, ObjectState, { state: nowLit ? "lit" : "unlit" });
      world.emit?.("interaction", {
        actor, targetId,
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
      if (os) world.set(targetId, ObjectState, { state: nowLit ? "lit" : "unlit" });
      world.emit?.("interaction", {
        actor, targetId,
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
      if (vit) world.set(actor, Vitality, { maxHp: vit.maxHp, hp: vit.maxHp });
      const mana = world.get(actor, Mana);
      if (mana) world.set(actor, Mana, { ...mana, mana: mana.maxMana });
      const stamina = world.get(actor, Stamina);
      if (stamina) world.set(actor, Stamina, { ...stamina, stamina: stamina.maxStamina, regenCooldown: 0 });
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
          actor, targetId,
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
          actor, targetId,
          buyMarkup: shop.buyMarkup ?? 1.5,
          sellDiscount: shop.sellDiscount ?? 0.5,
          vendorKind: "gem",
        });
      }
    },
  },

  // ── Stairs ─────────────────────────────────────────────────────────────────
  // Traversal is owned by the UI/app layer (tooltip tap / Enter key).
  // These entries exist so the interactable component is valid and the system
  // returns true, but they are intentional no-ops in the rules layer.

  descendStair: { onInteract() {} },
  ascendStair:  { onInteract() {} },

  // ── Well ───────────────────────────────────────────────────────────────────

  drinkWell: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const stamina = world.get(actor, Stamina);
      if (stamina) {
        const restoreAmt = Math.floor(stamina.maxStamina * 0.3);
        const prev = stamina.stamina;
        const next = Math.min(stamina.maxStamina, prev + restoreAmt);
        world.set(actor, Stamina, { ...stamina, stamina: next, regenCooldown: 0 });
        world.emit?.("well:drink", { actor, targetId, amount: next - prev });
      } else {
        world.emit?.("well:drink", { actor, targetId, amount: 0 });
      }
    },
  },

  // ── Fountain ───────────────────────────────────────────────────────────────

  drinkFountain: {
    beforeInteract(ctx) {
      const { world, actor, targetId } = ctx;
      if (!world.get(actor, Vitality)) {
        ctx.cancel("NO_VITALITY", "Actor has no vitality component.");
      }
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
          dryUntilStep: dryUntilStep >= 0 ? dryUntilStep : ((Number(world.step || 0) | 0) + cooldownTurns),
        });
        ctx.cancel("FOUNTAIN_DRY", "The fountain has run dry.");
      }
    },
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      const state = ensureFountainState(world, targetId);
      const charges = Number(state?.charges || 0);
      const primaryEffect = String(state?.primaryEffect || "heal");
      if (charges <= 0) return;

      const vit = world.get(actor, Vitality);
      const fSeed = combatSeed(world.seed, world.step, actor | 0, targetId | 0, 0xF0C5);
      const r = mulberry32(fSeed);
      const roll = r();

      if (roll < 0.75) {
        if (primaryEffect === "heal") {
          const healAmt = Math.max(1, Math.floor(vit.maxHp * (0.2 + r() * 0.2)));
          const newHp = Math.min(vit.maxHp, vit.hp + healAmt);
          world.set(actor, Vitality, { maxHp: vit.maxHp, hp: newHp });
          world.emit?.("fountain:drink", { actor, targetId, effect: "heal", amount: healAmt });
        } else {
          const mana = world.get(actor, Mana);
          if (mana && mana.maxMana > 0) {
            const amt = Math.max(1, Math.floor(mana.maxMana * 0.3));
            world.set(actor, Mana, { ...mana, mana: Math.min(mana.maxMana, mana.mana + amt) });
            world.emit?.("fountain:drink", { actor, targetId, effect: "mana", amount: amt });
          } else {
            world.emit?.("fountain:drink", { actor, targetId, effect: "nothing", amount: 0 });
          }
        }
      } else if (roll < 0.90) {
        world.emit?.("fountain:drink", { actor, targetId, effect: "nothing", amount: 0 });
      } else {
        const mana = world.get(actor, Mana);
        const dmgAmt = Math.max(1, Math.floor(vit.maxHp * (0.05 + r() * 0.05)));
        dealDamage(world, {
          target: actor,
          amount: dmgAmt,
          type: "poison",
          source: targetId,
          cause: "fountain",
        });
        world.emit?.("fountain:drink", { actor, targetId, effect: "poison", amount: dmgAmt });
      }

      const nextCharges = Math.max(0, charges - 1);
      if (nextCharges <= 0) {
        const cooldownTurns = Math.max(1, Number(state?.cooldownTurns || 1) | 0);
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

      if (String(intent?.mode || "").toLowerCase() === "offer" && (intent?.itemId | 0) > 0) {
        _altarExecuteOffer(world, actor, targetId, intent.itemId | 0);
        return;
      }

      // Phase 1 — collect offerable items and prompt the UI.
      const offerableItems = [];
      for (const iid of inventoryItems(world, actor)) {
        if (!world.isAlive(iid)) continue;
        if (!world.get(iid, ItemInfo)) continue;
        offerableItems.push(iid);
      }
      world.emit?.("altar:offerPrompt", { actor, targetId, items: offerableItems });
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
          actor, targetId,
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
            actor, targetId, kind: node.kind, requiredTool: node.requiresTool,
          });
          ctx.cancel("NO_TOOL");
          return;
        }
        const stam = world.get(actor, Stamina);
        const cost = Number(wInfo.staminaCost ?? 25);
        if (stam && Number(stam.stamina ?? 0) < cost) {
          world.emit?.("harvest:no_stamina", { actor, targetId, kind: node.kind, cost });
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
        try { world.destroy(ctx.data.seedEntityId); } catch {}
        world.mutate(targetId, HarvestNode, (n) => {
          n.needsPlanting = false;
          n.regrowCountdown = n.regrowTurns;
        });
        world.emit?.("seed:planted", { actor, targetId, kind: node.kind });
        return;
      }

      const r = mulberry32(combatSeed(world.seed, world.step, actor | 0, targetId | 0, HARVEST_SEED_SALT));
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
        world.mutate(itemId, ItemInfo, (rec) => { rec.count = count; });
        resultItemId = itemId;

        if (!overweight && !overCapacity) {
          addToInventory(world, actor, itemId);
        } else {
          if (actorPos) world.add(itemId, Position, { x: actorPos.x, y: actorPos.y });
          world.emit?.("harvest:overweight", {
            actor, targetId, kind: node.kind, count,
            reason: overweight ? "weight" : "capacity",
          });
        }
      }

      // Danger and hazard side-effects (fully data-driven from HarvestNode component).
      const actorPos = world.get(actor, Position);
      if (node.danger) {
        const dmg = node.danger.dmgMin + ((r() * (node.danger.dmgMax - node.danger.dmgMin + 1)) | 0);
        const hit = dealDamage(world, {
          target: actor,
          amount: dmg,
          type: node.danger.type || "physical",
          source: targetId,
          cause: node.danger.cause || node.kind,
          at: actorPos ? { x: actorPos.x, y: actorPos.y } : undefined,
        });
        world.emit?.("harvest:danger", {
          actor, targetId, kind: node.kind,
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
        world.emit?.("harvest:danger", { actor, targetId, kind: node.kind, effect: "hazard", hazardId });
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
        world.mutate(targetId, GrowthStage, (r) => { r.currentStage = 0; });
        const bareIdentity = gs.stageIdentities?.[0];
        if (bareIdentity) {
          const ni = world.get(targetId, NamedIdentity);
          if (ni) world.set(targetId, NamedIdentity, { ...ni, identity: bareIdentity });
        }
      }

      // Chopped trees become walkable stumps.
      if (node.kind === "tree") {
        const col = world.get(targetId, Collider);
        if (col) world.set(targetId, Collider, { solid: false, blocksSight: false });
      }

      world.emit?.("harvest:picked", {
        actor, targetId,
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
            world.emit?.("harvest:seed_drop", { actor, targetId, kind: node.kind, seedItemId: seedCatalogId });
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
        const ashId = createFrom(world, Ashes, {});
        world.add(ashId, Position, { x: pos.x, y: pos.y });
      }
      world.emit?.("urn:broken", { actor, targetId });
      try { world.destroy(targetId); } catch {}
    },
  },

  // ── Webs ───────────────────────────────────────────────────────────────────

  clearWeb: {
    onInteract(ctx) {
      const { world, actor, targetId } = ctx;
      world.emit?.("web:cleared", { actor, targetId });
      try { world.destroy(targetId); } catch {}
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
      let name, identity, maxHp, attackDerived, defenseDerived, naturalDamageDice, count;
      if (depth >= 13) {
        name = "Skeleton Lord";     identity = "skeleton_lord";
        maxHp = 50; attackDerived = 20; defenseDerived = 12; naturalDamageDice = "2d8"; count = 2;
      } else if (depth >= 9) {
        name = "Skeleton Champion"; identity = "skeleton_champion";
        maxHp = 35; attackDerived = 14; defenseDerived = 8;  naturalDamageDice = "2d6"; count = 2;
      } else if (depth >= 5) {
        name = "Skeleton Warrior";  identity = "skeleton_warrior";
        maxHp = 20; attackDerived = 8;  defenseDerived = 4;  naturalDamageDice = "1d8"; count = 1;
      } else {
        // ~33% chance of a skeleton archer at low depths
        const seed = combatSeed(world.seed, world.step, targetId, 0x5A5C);
        const isArcher = (mulberry32(seed)() < 0.33);
        if (isArcher) {
          name = "Skeleton Archer"; identity = "skeleton_archer";
          maxHp = 6;  attackDerived = 2;  defenseDerived = 0;  naturalDamageDice = "1d4"; count = 1;
        } else {
          name = "Skeleton";        identity = "skeleton";
          maxHp = 12; attackDerived = 4;  defenseDerived = 2;  naturalDamageDice = "1d6"; count = 1;
        }
      }

      for (let i = 0; i < count; i++) {
        // Spawn adjacent to the sarcophagus, never on top of it.
        const ADJACENT = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
        const { dx, dy } = ADJACENT[i % ADJACENT.length];
        const eid = createFrom(world, Monster, {
          x: pos.x + dx, y: pos.y + dy,
          name, identity, faction: "enemy",
          maxHp, attackDerived, defenseDerived, naturalDamageDice, speed: 1,
        });
        if (identity === "skeleton_archer") {
          equipMonster(world, eid, { ranged: "bow_short", ammo: "arrows" });
        }
      }

      world.emit?.("sarcophagus:opened", { actor, targetId, depth, spawned: count });
    },
    afterInteract(ctx) {
      // One-time use — the sarcophagus can never be disturbed again.
      try { ctx.world.remove(ctx.targetId, Interactable); } catch {}
    },
  },

};

// ─── Altar offer helper ───────────────────────────────────────────────────────

function _altarExecuteOffer(world, actor, targetId, itemId) {
  if (!inventoryContains(world, actor, itemId)) {
    world.emit?.("altar:offerFailed", { actor, targetId, itemId, reason: "not_owned" });
    return;
  }
  const info = world.get(itemId, ItemInfo);
  const rawValue = (info?.value || 0) * Math.max(1, info?.count || 1);
  const value = Math.min(1, Math.max(0.05, rawValue > 0 ? rawValue / 200 : 0.1));
  const itemName = info?.name || info?.description || "item";
  removeFromInventory(world, actor, itemId);
  try { world.destroy(itemId); } catch {}
  // Emit altar:offer so the deity system records the offering and emits altar:offered.
  world.emit?.("altar:offer", { actor, targetId, itemName, value });
  world.emit?.("prayer", { actor, distress: null, altarBonus: true, offered: true, itemValue: value });
}
