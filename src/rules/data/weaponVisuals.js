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

const SIGNATURE_WEAPON_VISUAL_OVERRIDES = Object.freeze({
  sunsword: Object.freeze({
    weaponLengthCm: 116,
    weaponVfxProfile: Object.freeze({
      length: 1.18,
      widthScale: 0.96,
      handleStart: 0.22,
      alphaStops: Object.freeze([
        [0.00, 0.22],
        [0.45, 0.60],
        [0.86, 0.95],
        [1.00, 1.00],
      ]),
    }),
  }),
  debtbringer: Object.freeze({
    weaponLengthCm: 132,
    weaponVfxProfile: "mace",
  }),
  flametongue: Object.freeze({
    weaponLengthCm: 104,
    weaponVfxProfile: Object.freeze({
      length: 1.12,
      widthScale: 0.94,
      handleStart: 0.24,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.46, 0.58],
        [0.86, 0.96],
        [1.00, 1.00],
      ]),
    }),
  }),
  deathascendant_blade: Object.freeze({
    weaponLengthCm: 128,
    weaponVfxProfile: Object.freeze({
      length: 1.25,
      widthScale: 1.03,
      handleStart: 0.20,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.50, 0.54],
        [0.90, 1.00],
        [1.00, 0.96],
      ]),
    }),
  }),
  soul_ascendant_scythe: Object.freeze({
    weaponLengthCm: 168,
    weaponVfxProfile: "spear",
  }),
  cataclysm_warspear: Object.freeze({
    weaponLengthCm: 188,
    weaponVfxProfile: "spear",
  }),
  thundergod_maul: Object.freeze({
    weaponLengthCm: 138,
    weaponVfxProfile: "mace",
  }),
  hollow_greatsword: Object.freeze({
    weaponLengthCm: 152,
    weaponVfxProfile: "sword",
  }),
  stormcaller_blade: Object.freeze({
    weaponLengthCm: 112,
    weaponVfxProfile: Object.freeze({
      length: 1.20,
      widthScale: 0.92,
      handleStart: 0.25,
      alphaStops: Object.freeze([
        [0.00, 0.16],
        [0.42, 0.46],
        [0.76, 0.80],
        [1.00, 0.96],
      ]),
    }),
  }),
  soulreaver_axe: Object.freeze({
    weaponLengthCm: 118,
    weaponVfxProfile: Object.freeze({
      length: 1.20,
      widthScale: 1.16,
      handleStart: 0.18,
      alphaStops: Object.freeze([
        [0.00, 0.12],
        [0.52, 0.30],
        [0.82, 1.00],
        [1.00, 0.88],
      ]),
    }),
  }),
  blade_of_echoes: Object.freeze({
    weaponLengthCm: 108,
    weaponVfxProfile: Object.freeze({
      length: 1.14,
      widthScale: 0.90,
      handleStart: 0.24,
      alphaStops: Object.freeze([
        [0.00, 0.16],
        [0.40, 0.42],
        [0.78, 0.80],
        [1.00, 1.00],
      ]),
    }),
  }),
  predator_stakebow: Object.freeze({
    weaponLengthCm: 176,
    weaponVfxProfile: Object.freeze({
      length: 1.24,
      widthScale: 0.82,
      handleStart: 0.18,
      alphaStops: Object.freeze([
        [0.00, 0.26],
        [0.50, 0.76],
        [1.00, 0.84],
      ]),
    }),
  }),
  doom_crossbow: Object.freeze({
    weaponLengthCm: 98,
    weaponVfxProfile: Object.freeze({
      length: 0.88,
      widthScale: 1.08,
      handleStart: 0.24,
      alphaStops: Object.freeze([
        [0.00, 0.20],
        [0.46, 0.86],
        [1.00, 0.88],
      ]),
    }),
  }),
  resonant_quarterstaff: Object.freeze({
    weaponLengthCm: 172,
    weaponVfxProfile: Object.freeze({
      length: 1.34,
      widthScale: 0.88,
      handleStart: 0.12,
      alphaStops: Object.freeze([
        [0.00, 0.14],
        [0.74, 0.62],
        [1.00, 0.90],
      ]),
    }),
  }),
  voidmind_athame: Object.freeze({
    weaponLengthCm: 48,
    weaponVfxProfile: "dagger",
  }),
  nightfang_dagger: Object.freeze({
    weaponLengthCm: 44,
    weaponVfxProfile: Object.freeze({
      length: 0.78,
      widthScale: 0.86,
      handleStart: 0.28,
      alphaStops: Object.freeze([
        [0.00, 0.20],
        [0.58, 0.72],
        [1.00, 1.00],
      ]),
    }),
  }),
  venomfang_dagger: Object.freeze({
    weaponLengthCm: 46,
    weaponVfxProfile: Object.freeze({
      length: 0.82,
      widthScale: 0.90,
      handleStart: 0.30,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.56, 0.70],
        [1.00, 1.00],
      ]),
    }),
  }),
  caustic_stiletto: Object.freeze({
    weaponLengthCm: 52,
    weaponVfxProfile: Object.freeze({
      length: 0.90,
      widthScale: 0.78,
      handleStart: 0.32,
      alphaStops: Object.freeze([
        [0.00, 0.16],
        [0.62, 0.64],
        [1.00, 1.00],
      ]),
    }),
  }),
  plague_fang: Object.freeze({
    weaponLengthCm: 47,
    weaponVfxProfile: Object.freeze({
      length: 0.84,
      widthScale: 0.86,
      handleStart: 0.28,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.52, 0.66],
        [1.00, 1.00],
      ]),
    }),
  }),
  warhammer_of_fury: Object.freeze({
    weaponLengthCm: 124,
    weaponVfxProfile: Object.freeze({
      length: 1.20,
      widthScale: 1.22,
      handleStart: 0.16,
      alphaStops: Object.freeze([
        [0.00, 0.10],
        [0.50, 0.24],
        [0.84, 0.94],
        [1.00, 1.00],
      ]),
    }),
  }),
  pyreheart_mace: Object.freeze({
    weaponLengthCm: 109,
    weaponVfxProfile: Object.freeze({
      length: 1.08,
      widthScale: 1.18,
      handleStart: 0.18,
      alphaStops: Object.freeze([
        [0.00, 0.12],
        [0.54, 0.24],
        [0.86, 0.96],
        [1.00, 1.00],
      ]),
    }),
  }),
  stormtouched_mace: Object.freeze({
    weaponLengthCm: 101,
    weaponVfxProfile: Object.freeze({
      length: 1.00,
      widthScale: 1.12,
      handleStart: 0.20,
      alphaStops: Object.freeze([
        [0.00, 0.12],
        [0.60, 0.28],
        [0.90, 0.96],
        [1.00, 1.00],
      ]),
    }),
  }),
  eclipse_maul: Object.freeze({
    weaponLengthCm: 146,
    weaponVfxProfile: Object.freeze({
      length: 1.36,
      widthScale: 1.30,
      handleStart: 0.14,
      alphaStops: Object.freeze([
        [0.00, 0.10],
        [0.46, 0.20],
        [0.80, 0.90],
        [1.00, 1.00],
      ]),
    }),
  }),
  tolling_blade: Object.freeze({
    weaponLengthCm: 118,
    weaponVfxProfile: Object.freeze({
      length: 1.22,
      widthScale: 0.96,
      handleStart: 0.20,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.42, 0.48],
        [0.84, 0.92],
        [1.00, 1.00],
      ]),
    }),
  }),
  witchfire_sword: Object.freeze({
    weaponLengthCm: 110,
    weaponVfxProfile: Object.freeze({
      length: 1.16,
      widthScale: 0.94,
      handleStart: 0.24,
      alphaStops: Object.freeze([
        [0.00, 0.18],
        [0.44, 0.52],
        [0.82, 0.90],
        [1.00, 1.00],
      ]),
    }),
  }),
  blood_covenant_sword: Object.freeze({
    weaponLengthCm: 126,
    weaponVfxProfile: Object.freeze({
      length: 1.24,
      widthScale: 0.98,
      handleStart: 0.20,
      alphaStops: Object.freeze([
        [0.00, 0.16],
        [0.40, 0.48],
        [0.86, 0.96],
        [1.00, 1.00],
      ]),
    }),
  }),
  blood_covenant_rapier: Object.freeze({
    weaponLengthCm: 118,
    weaponVfxProfile: Object.freeze({
      length: 1.20,
      widthScale: 0.76,
      handleStart: 0.26,
      alphaStops: Object.freeze([
        [0.00, 0.16],
        [0.70, 0.62],
        [1.00, 1.00],
      ]),
    }),
  }),
  hungering_cleaver: Object.freeze({
    weaponLengthCm: 134,
    weaponVfxProfile: Object.freeze({
      length: 1.28,
      widthScale: 1.22,
      handleStart: 0.16,
      alphaStops: Object.freeze([
        [0.00, 0.12],
        [0.52, 0.26],
        [0.86, 0.98],
        [1.00, 0.92],
      ]),
    }),
  }),
  cataclysm_axe: Object.freeze({
    weaponLengthCm: 142,
    weaponVfxProfile: Object.freeze({
      length: 1.34,
      widthScale: 1.26,
      handleStart: 0.14,
      alphaStops: Object.freeze([
        [0.00, 0.10],
        [0.50, 0.24],
        [0.84, 0.98],
        [1.00, 0.90],
      ]),
    }),
  }),
  glacial_edge: Object.freeze({
    weaponLengthCm: 108,
    weaponVfxProfile: Object.freeze({
      length: 1.12,
      widthScale: 0.90,
      handleStart: 0.24,
      alphaStops: Object.freeze([
        [0.00, 0.20],
        [0.44, 0.50],
        [0.84, 0.86],
        [1.00, 1.00],
      ]),
    }),
  }),
  never_sated_warclub: Object.freeze({
    weaponLengthCm: 128,
    weaponVfxProfile: Object.freeze({
      length: 1.26,
      widthScale: 1.24,
      handleStart: 0.14,
      alphaStops: Object.freeze([
        [0.00, 0.10],
        [0.48, 0.22],
        [0.82, 0.90],
        [1.00, 1.00],
      ]),
    }),
  }),
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
 *   weaponVfxProfile?: string|object|null,
 * }} rec
 * @returns {{ weaponClass: string, weaponLengthCm: number, weaponVfxProfile: string|object }}
 */
export function resolveWeaponVisualMeta(rec = {}) {
  const byId = SIGNATURE_WEAPON_VISUAL_OVERRIDES[String(rec.id || "").toLowerCase()] || null;
  const identityText = `${String(rec.id || "")} ${String(rec.name || "")}`;
  const inferredClass = inferWeaponClassFromText(identityText, rec.damageType, rec.subtype);

  const authoredProfile = rec.weaponVfxProfile ?? byId?.weaponVfxProfile ?? null;
  const profileIsString = typeof authoredProfile === "string";
  const overrideProfileKey = profileIsString ? String(authoredProfile).trim().toLowerCase() : "";
  const profile = profileIsString
    ? (overrideProfileKey || defaultProfileForClass(inferredClass))
    : (authoredProfile || defaultProfileForClass(inferredClass));
  const weaponClass = overrideProfileKey || inferredClass;

  const explicitLength = coerceFinitePositive(rec.weaponLengthCm ?? byId?.weaponLengthCm);
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
