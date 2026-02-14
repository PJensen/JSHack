// rules/data/itemUseDefs.js
// Declarative item-use behavior definitions interpreted by useItemSystem.

/**
 * @typedef {{
 *   itemTypes?: string[],
 *   identityPrefix?: string,
 * }} ItemUseMatch
 */

/**
 * @typedef {{
 *   world: any,
 *   actor: number,
 *   itemId: number,
 *   intent: { targetId?: number } | null,
 *   info: { type?: string, description?: string, count?: number } | null,
 *   identity: string,
 *   helpers: {
 *     castSpellFromIdentity: (opts:{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }) => boolean,
 *     learnSpellFromIdentity: (opts:{ identityPrefix:string, consumeOnSuccess?:boolean }) => boolean,
 *     emit: (eventName:string, payload:Record<string, any>) => void,
 *   },
 * }} ItemUseActionContext
 */

/**
 * @typedef {{
 *   id: string,
 *   match: ItemUseMatch,
 *   action: (context: ItemUseActionContext) => boolean,
 * }} ItemUseDef
 */

export const ITEM_USE_ACTIONS = Object.freeze({
  /**
   * @param {{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }} opts
   * @returns {(context: ItemUseActionContext) => boolean}
   */
  castSpellFromIdentity(opts) {
    const identityPrefix = String(opts?.identityPrefix || "");
    const targetMode = /** @type {"intentTarget"|"self"|"none"} */ (String(opts?.targetMode || "self"));
    const castEventSource = opts?.castEventSource;
    const consumeOnSuccess = opts?.consumeOnSuccess !== false;
    return ({ helpers }) => helpers.castSpellFromIdentity({
      identityPrefix,
      targetMode,
      castEventSource,
      consumeOnSuccess,
    });
  },

  /**
   * @param {{ identityPrefix:string, consumeOnSuccess?:boolean }} opts
   * @returns {(context: ItemUseActionContext) => boolean}
   */
  learnSpellFromIdentity(opts) {
    const identityPrefix = String(opts?.identityPrefix || "");
    const consumeOnSuccess = opts?.consumeOnSuccess !== false;
    return ({ helpers }) => helpers.learnSpellFromIdentity({
      identityPrefix,
      consumeOnSuccess,
    });
  },
});

/** @type {ItemUseDef[]} */
export const ITEM_USE_DEFS = [
  {
    id: "wand_cast_from_identity",
    match: {
      itemTypes: ["wand"],
      identityPrefix: "wand_",
    },
    action: ITEM_USE_ACTIONS.castSpellFromIdentity({
      identityPrefix: "wand_",
      targetMode: "intentTarget",
      castEventSource: "wand",
      consumeOnSuccess: true,
    }),
  },
  {
    id: "scroll_cast_from_identity",
    match: {
      itemTypes: ["scroll"],
      identityPrefix: "scroll_",
    },
    action: ITEM_USE_ACTIONS.castSpellFromIdentity({
      identityPrefix: "scroll_",
      targetMode: "self",
      consumeOnSuccess: true,
    }),
  },
  {
    id: "book_learn_from_identity",
    match: {
      itemTypes: ["learn", "book"],
      identityPrefix: "book_",
    },
    action: ITEM_USE_ACTIONS.learnSpellFromIdentity({
      identityPrefix: "book_",
      consumeOnSuccess: true,
    }),
  },
];
