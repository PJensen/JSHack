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
    id: "shock",
    keys: ["shock", "shocked"],
    operation: "none",
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
];
