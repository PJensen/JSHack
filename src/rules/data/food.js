// rules/data/food.js
// Nutrition data for food items and corpse nutrition calculations.

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

/**
 * Some corpses are poisonous or have special effects when consumed.
 * Maps monster id -> special effect key.
 * null/undefined = safe to eat.
 */
export const CORPSE_EFFECTS = {
  rat:          'disease',        // mangy rodent, risk of disease
  snake:        'poison',         // venomous snake
  spider:       'poison',         // venomous spider
  grid_bug:     'shock',          // electric jolt (minor damage)
  wraith:       'mindwipe',       // spectral meal, disorienting
  floating_eye: 'hallucination',  // psychedelic meat
  lich:         'mindwipe',       // eldritch remains
};

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
