// rules/data/effectDefs.js
// Declarative effect behavior definitions interpreted by effectSystem.

export const EFFECT_OPERATION_IDS = Object.freeze([
  "none",
  "damage",
  "heal",
  "stamina_restore",
  "mana_restore",
]);

/**
 * @typedef {{
 *   id: string,
 *   keys: string[],
 *   operation: "none" | "damage" | "heal" | "stamina_restore" | "mana_restore",
 *   statuses: string[],
 * }} EffectDef
 */

/** @type {EffectDef[]} */
export const EFFECT_DEFS = [
  {
    id: "invulnerability",
    keys: ["invuln", "invulnerable"],
    operation: "none",
    statuses: ["invulnerable"],
  },
  {
    id: "poison",
    keys: ["poison", "poisoned"],
    operation: "damage",
    statuses: ["poisoned"],
  },
  {
    id: "burning",
    keys: ["burn", "burning"],
    operation: "damage",
    statuses: ["burning"],
  },
  {
    id: "regeneration",
    keys: ["regen", "regeneration"],
    operation: "heal",
    statuses: ["regen"],
  },
  {
    id: "stun",
    keys: ["stun", "stunned"],
    operation: "none",
    statuses: ["stunned"],
  },
  {
    id: "shock",
    keys: ["shock", "shocked"],
    operation: "damage",
    statuses: ["shocked"],
  },
  {
    id: "bleed",
    keys: ["bleed", "bleeding"],
    operation: "damage",
    statuses: ["bleeding"],
  },
  {
    id: "disease",
    keys: ["disease", "diseased"],
    operation: "none",
    statuses: ["disease"],
  },
  {
    id: "thorns",
    keys: ["thorns"],
    operation: "none",
    statuses: ["thorns"],
  },
  {
    id: "frost",
    keys: ["frost", "frozen"],
    operation: "none",
    statuses: ["frozen"],
  },
  {
    id: "mindwipe",
    keys: ["mindwipe", "mindwiped"],
    operation: "none",
    statuses: ["mindwiped"],
  },
  {
    id: "confused",
    keys: ["confuse", "confused"],
    operation: "none",
    statuses: ["confused"],
  },
  {
    id: "intoxication",
    keys: ["intoxicated", "intoxication", "hangover", "drunk"],
    operation: "none",
    statuses: ["confused"],
  },
  {
    id: "hallucinating",
    keys: ["hallucinating", "hallucination"],
    operation: "none",
    statuses: ["hallucinating"],
  },
  {
    id: "weakened",
    keys: ["weaken", "weakened"],
    operation: "none",
    statuses: ["weakened"],
  },
  {
    id: "cursed",
    keys: ["curse", "cursed"],
    operation: "none",
    statuses: ["cursed"],
  },
  {
    id: "blessed",
    keys: ["bless", "blessed"],
    operation: "none",
    statuses: ["blessed"],
  },
  {
    id: "stoneskin",
    keys: ["stoneskin", "stone_skin"],
    operation: "none",
    statuses: ["stoneskin"],
  },
  {
    id: "taunt",
    keys: ["taunt", "taunted"],
    operation: "none",
    statuses: ["taunted"],
  },
  {
    id: "berserk",
    keys: ["berserk", "berserking"],
    operation: "none",
    statuses: ["berserk"],
  },
  {
    id: "stamina_restore",
    keys: ["stamina_restore"],
    operation: "stamina_restore",
    statuses: ["energized"],
  },
  {
    id: "stamina_regen_boost",
    keys: ["stamina_regen_boost"],
    operation: "stamina_restore",
    statuses: ["energized"],
  },
  {
    id: "mana_restore",
    keys: ["mana_restore"],
    operation: "mana_restore",
    statuses: ["mana_surge"],
  },
  {
    id: "mana_regen_boost",
    keys: ["mana_regen_boost"],
    operation: "mana_restore",
    statuses: ["mana_surge"],
  },
  {
    id: "resist_fire",
    keys: ["resist_fire"],
    operation: "none",
    statuses: ["resist_fire"],
  },
  {
    id: "resist_poison",
    keys: ["resist_poison"],
    operation: "none",
    statuses: ["resist_poison"],
  },
  {
    id: "resist_electric",
    keys: ["resist_electric"],
    operation: "none",
    statuses: ["resist_electric"],
  },
  {
    id: "resist_acid",
    keys: ["resist_acid"],
    operation: "none",
    statuses: ["resist_acid"],
  },
  {
    id: "lucky",
    keys: ["lucky"],
    operation: "none",
    statuses: ["lucky"],
  },
  {
    id: "agony",
    keys: ["agony"],
    operation: "damage",
    statuses: ["agony"],
  },
  {
    id: "blinded",
    keys: ["blinded", "blind"],
    operation: "none",
    statuses: ["blinded"],
  },
];
