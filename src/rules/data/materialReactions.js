// rules/data/materialReactions.js
// Declarative material reaction rules interpreted by materialReactionSystem.

/**
 * Built-in reaction outcomes that the system knows how to execute.
 * Keep this list small and explicit so content stays safe and testable.
 */
export const MATERIAL_REACTION_OUTCOME_IDS = Object.freeze([
  "transmute_to_ash",
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
 *   result?: string,
 * }} MaterialReactionDef
 */

/**
 * @typedef {{
 *   id: string,
 *   sourceStatuses: string[],
 *   itemScopes: Array<"ground"|"inventory">,
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
];

