// rules/data/effectDefs.js
// Declarative effect behavior definitions interpreted by effectSystem.

export const EFFECT_OPERATION_IDS = Object.freeze([
  "none",
  "damage",
  "heal",
]);

/**
 * @typedef {{
 *   id: string,
 *   keys: string[],
 *   operation: "none" | "damage" | "heal",
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
];

