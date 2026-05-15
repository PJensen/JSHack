import { createFrom } from "../../lib/ecs-js/archetype.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import { Monster } from "../archetypes/Creatures.js";
import { Equipment, GEAR_SLOT_SET } from "../components/Equipment.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Mana } from "../components/Mana.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { SleepState } from "../components/SleepState.js";
import { ScriptState } from "../components/ScriptState.js";
import { getCatalogItem } from "../data/itemCatalog.js";
import { getMonster } from "../data/monsters.js";
import { resolveSleepProfile } from "../data/sleepProfiles.js";
import { addToInventory } from "./inventoryFacade.js";
import { createItemById } from "./itemFactory.js";

function normalizeAmmoItemId(id) {
  const key = String(id || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "arrows") return "ammo_arrows";
  if (key === "fire_arrows") return "ammo_fire_arrows";
  if (key === "piercing_arrows") return "ammo_piercing_arrows";
  if (key === "bodkin_arrows") return "ammo_bodkin_arrows";
  if (key === "blunt_arrows" || key === "blunt_head_arrows") return "ammo_blunt_arrows";
  return key;
}

function normalizeLoadoutEntry(entry) {
  if (typeof entry === "string") {
    const itemId = String(entry || "").trim();
    if (!itemId) return null;
    return { itemId, slot: "", affixes: [], count: 1 };
  }
  if (!entry || typeof entry !== "object") return null;
  const itemId = String(entry.itemId || entry.id || "").trim();
  if (!itemId) return null;
  const slot = String(entry.slot || "").trim().toLowerCase();
  const affixes = Array.isArray(entry.affixes) ? entry.affixes.map((v) => String(v || "")).filter(Boolean) : [];
  const count = Number.isFinite(entry.count) ? Math.max(1, Number(entry.count) | 0) : 1;
  return { itemId, slot, affixes, count };
}

function pickFrom(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[rng.int(0, list.length - 1)] || null;
}

function equipToSlot(eq, slot, itemId) {
  if (!eq || !(itemId > 0)) return;
  if (slot === "ring") {
    if (!(eq.ring1 > 0)) eq.ring1 = itemId;
    else if (!(eq.ring2 > 0)) eq.ring2 = itemId;
    else eq.ring1 = itemId;
    return;
  }
  if (GEAR_SLOT_SET.has(slot)) eq[slot] = itemId;
}

function resolveEntrySlot(world, itemId, requestedSlot) {
  const slot = String(requestedSlot || "").trim().toLowerCase();
  if (slot) return slot;
  return String(world.get(itemId, ItemInfo)?.slot || "").trim().toLowerCase();
}

function inferSlotFromItemId(itemId) {
  const key = String(itemId || "").trim().toLowerCase();
  // Ammo items live outside the equipment catalog; infer slot from ID prefix.
  if (key.startsWith("ammo_")) return "ammo";
  const def = getCatalogItem(key);
  return String(def?.slot || "").trim().toLowerCase();
}

function equipMonsterLoadout(world, entityId, params = {}) {
  const eq = world.get(entityId, Equipment);
  if (!eq) return;

  const identity = String(world.get(entityId, NamedIdentity)?.identity || "");
  const def = identity ? getMonster(identity) : null;
  if (def) {
    const tags = Array.isArray(def.tags) ? def.tags : [];
    const isHumanoid = tags.includes("humanoid");
    const hasAuthoredLoadout = !!def.equipment
      || (Array.isArray(def.wielding) && def.wielding.length > 0)
      || (Array.isArray(def.equipped) && def.equipped.length > 0)
      || (Array.isArray(def.inventory) && def.inventory.length > 0);
    if (!isHumanoid && !hasAuthoredLoadout) return;
  }

  const loadout = (params.equipment && typeof params.equipment === "object") ? params.equipment : {};
  const wielding = Array.isArray(params.wielding) ? params.wielding : (Array.isArray(loadout.wielding) ? loadout.wielding : []);
  const equipped = Array.isArray(params.equipped) ? params.equipped : (Array.isArray(loadout.equipped) ? loadout.equipped : []);
  const inventory = Array.isArray(params.inventory) ? params.inventory : (Array.isArray(loadout.inventory) ? loadout.inventory : []);

  const seed = (
    (world.seed >>> 0)
    ^ (((world.step | 0) * 0x9e3779b9) >>> 0)
    ^ (((entityId | 0) * 0x45d9f3b) >>> 0)
  ) >>> 0;
  const rng = createRng(seed);

  const legacyRanged = String(loadout.ranged || "").trim();
  if (legacyRanged) {
    const rangedId = createItemById(world, legacyRanged);
    if (rangedId > 0) eq.ranged = rangedId;
  }
  const legacyAmmo = normalizeAmmoItemId(loadout.ammo);
  if (legacyAmmo) {
    const ammoId = createItemById(world, legacyAmmo);
    if (ammoId > 0) eq.ammo = ammoId;
  }

  const wieldPool = wielding.map(normalizeLoadoutEntry).filter(Boolean);
  const wieldChoice = pickFrom(rng, wieldPool);
  if (wieldChoice) {
    const wieldId = createItemById(world, wieldChoice.itemId, {
      affixes: wieldChoice.affixes,
      count: wieldChoice.count,
    });
    if (wieldId > 0) {
      const slot = resolveEntrySlot(world, wieldId, wieldChoice.slot) || "weapon";
      equipToSlot(eq, slot, wieldId);
    }
  }

  /** @type {Map<string, Array<{ itemId:string, slot:string, affixes:string[], count:number }>>} */
  const equipBySlot = new Map();
  for (const raw of equipped) {
    const rec = normalizeLoadoutEntry(raw);
    if (!rec) continue;
    const slot = String(rec.slot || inferSlotFromItemId(rec.itemId) || "").trim().toLowerCase();
    if (!slot) continue;
    if (!equipBySlot.has(slot)) equipBySlot.set(slot, []);
    equipBySlot.get(slot).push({ ...rec, slot });
  }

  for (const [slot, options] of equipBySlot) {
    const chosen = pickFrom(rng, options);
    if (!chosen) continue;
    const equipId = createItemById(world, chosen.itemId, {
      affixes: chosen.affixes,
      count: chosen.count,
    });
    if (equipId > 0) equipToSlot(eq, slot, equipId);
  }

  const bagEntries = inventory.map(normalizeLoadoutEntry).filter(Boolean);
  if (bagEntries.length > 0) {
    const inv = world.get(entityId, Inventory);
    if (inv) {
      const nextCap = Math.max(Number(inv.capacity || 0) | 0, bagEntries.length);
      if (nextCap !== (Number(inv.capacity || 0) | 0)) {
        world.set(entityId, Inventory, { ...inv, capacity: nextCap });
      }
    }
  }
  for (const rec of bagEntries) {
    const bagItemId = createItemById(world, rec.itemId, {
      affixes: rec.affixes,
      count: rec.count,
    });
    if (bagItemId > 0) addToInventory(world, entityId, bagItemId, { silent: true });
  }
}

function applyAuthoredSleep(world, entityId, params, def) {
  const authored = params.sleep === false
    ? null
    : (params.sleep || def?.sleep || null);
  const resolved = resolveSleepProfile(authored);
  if (!resolved) return;

  if (resolved.chance <= 0) return;
  if (resolved.chance < 1 && world.rand() >= resolved.chance) return;

  try {
    world.add(entityId, SleepState, {
      asleep: true,
      wakeDifficulty: resolved.wakeDifficulty,
      wakeRadius: resolved.wakeRadius,
      wakeOnDamage: resolved.wakeOnDamage,
    });
  } catch {}
}

/**
 * Canonical monster entity construction shared by debug spawning, dungeon
 * materialization, and runtime spawners.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{
 *   x?: number,
 *   y?: number,
 *   name?: string,
 *   identity?: string,
 *   maxHp?: number,
 *   hp?: number,
 *   faction?: string,
 *   accuracyDerived?: number,
 *   damagePowerDerived?: number,
 *   evadeDerived?: number,
 *   naturalDamageDice?: string,
 *   naturalScript?: string|null,
 *   sizeClass?: string,
 *   massKg?: number,
 *   resistances?: Record<string, unknown>,
 *   speed?: number,
 *   creatureType?: string,
 *   learnedSpellIds?: string[],
 *   maxMana?: number,
 *   mana?: number,
 *   manaRegen?: number,
 *   sleep?: false|string|{ pattern?: string, context?: string, chance?: number }|null,
 *   equipment?: {
 *     ranged?: string,
 *     ammo?: string,
 *     wielding?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 *     equipped?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 *     inventory?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 *   }|null,
 *   wielding?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 *   equipped?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 *   inventory?: Array<string|{ itemId?: string, id?: string, affixes?: string[], count?: number, slot?: string }>,
 * }} params
 * @returns {number}
 */
export function spawnMonsterEntity(world, params = {}) {
  const p = (params && typeof params === "object") ? params : {};
  const id = createFrom(world, Monster, {
    x: Number.isFinite(p.x) ? (Number(p.x) | 0) : 0,
    y: Number.isFinite(p.y) ? (Number(p.y) | 0) : 0,
    name: p.name,
    identity: p.identity,
    maxHp: Number.isFinite(p.maxHp) ? (Number(p.maxHp) | 0) : undefined,
    hp: Number.isFinite(p.hp) ? (Number(p.hp) | 0) : undefined,
    faction: p.faction,
    accuracyDerived: Number.isFinite(p.accuracyDerived)
      ? Number(p.accuracyDerived)
      : undefined,
    damagePowerDerived: Number.isFinite(p.damagePowerDerived)
      ? Number(p.damagePowerDerived)
      : undefined,
    evadeDerived: Number.isFinite(p.evadeDerived)
      ? Number(p.evadeDerived)
      : undefined,
    naturalDamageDice: p.naturalDamageDice,
    naturalScript: p.naturalScript ?? null,
    sizeClass: p.sizeClass,
    massKg: Number.isFinite(p.massKg) ? Number(p.massKg) : undefined,
    resistances: (p.resistances && typeof p.resistances === "object") ? { ...p.resistances } : undefined,
    speed: Number.isFinite(p.speed) ? Number(p.speed) : undefined,
    creatureType: p.creatureType,
    learnedSpellIds: Array.isArray(p.learnedSpellIds) ? p.learnedSpellIds.slice() : undefined,
  });

  const maxMana = Number.isFinite(p.maxMana) ? Math.max(0, Number(p.maxMana) | 0) : 0;
  if (maxMana > 0) {
    const mana = Number.isFinite(p.mana) ? (Number(p.mana) | 0) : maxMana;
    const manaRegen = Number.isFinite(p.manaRegen) ? Number(p.manaRegen) : 0.1;
    try {
      world.add(id, Mana, {
        maxMana,
        mana: Math.max(0, Math.min(maxMana, mana)),
        manaRegen,
        regenCooldown: 0,
      });
    } catch {}
  }

  equipMonsterLoadout(world, id, p);

  // Content-DSL: attach ScriptState if the monster def has local state
  const mdef = p.identity ? getMonster(p.identity) : null;
  applyAuthoredSleep(world, id, p, mdef);
  if (mdef?._contentState) {
    try { world.add(id, ScriptState, { data: { ...mdef._contentState } }); } catch {}
  }

  return id;
}
