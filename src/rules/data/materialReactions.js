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
        outcome: "transmute_to_ash",
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
        outcome: "emit_waterlogged",
        result: "waterlogged",
      },
      {
        id: "dipped_paper_item_waterlogged",
        match: { materials: ["paper"] },
        outcome: "emit_waterlogged",
        result: "waterlogged",
      },
    ],
  },
];
