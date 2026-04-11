// rules/data/weaponVisuals.js
// Canonical weapon visual metadata for rules -> display handoff.
// This module defines default weapon lengths (cm), profile keys, and override hooks.

const DEFAULT_PROFILE_BY_CLASS = Object.freeze({
  sword: "sword",
  dagger: "dagger",
  axe: "axe",
  mace: "mace",
  morningstar: "morningstar",
  staff: "staff",
  spear: "spear",
  bow: "bow",
  weapon: "weapon",
  unarmed: "weapon",
});

const DEFAULT_LENGTH_CM_BY_CLASS = Object.freeze({
  sword: 92,
  dagger: 42,
  axe: 76,
  mace: 67,
  morningstar: 72,
  staff: 156,
  spear: 182,
  bow: 170,
  weapon: 85,
  unarmed: 0,
});

function coerceFinitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inferWeaponClassFromText(identityText, damageType, subtype) {
  const identity = String(identityText || "").toLowerCase();
  const sub = String(subtype || "").toLowerCase();
  const dt = String(damageType || "").toLowerCase();

  if (sub === "bow" || identity.includes("bow")) return "bow";
  if (identity.includes("morningstar")) return "morningstar";
  if (identity.includes("staff")) return "staff";
  if (
    identity.includes("spear")
    || identity.includes("pike")
    || identity.includes("lance")
    || identity.includes("glaive")
    || identity.includes("halberd")
    || identity.includes("trident")
  ) return "spear";
  if (
    identity.includes("dagger")
    || identity.includes("shiv")
    || identity.includes("athame")
    || identity.includes("knife")
    || identity.includes("stiletto")
    || identity.includes("fang")
  ) return "dagger";
  if (
    identity.includes("sword")
    || identity.includes("blade")
    || identity.includes("sabre")
    || identity.includes("rapier")
    || identity.includes("katana")
    || identity.includes("edge")
    || identity.includes("flametongue")
  ) return "sword";
  if (
    identity.includes("mace")
    || identity.includes("maul")
    || identity.includes("club")
    || identity.includes("hammer")
    || identity.includes("flail")
    || identity.includes("debtbringer")
  ) return "mace";
  if (
    identity.includes("axe")
    || identity.includes("hatchet")
    || identity.includes("reaver")
    || identity.includes("cleaver")
    || identity.includes("scythe")
  ) return "axe";
  if (dt === "blunt") return "mace";
  if (dt === "slash") return "sword";
  if (dt === "pierce") return "dagger";
  return "weapon";
}

function defaultLengthForClass(weaponClass, twoHanded) {
  const base = Number(DEFAULT_LENGTH_CM_BY_CLASS[weaponClass] ?? DEFAULT_LENGTH_CM_BY_CLASS.weapon);
  if (!Number.isFinite(base) || base <= 0) return DEFAULT_LENGTH_CM_BY_CLASS.weapon;
  if (twoHanded === true) return Math.round(base * 1.12);
  return base;
}

function defaultProfileForClass(weaponClass) {
  return DEFAULT_PROFILE_BY_CLASS[weaponClass] || DEFAULT_PROFILE_BY_CLASS.weapon;
}

/**
 * Resolve canonical weapon class + visual metadata from item-like data.
 * Supports authoring overrides:
 * - `weaponLengthCm`
 * - `weaponVfxProfile` (profile key)
 *
 * @param {{
 *   id?: string,
 *   name?: string,
 *   slot?: string,
 *   type?: string,
 *   subtype?: string,
 *   damageType?: string,
 *   twoHanded?: boolean,
 *   weaponLengthCm?: number|string|null,
 *   weaponVfxProfile?: string|null,
 * }} rec
 * @returns {{ weaponClass: string, weaponLengthCm: number, weaponVfxProfile: string }}
 */
export function resolveWeaponVisualMeta(rec = {}) {
  const identityText = `${String(rec.id || "")} ${String(rec.name || "")}`;
  const inferredClass = inferWeaponClassFromText(identityText, rec.damageType, rec.subtype);

  const overrideProfile = String(rec.weaponVfxProfile || "").trim().toLowerCase();
  const weaponClass = overrideProfile || inferredClass;
  const profile = overrideProfile || defaultProfileForClass(inferredClass);

  const explicitLength = coerceFinitePositive(rec.weaponLengthCm);
  const lengthCm = explicitLength ?? defaultLengthForClass(inferredClass, rec.twoHanded === true);

  return {
    weaponClass,
    weaponLengthCm: Math.round(lengthCm),
    weaponVfxProfile: profile,
  };
}

/**
 * Whether a catalog item should be treated as a weapon for visual metadata.
 * Covers melee, ranged bows, and any equip item with damage dice.
 *
 * @param {Record<string, any>} rec
 * @returns {boolean}
 */
export function isWeaponCatalogItem(rec) {
  if (!rec || String(rec.catalogKind || "") !== "equipment") return false;
  const slot = String(rec.slot || "").toLowerCase();
  const subtype = String(rec.subtype || "").toLowerCase();
  if (slot === "weapon" || slot === "ranged") return true;
  if (subtype === "bow") return true;
  if (typeof rec.damageDice === "string" && rec.damageDice.trim()) return true;
  return false;
}
