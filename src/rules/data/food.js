// rules/data/food.js
// Nutrition, decay, and hunger constants for food systems.

import { HUNGER_COMBAT_LEVELS } from "./hungerCombatLevels.js";
import { TURNS_PER_DAY } from "./calendar.js";

/**
 * Baseline ration nutrition values (hunger reduction).
 * Tuned for TURNS_PER_DAY = 720:
 * - ration: about half a day
 * - iron ration: about one day (survival, slight deficit)
 */
export const RATION_NUTRITION = 360;
export const IRON_RATION_NUTRITION = 700;

// ── Food decay constants ─────────────────────────────────────────
// Shelf life values and decay stage thresholds for the FoodDecay component.
// Consumed by foodDecaySystem, native food-use hooks, and display name resolver.

/** Default shelf life by food kind (turns in inventory before fully putrid). */
export const SHELF_LIFE_RATION = TURNS_PER_DAY * 7;
export const SHELF_LIFE_CORPSE = TURNS_PER_DAY * 2;

/** Decay stage thresholds as fractions of shelfLife. */
export const DECAY_STAGES = Object.freeze([
  Object.freeze({ name: 'fresh',  maxFrac: 0.33, nutritionMult: 1.0,  sicknessChance: 0    }),
  Object.freeze({ name: 'off',    maxFrac: 0.66, nutritionMult: 0.75, sicknessChance: 0    }),
  Object.freeze({ name: 'rancid', maxFrac: 0.99, nutritionMult: 0.50, sicknessChance: 0.20 }),
  Object.freeze({ name: 'putrid', maxFrac: Infinity, nutritionMult: 0.25, sicknessChance: 0.80 }),
]);

/**
 * Resolve the current decay stage for a food item.
 * @param {number} turnsHeld
 * @param {number} shelfLife
 * @returns {{ stage: string, nutritionMult: number, sicknessChance: number }}
 */
export function getDecayStage(turnsHeld, shelfLife) {
  const resolvedShelfLife = resolveFoodShelfLife(shelfLife);
  if (resolvedShelfLife <= 0) {
    const fresh = DECAY_STAGES[0];
    return { stage: fresh.name, nutritionMult: fresh.nutritionMult, sicknessChance: fresh.sicknessChance };
  }
  const frac = turnsHeld / resolvedShelfLife;
  for (const s of DECAY_STAGES) {
    if (frac <= s.maxFrac) return { stage: s.name, nutritionMult: s.nutritionMult, sicknessChance: s.sicknessChance };
  }
  const last = DECAY_STAGES[DECAY_STAGES.length - 1];
  return { stage: last.name, nutritionMult: last.nutritionMult, sicknessChance: last.sicknessChance };
}

/**
 * Resolve numeric or expression-based food shelf life.
 * Expressions intentionally evaluate as content data, with a tiny canonical
 * context instead of ad hoc per-item math.
 *
 * @param {number|string} shelfLife
 * @returns {number}
 */
export function resolveFoodShelfLife(shelfLife) {
  if (typeof shelfLife === "number") {
    if (!Number.isFinite(shelfLife)) return SHELF_LIFE_RATION;
    return Math.max(0, Math.floor(shelfLife));
  }
  const source = String(shelfLife ?? "").trim();
  if (!source) return SHELF_LIFE_RATION;
  const numeric = Number(source);
  if (Number.isFinite(numeric)) return Math.max(0, Math.floor(numeric));
  try {
    const T = TURNS_PER_DAY;
    const DAY = TURNS_PER_DAY;
    const DAYS = TURNS_PER_DAY;
    const value = eval(source);
    return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : SHELF_LIFE_RATION;
  } catch {
    return SHELF_LIFE_RATION;
  }
}

/**
 * Corpse weight derived from monster massKg.
 * Carry capacity = maxStamina (default 100), so a 350 kg cave_bear
 * corpse at weight 44 means two of them nearly cap you out.
 * Fallback to sizeClass-based default when massKg is missing.
 */
const CORPSE_WEIGHT_FALLBACK = { XS: 1, S: 4, M: 8, L: 30, XL: 100 };

export function corpseWeight(monsterDef) {
  if (monsterDef.massKg > 0) {
    return Math.max(1, Math.round(monsterDef.massKg / 8));
  }
  return CORPSE_WEIGHT_FALLBACK[monsterDef.sizeClass] || 4;
}

// ── Hunger severity constants ─────────────────────────────────────
// Single source of truth for level names, thresholds, and penalties.
// Consumed by hungerSystem, combatSystem, manaRegenerationSystem, and display.

const HALF_DAY_TURNS = Math.max(1, Math.floor(TURNS_PER_DAY * 0.5));
const ONE_DAY_TURNS = Math.max(1, TURNS_PER_DAY);
const THREE_DAY_TURNS = Math.max(ONE_DAY_TURNS + 1, TURNS_PER_DAY * 3);
const FIVE_DAY_TURNS = Math.max(THREE_DAY_TURNS + 1, TURNS_PER_DAY * 5);
const SEVEN_DAY_TURNS = Math.max(FIVE_DAY_TURNS + 1, TURNS_PER_DAY * 7);

/**
 * Severity thresholds (frozen), scaled from TURNS_PER_DAY.
 *
 * Target pacing (baseline hungerRate = 1):
 * - peckish: around half-day
 * - hungry: around day 1
 * - starving: around day 5
 * - wasting: around day 7+
 */
export const HUNGER_LEVELS = Object.freeze([
  Object.freeze({ name: 'normal',   min: 0,               max: HALF_DAY_TURNS - 1 }),
  Object.freeze({ name: 'peckish',  min: HALF_DAY_TURNS,  max: ONE_DAY_TURNS - 1 }),
  Object.freeze({ name: 'hungry',   min: ONE_DAY_TURNS,   max: THREE_DAY_TURNS - 1 }),
  Object.freeze({ name: 'famished', min: THREE_DAY_TURNS, max: FIVE_DAY_TURNS - 1 }),
  Object.freeze({ name: 'starving', min: FIVE_DAY_TURNS,  max: SEVEN_DAY_TURNS - 1 }),
  Object.freeze({ name: 'wasting',  min: SEVEN_DAY_TURNS, max: Infinity }),
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
export { HUNGER_COMBAT_LEVELS };

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
