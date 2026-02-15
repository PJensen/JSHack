// rules/data/food.js
// Nutrition data for food items and corpse nutrition calculations.
// Corpse eat behavior lives on corpse item data keyed by corpse identity.

import {
  cancelEat,
  corpseStatusEffect,
  corpseDamage,
  grantElectricResist,
} from "./callbacks/eat.js";

/**
 * Base nutrition by monster sizeClass.
 * These values represent "hunger reduction" when the food is consumed.
 */
export const NUTRITION_BY_SIZE = {
  XS: 80,    // bat, grid_bug, snake — meager meal
  S:  150,   // rat, goblin, spider — light meal
  M:  300,   // orc, skeleton, wraith, lich — standard meal
  L:  500,   // troll, ogre, demon — hearty meal
  XL: 800,   // dragon — feast
};

/**
 * Compute nutrition from a monster def, factoring in massKg for fine-tuning.
 * @param {{ sizeClass: string, massKg: number }} monsterDef
 * @returns {number} nutrition value (hunger reduction)
 */
export function computeCorpseNutrition(monsterDef) {
  const base = NUTRITION_BY_SIZE[monsterDef.sizeClass] || 200;
  const massBonus = Math.floor((monsterDef.massKg || 0) / 10);
  return base + massBonus;
}

const EMPTY_HOOKS = Object.freeze([]);

/**
 * Corpse item definitions keyed by corpse identity.
 * The identity convention is `corpse_${monsterId}`.
 */
export const CORPSE_DEFS = Object.freeze({
  corpse_rat: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("disease", 20, 1)]),
  }),
  corpse_bat: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("disease", 20, 1)]),
  }),
  corpse_grid_bug: Object.freeze({
    onEat: Object.freeze([corpseDamage(3)]),
  }),
  corpse_snake: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("poison", 8, 2)]),
  }),
  corpse_spider: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("poison", 8, 2)]),
  }),
  corpse_wraith: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 15, 1)]),
  }),
  corpse_floating_eye: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 30, 2, "hallucination")]),
  }),
  corpse_lich: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 15, 1)]),
  }),
  corpse_eel: Object.freeze({
    onEat: Object.freeze([grantElectricResist]),
  }),
  corpse_test_cancel: Object.freeze({
    onEat: Object.freeze([cancelEat("FAIL", "You cannot stomach that.", true)]),
  }),
});

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeCorpseIdentity(key) {
  const normalized = String(key || "").toLowerCase().trim();
  if (!normalized) return "";
  if (normalized.startsWith("corpse_")) return normalized;
  return `corpse_${normalized}`;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {{ onEat?: Function[] }|null}
 */
export function getCorpseDef(key) {
  const identity = normalizeCorpseIdentity(key);
  return identity ? (CORPSE_DEFS[identity] || null) : null;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {Function[]}
 */
export function getCorpseEatHooks(key) {
  const hooks = getCorpseDef(key)?.onEat;
  return Array.isArray(hooks) ? hooks : EMPTY_HOOKS;
}

/** Standard ration nutrition values. */
export const RATION_NUTRITION = 400;
export const IRON_RATION_NUTRITION = 600;

/** Corpse weight by sizeClass (for ItemInfo.weight). */
export const CORPSE_WEIGHT = {
  XS: 1,
  S:  2,
  M:  4,
  L:  8,
  XL: 15,
};

// ── Hunger severity constants ─────────────────────────────────────
// Single source of truth for level names, thresholds, and penalties.
// Consumed by hungerSystem, combatSystem, manaRegenerationSystem, and display.

/** Severity thresholds (frozen). */
export const HUNGER_LEVELS = Object.freeze([
  Object.freeze({ name: 'normal',   min: 0,    max: 199  }),
  Object.freeze({ name: 'peckish',  min: 200,  max: 399  }),
  Object.freeze({ name: 'hungry',   min: 400,  max: 599  }),
  Object.freeze({ name: 'famished', min: 600,  max: 799  }),
  Object.freeze({ name: 'starving', min: 800,  max: 999  }),
  Object.freeze({ name: 'wasting',  min: 1000, max: Infinity }),
]);

/** All status types that the hunger system projects (for filtering). */
export const HUNGER_STATUS_TYPES = Object.freeze(new Set([
  'satiated', 'peckish', 'hungry', 'famished', 'starving', 'wasting',
]));

/** Attack/defense penalty per hunger level (read by combatSystem). */
export const HUNGER_POTENCY = Object.freeze({
  peckish: 0, hungry: 1, famished: 2, starving: 3, wasting: 4,
});

/** Levels that apply a combat penalty (frozen array for status lookups). */
export const HUNGER_COMBAT_LEVELS = Object.freeze(['hungry', 'famished', 'starving', 'wasting']);

/** Levels that throttle mana regen, mapped to multiplier. */
export const HUNGER_MANA_MULT = Object.freeze({
  famished: 0.5, starving: 0.0, wasting: 0.0,
});

/**
 * Resolve a hunger counter value to its severity level name.
 * @param {number} hunger
 * @returns {string}
 */
export function getHungerLevel(hunger) {
  for (const level of HUNGER_LEVELS) {
    if (hunger >= level.min && hunger <= level.max) return level.name;
  }
  return 'wasting';
}
