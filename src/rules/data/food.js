// rules/data/food.js
// Nutrition, decay, and hunger constants for food systems.

import { HUNGER_COMBAT_LEVELS } from "./hungerCombatLevels.js";

/** Standard ration nutrition values. */
export const RATION_NUTRITION = 400;
export const IRON_RATION_NUTRITION = 600;

// ── Food decay constants ─────────────────────────────────────────
// Shelf life values and decay stage thresholds for the FoodDecay component.
// Consumed by foodDecaySystem, native food-use hooks, and display name resolver.

/** Default shelf life by food kind (turns in inventory before fully putrid). */
export const SHELF_LIFE_RATION = 500;
export const SHELF_LIFE_CORPSE = 150;

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
  const frac = shelfLife > 0 ? turnsHeld / shelfLife : 1;
  for (const s of DECAY_STAGES) {
    if (frac <= s.maxFrac) return { stage: s.name, nutritionMult: s.nutritionMult, sicknessChance: s.sicknessChance };
  }
  const last = DECAY_STAGES[DECAY_STAGES.length - 1];
  return { stage: last.name, nutritionMult: last.nutritionMult, sicknessChance: last.sicknessChance };
}

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
