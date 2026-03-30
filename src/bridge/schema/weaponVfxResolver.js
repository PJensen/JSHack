// bridge/schema/weaponVfxResolver.js
// Resolves equipped-weapon VFX projections from canonical profile data.

import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { listWeaponVfxProfiles } from "./weaponVfxProfiles.js";

const DEFAULT_SLOTS = Object.freeze(["weapon", "offhand"]);
const PROJECTILE_SLOTS = Object.freeze(["ranged"]);
const SLOT_RANK = Object.freeze({
  ranged: 0,
  weapon: 1,
  offhand: 2,
});

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeId(raw) {
  return String(raw || "").trim().toLowerCase();
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeAffixId(raw) {
  const key = normalizeId(raw);
  return key.startsWith("affix:") ? key.slice(6) : key;
}

/**
 * @param {import('./weaponVfxProfiles.js').WeaponVfxProfile} profile
 * @param {{ slot:string, identity:string, affixes:Set<string>, coatingKind:string }} state
 * @returns {boolean}
 */
function matchesProfile(profile, state) {
  const match = profile?.match || null;
  if (!match) return false;

  const slotFilter = Array.isArray(match.slots) ? match.slots.map(normalizeId).filter(Boolean) : [];
  if (slotFilter.length > 0 && !slotFilter.includes(state.slot)) return false;

  const matchIdentities = Array.isArray(match.identities) ? match.identities.map(normalizeId).filter(Boolean) : [];
  const matchAffixes = Array.isArray(match.affixes) ? match.affixes.map(normalizeAffixId).filter(Boolean) : [];
  const matchCoatings = Array.isArray(match.coatingKinds) ? match.coatingKinds.map(normalizeId).filter(Boolean) : [];

  if (matchIdentities.includes(state.identity)) return true;
  if (matchCoatings.includes(state.coatingKind)) return true;
  for (const affix of matchAffixes) {
    if (state.affixes.has(affix)) return true;
  }
  return false;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} itemId
 * @param {string} slot
 * @returns {{ slot:string, identity:string, affixes:Set<string>, coatingKind:string }|null}
 */
function readItemState(world, itemId, slot) {
  if (!(itemId > 0)) return null;
  if (typeof world.isAlive === "function" && !world.isAlive(itemId)) return null;

  /** @type {any} */
  const info = /** @type any */ (world.get(itemId, ItemInfo));
  if (!info) return null;

  const identity = normalizeId(world.get(itemId, NamedIdentity)?.identity || "");
  const coatingKind = normalizeId(info?.coating?.kind || "");
  const affixes = new Set();
  const list = Array.isArray(info.affixes) ? info.affixes : [];
  for (let i = 0; i < list.length; i++) {
    const key = normalizeAffixId(list[i]);
    if (key) affixes.add(key);
  }
  return {
    slot: normalizeId(slot),
    identity,
    affixes,
    coatingKind,
  };
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} itemId
 * @param {string} slot
 * @returns {import('./weaponVfxProfiles.js').WeaponVfxProfile|null}
 */
function resolveItemProfile(world, itemId, slot) {
  const state = readItemState(world, itemId, slot);
  if (!state) return null;
  const profiles = listWeaponVfxProfiles();
  /** @type {import('./weaponVfxProfiles.js').WeaponVfxProfile|null} */
  let best = null;
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    if (!matchesProfile(profile, state)) continue;
    if (!best || Number(profile.priority || 0) > Number(best.priority || 0)) {
      best = profile;
    }
  }
  return best;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @param {{ slots?: string[] }} [opts]
 */
export function resolveEquippedWeaponVfx(world, entityId, opts = {}) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0)) return [];
  /** @type {any} */
  const eq = /** @type any */ (world.get(id, Equipment));
  if (!eq) return [];

  const slots = Array.isArray(opts.slots) && opts.slots.length > 0
    ? opts.slots.map(normalizeId).filter(Boolean)
    : DEFAULT_SLOTS;
  const out = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const itemId = Number(eq[slot] || 0) | 0;
    if (!(itemId > 0)) continue;
    const profile = resolveItemProfile(world, itemId, slot);
    if (!profile) continue;
    const handSlot = slot === "weapon" || slot === "offhand";
    out.push({
      id: profile.id,
      slot,
      priority: Number(profile.priority || 0),
      carryAnchor: profile.carryAnchor || null,
      carryEmitter: handSlot ? (profile.carryEmitter || null) : null,
      carryLight: handSlot ? (profile.carryLight || null) : null,
      projectileEmitter: profile.projectileEmitter || null,
      projectileStyle: String(profile?.projectileEmitter?.style || "").trim().toLowerCase(),
    });
  }

  return out;
}

/**
 * Resolve the projectile profile for ranged shots.
 * Prefers ranged slot, then weapon, then offhand; within a slot, higher profile priority wins.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 */
export function resolveDominantProjectileVfx(world, entityId) {
  const resolved = resolveEquippedWeaponVfx(world, entityId, { slots: PROJECTILE_SLOTS });
  /** @type {any|null} */
  let best = null;
  for (let i = 0; i < resolved.length; i++) {
    const rec = resolved[i];
    if (!rec?.projectileStyle) continue;
    if (!best) {
      best = rec;
      continue;
    }
    const ap = Number(rec.priority || 0);
    const bp = Number(best.priority || 0);
    if (ap > bp) {
      best = rec;
      continue;
    }
    if (ap !== bp) continue;
    const ar = SLOT_RANK[normalizeId(rec.slot)] ?? 99;
    const br = SLOT_RANK[normalizeId(best.slot)] ?? 99;
    if (ar < br) best = rec;
  }
  return best;
}
