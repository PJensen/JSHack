// rules/data/itemUseDefs.js
// Declarative item-use behavior definitions interpreted by useItemSystem.

export const ITEM_USE_ACTION_IDS = Object.freeze([
  "cast_spell_from_identity",
  "learn_spell_from_identity",
]);

/**
 * @typedef {{
 *   itemTypes?: string[],
 *   identityPrefix?: string,
 * }} ItemUseMatch
 */

/**
 * @typedef {{
 *   id: string,
 *   match: ItemUseMatch,
 *   action: {
 *     kind: string,
 *     identityPrefix: string,
 *     targetMode?: "intentTarget" | "self" | "none",
 *     castEventSource?: string,
 *     consumeOnSuccess?: boolean,
 *   },
 * }} ItemUseDef
 */

/** @type {ItemUseDef[]} */
export const ITEM_USE_DEFS = [
  {
    id: "wand_cast_from_identity",
    match: {
      itemTypes: ["wand"],
      identityPrefix: "wand_",
    },
    action: {
      kind: "cast_spell_from_identity",
      identityPrefix: "wand_",
      targetMode: "intentTarget",
      castEventSource: "wand",
      consumeOnSuccess: true,
    },
  },
  {
    id: "scroll_cast_from_identity",
    match: {
      itemTypes: ["scroll"],
      identityPrefix: "scroll_",
    },
    action: {
      kind: "cast_spell_from_identity",
      identityPrefix: "scroll_",
      targetMode: "self",
      consumeOnSuccess: true,
    },
  },
  {
    id: "book_learn_from_identity",
    match: {
      itemTypes: ["learn", "book"],
      identityPrefix: "book_",
    },
    action: {
      kind: "learn_spell_from_identity",
      identityPrefix: "book_",
      consumeOnSuccess: true,
    },
  },
];

