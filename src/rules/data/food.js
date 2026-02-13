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
