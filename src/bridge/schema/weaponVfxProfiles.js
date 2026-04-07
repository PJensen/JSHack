// bridge/schema/weaponVfxProfiles.js
// Canonical display manifest for equipped-weapon VFX projection.

const FIRE_AFFIXES = Object.freeze(["flaming", "firestorm1", "soulfire1"]);
const VENOM_AFFIXES = Object.freeze(["venomous1", "plague1"]);
const STORM_AFFIXES = Object.freeze(["chainlightning1", "capacitive1"]);
const FROST_AFFIXES = Object.freeze(["frostbite1"]);
const SOUL_AFFIXES = Object.freeze(["souldrain1", "agony1"]);
const BLOOD_AFFIXES = Object.freeze(["hemorrhage1", "berserk1"]);
const CAUSTIC_AFFIXES = Object.freeze(["caustic1"]);

/**
 * @typedef {{
 *   id: string,
 *   priority: number,
 *   match: {
 *     affixes?: readonly string[],
 *     identities?: readonly string[],
 *     coatingKinds?: readonly string[],
 *     slots?: readonly string[],
 *   },
 *   carryAnchor?: {
 *     forward?: number,
 *     lateral?: number,
 *     vertical?: number,
 *   },
 *   carryEmitter?: Record<string, any>,
 *   carryLight?: {
 *     radius: number,
 *     color: [number, number, number],
 *     flicker?: {
 *       mode?: "sin",
 *       base?: number,
 *       amp?: number,
 *       speed?: number,
 *       phase?: number,
 *     },
 *   },
 *   projectileEmitter?: {
 *     style?: string,
 *   },
 * }} WeaponVfxProfile
 */

/** @type {readonly WeaponVfxProfile[]} */
const WEAPON_VFX_PROFILES = Object.freeze([
  Object.freeze({
    id: "holy_weapon",
    priority: 360,
    match: Object.freeze({
      identities: Object.freeze(["sunsword"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.40, lateral: 0.18, vertical: -0.05 }),
    carryEmitter: Object.freeze({
      rate: 7,
      angle: -Math.PI / 2,
      spread: Math.PI / 4,
      speed: 0.18,
      speedJitter: 0.10,
      ax: 0,
      ay: -0.03,
      life: 0.70,
      lifeJitter: 0.18,
      size: 0.055,
      sizeEnd: 0.014,
      color: "#fff4be",
      alpha0: 0.42,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.18,
      color: Object.freeze([255, 243, 190]),
      flicker: Object.freeze({ mode: "sin", base: 0.93, amp: 0.07, speed: 7.1, phase: 0.17 }),
    }),
    projectileEmitter: Object.freeze({ style: "holy" }),
  }),
  Object.freeze({
    id: "flame_weapon",
    priority: 320,
    match: Object.freeze({
      affixes: FIRE_AFFIXES,
      identities: Object.freeze(["flametongue", "ember_knife", "smoldering_club", "witchfire_sword"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.40, lateral: 0.18, vertical: -0.04 }),
    carryEmitter: Object.freeze({
      rate: 11,
      angle: -Math.PI / 2,
      spread: Math.PI / 5,
      speed: 0.34,
      speedJitter: 0.20,
      ax: 0,
      ay: -0.08,
      life: 0.50,
      lifeJitter: 0.20,
      size: 0.085,
      sizeEnd: 0.02,
      color: "#ff7a30",
      alpha0: 0.48,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.38,
      color: Object.freeze([255, 118, 40]),
      flicker: Object.freeze({ mode: "sin", base: 0.90, amp: 0.10, speed: 6.2, phase: 0.31 }),
    }),
    projectileEmitter: Object.freeze({ style: "fire" }),
  }),
  Object.freeze({
    id: "venom_weapon",
    priority: 300,
    match: Object.freeze({
      affixes: VENOM_AFFIXES,
      identities: Object.freeze(["nightfang_dagger", "venomfang_dagger", "nightfang", "venomfang"]),
      coatingKinds: Object.freeze(["poison"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.39, lateral: 0.17, vertical: -0.02 }),
    carryEmitter: Object.freeze({
      rate: 9,
      angle: -Math.PI / 2,
      spread: Math.PI / 6,
      speed: 0.20,
      speedJitter: 0.16,
      ax: 0,
      ay: -0.02,
      life: 0.72,
      lifeJitter: 0.28,
      size: 0.072,
      sizeEnd: 0.018,
      color: "#6ddb55",
      alpha0: 0.40,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.30,
      color: Object.freeze([120, 255, 80]),
      flicker: Object.freeze({ mode: "sin", base: 0.88, amp: 0.12, speed: 5.1, phase: 0.41 }),
    }),
    projectileEmitter: Object.freeze({ style: "venom" }),
  }),
  Object.freeze({
    id: "storm_weapon",
    priority: 280,
    match: Object.freeze({
      affixes: STORM_AFFIXES,
      identities: Object.freeze(["electrical_mace", "storm_mace", "thunder_mace"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.40, lateral: 0.18, vertical: -0.05 }),
    carryEmitter: Object.freeze({
      rate: 12,
      angle: 0,
      spread: Math.PI * 2,
      speed: 0.28,
      speedJitter: 0.35,
      ax: 0,
      ay: -0.02,
      life: 0.26,
      lifeJitter: 0.12,
      size: 0.06,
      sizeEnd: 0.015,
      color: "#8ac5ff",
      alpha0: 0.72,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.34,
      color: Object.freeze([145, 205, 255]),
      flicker: Object.freeze({ mode: "sin", base: 0.86, amp: 0.14, speed: 9.2, phase: 0.27 }),
    }),
    projectileEmitter: Object.freeze({ style: "storm" }),
  }),
  Object.freeze({
    id: "frost_weapon",
    priority: 260,
    match: Object.freeze({
      affixes: FROST_AFFIXES,
      identities: Object.freeze(["winterfang", "frost_sabre", "ice_knife"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.40, lateral: 0.17, vertical: -0.03 }),
    carryEmitter: Object.freeze({
      rate: 10,
      angle: 0,
      spread: Math.PI * 2,
      speed: 0.16,
      speedJitter: 0.12,
      ax: 0,
      ay: 0.03,
      life: 0.80,
      lifeJitter: 0.28,
      size: 0.065,
      sizeEnd: 0.018,
      color: "#9de8ff",
      alpha0: 0.44,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.26,
      color: Object.freeze([160, 220, 255]),
      flicker: Object.freeze({ mode: "sin", base: 0.90, amp: 0.10, speed: 4.0, phase: 0.29 }),
    }),
    projectileEmitter: Object.freeze({ style: "frost" }),
  }),
  Object.freeze({
    id: "soul_weapon",
    priority: 220,
    match: Object.freeze({
      affixes: SOUL_AFFIXES,
      identities: Object.freeze(["soul_reaver", "night_sabre"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.39, lateral: 0.17, vertical: -0.04 }),
    carryEmitter: Object.freeze({
      rate: 8,
      angle: -Math.PI / 2,
      spread: Math.PI / 2,
      speed: 0.22,
      speedJitter: 0.16,
      ax: 0,
      ay: -0.04,
      life: 0.68,
      lifeJitter: 0.20,
      size: 0.08,
      sizeEnd: 0.02,
      color: "#b87cff",
      alpha0: 0.40,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.22,
      color: Object.freeze([178, 110, 255]),
      flicker: Object.freeze({ mode: "sin", base: 0.90, amp: 0.10, speed: 4.8, phase: 0.33 }),
    }),
  }),
  Object.freeze({
    id: "blood_weapon",
    priority: 210,
    match: Object.freeze({
      affixes: BLOOD_AFFIXES,
      identities: Object.freeze(["bloodletter", "war_reaper"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.40, lateral: 0.18, vertical: -0.03 }),
    carryEmitter: Object.freeze({
      rate: 10,
      angle: Math.PI / 2,
      spread: Math.PI / 5,
      speed: 0.28,
      speedJitter: 0.20,
      ax: 0,
      ay: 0.26,
      life: 0.54,
      lifeJitter: 0.22,
      size: 0.07,
      sizeEnd: 0.018,
      color: "#cf3f3f",
      alpha0: 0.44,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.16,
      color: Object.freeze([220, 72, 72]),
      flicker: Object.freeze({ mode: "sin", base: 0.88, amp: 0.12, speed: 4.5, phase: 0.21 }),
    }),
  }),
  Object.freeze({
    id: "caustic_weapon",
    priority: 200,
    match: Object.freeze({
      affixes: CAUSTIC_AFFIXES,
      identities: Object.freeze(["acid_spitter", "slime_blade"]),
    }),
    carryAnchor: Object.freeze({ forward: 0.39, lateral: 0.17, vertical: -0.02 }),
    carryEmitter: Object.freeze({
      rate: 8,
      angle: -Math.PI / 2,
      spread: Math.PI / 6,
      speed: 0.24,
      speedJitter: 0.16,
      ax: 0,
      ay: -0.02,
      life: 0.64,
      lifeJitter: 0.22,
      size: 0.07,
      sizeEnd: 0.02,
      color: "#b4f04d",
      alpha0: 0.42,
      alpha1: 0.0,
    }),
    carryLight: Object.freeze({
      radius: 1.20,
      color: Object.freeze([182, 245, 88]),
      flicker: Object.freeze({ mode: "sin", base: 0.87, amp: 0.13, speed: 4.9, phase: 0.23 }),
    }),
    projectileEmitter: Object.freeze({ style: "venom" }),
  }),
]);

const PROFILE_BY_ID = new Map(WEAPON_VFX_PROFILES.map((profile) => [profile.id, profile]));

/**
 * @returns {readonly WeaponVfxProfile[]}
 */
export function listWeaponVfxProfiles() {
  return WEAPON_VFX_PROFILES;
}

/**
 * @param {string} id
 * @returns {WeaponVfxProfile|null}
 */
export function getWeaponVfxProfile(id) {
  const key = String(id || "").trim().toLowerCase();
  return PROFILE_BY_ID.get(key) || null;
}

