// rules/data/materialReactions.js
// Declarative material reaction rules interpreted by materialReactionSystem.

/**
 * Built-in reaction outcomes that the system knows how to execute.
 * Keep this list small and explicit so content stays safe and testable.
 */
export const MATERIAL_REACTION_OUTCOME_IDS = Object.freeze([
  "transmute_to_ash",
  "set_beatitude",
  "emit_waterlogged",
  "apply_water_exposure",
  "apply_material_stimulus",
]);

/**
 * @typedef {{
 *   itemTypes?: string[],
 *   materials?: string[],
 *   identities?: string[],
 * }} MaterialReactionMatch
 */

/**
 * @typedef {{
 *   id: string,
 *   match: MaterialReactionMatch,
 *   outcome: string,
 *   state?: "blessed" | "uncursed" | "cursed",
 *   waterTypes?: Array<"holy" | "unholy" | "plain">,
 *   stimulusKind?: string,
 *   mode?: string,
 *   intensity?: number,
 *   duration?: number,
 *   transform?: string,
 *   result?: string,
 * }} MaterialReactionDef
 */

/**
 * @typedef {{
 *   id: string,
 *   sourceStatuses?: string[],
 *   sourceEvents?: string[],
 *   itemScopes: Array<"ground"|"inventory"|"target">,
 *   eventKind: string,
 *   reactions: MaterialReactionDef[],
 * }} MaterialReactionRule
 */

/** @type {MaterialReactionRule[]} */
export const MATERIAL_REACTION_RULES = [
  {
    id: "burning_items_combust",
    sourceStatuses: ["burning", "burn"],
    itemScopes: ["ground", "inventory"],
    eventKind: "burning",
    reactions: [
      {
        id: "paper_scroll_to_ash",
        match: {
          itemTypes: ["scroll"],
          materials: ["paper"],
        },
        outcome: "apply_material_stimulus",
        stimulusKind: "fire",
        intensity: 2,
        duration: 1,
        mode: "contact",
        transform: "ash",
        result: "ash",
      },
    ],
  },
  {
    id: "water_dip_sets_potion_beatitude",
    sourceEvents: ["water:dipped"],
    itemScopes: ["target"],
    eventKind: "water:dipped",
    reactions: [
      {
        id: "holy_water_blesses_potion",
        match: { itemTypes: ["potion"] },
        waterTypes: ["holy"],
        outcome: "set_beatitude",
        state: "blessed",
        result: "blessed",
      },
      {
        id: "unholy_water_curses_potion",
        match: { itemTypes: ["potion"] },
        waterTypes: ["unholy"],
        outcome: "set_beatitude",
        state: "cursed",
        result: "cursed",
      },
      {
        id: "plain_water_uncurses_potion",
        match: { itemTypes: ["potion"] },
        waterTypes: ["plain"],
        outcome: "set_beatitude",
        state: "uncursed",
        result: "uncursed",
      },
    ],
  },
  {
    id: "water_dip_sets_equipment_beatitude",
    sourceEvents: ["water:dipped"],
    itemScopes: ["target"],
    eventKind: "water:dipped",
    reactions: [
      {
        id: "holy_water_uncurses_equipment",
        match: { itemTypes: ["equip"] },
        waterTypes: ["holy"],
        outcome: "set_beatitude",
        state: "uncursed",
        result: "uncursed",
      },
      {
        id: "unholy_water_curses_equipment",
        match: { itemTypes: ["equip"] },
        waterTypes: ["unholy"],
        outcome: "set_beatitude",
        state: "cursed",
        result: "cursed",
      },
    ],
  },
  {
    id: "water_dip_waterlogs_paper",
    sourceEvents: ["water:dipped"],
    itemScopes: ["target"],
    eventKind: "water:dipped",
    reactions: [
      {
        id: "dipped_scroll_waterlogged",
        match: { itemTypes: ["scroll", "learn"] },
        outcome: "apply_water_exposure",
        result: "waterlogged",
      },
      {
        id: "dipped_paper_item_waterlogged",
        match: { materials: ["paper"] },
        outcome: "apply_water_exposure",
        result: "waterlogged",
      },
    ],
  },
  {
    id: "water_dip_applies_nonmetal_conditions",
    sourceEvents: ["water:dipped"],
    itemScopes: ["target"],
    eventKind: "water:dipped",
    reactions: [
      {
        id: "dipped_wood_item_swollen",
        match: { materials: ["wood"] },
        outcome: "apply_water_exposure",
        result: "swollen",
      },
      {
        id: "dipped_food_soggy",
        match: { itemTypes: ["food"] },
        outcome: "apply_water_exposure",
        result: "soggy",
      },
      {
        id: "dipped_organic_item_soggy",
        match: { materials: ["flesh", "leather", "wool", "cloth", "bone", "ivory", "horn", "shell"] },
        outcome: "apply_water_exposure",
        result: "soggy",
      },
      {
        id: "dipped_glass_potion_diluted",
        match: { itemTypes: ["potion"], materials: ["glass", "soul-glass", "glass-fiber"] },
        outcome: "apply_water_exposure",
        result: "diluted",
      },
    ],
  },
];
