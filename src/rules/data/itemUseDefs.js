// rules/data/itemUseDefs.js
// Function-first item-use behavior definitions interpreted by useItemSystem.

export const ITEM_USE_TYPE = Object.freeze({
  WAND: "wand",
  SCROLL: "scroll",
  LEARN: "learn",
  BOOK: "book",
});

export const ITEM_IDENTITY_PREFIX = Object.freeze({
  WAND: "wand_",
  SCROLL: "scroll_",
  BOOK: "book_",
});

/**
 * @param {import("../utils/actionContexts.js").ItemUseActionContext} ctx
 * @param {{ itemTypes?: string[], identityPrefix?: string }} match
 */
function matchesLegacyShape(ctx, match) {
  if (!match || typeof match !== "object") return false;
  const type = String(ctx.info?.type || "").toLowerCase();
  const identity = String(ctx.identity || "").toLowerCase();
  const itemTypes = Array.isArray(match.itemTypes)
    ? match.itemTypes.map((v) => String(v || "").toLowerCase()).filter(Boolean)
    : [];
  const identityPrefix = String(match.identityPrefix || "").toLowerCase();
  if (itemTypes.length > 0 && !itemTypes.includes(type)) return false;
  if (identityPrefix && !identity.startsWith(identityPrefix)) return false;
  return itemTypes.length > 0 || !!identityPrefix;
}

/**
 * @param {{ itemTypes?: string[], identityPrefix?: string }} match
 */
function createMatcher(match) {
  return (ctx) => matchesLegacyShape(ctx, match);
}

export const ITEM_USE_ACTIONS = Object.freeze({
  /**
   * @param {{ identityPrefix:string, targetMode?:"intentTarget"|"self"|"none", castEventSource?:string, consumeOnSuccess?:boolean }} opts
   */
  castSpellFromIdentity(opts) {
    const identityPrefix = String(opts?.identityPrefix || "");
    const targetMode = /** @type {"intentTarget"|"self"|"none"} */ (String(opts?.targetMode || "self"));
    const castEventSource = opts?.castEventSource;
    const consumeOnSuccess = opts?.consumeOnSuccess !== false;
    return (ctx) => ctx.castSpellFromIdentity({
      identityPrefix,
      targetMode,
      castEventSource,
      consumeOnSuccess,
    });
  },

  /**
   * @param {{ identityPrefix:string, consumeOnSuccess?:boolean }} opts
   */
  learnSpellFromIdentity(opts) {
    const identityPrefix = String(opts?.identityPrefix || "");
    const consumeOnSuccess = opts?.consumeOnSuccess !== false;
    return (ctx) => ctx.learnSpellFromIdentity({
      identityPrefix,
      consumeOnSuccess,
    });
  },
});

/**
 * @typedef {{
 *   id: string,
 *   matches?: (ctx: import("../utils/actionContexts.js").ItemUseActionContext) => boolean,
 *   match?: { itemTypes?: string[], identityPrefix?: string },
 *   run?: (ctx: import("../utils/actionContexts.js").ItemUseActionContext) => boolean,
 *   action?: (ctx: import("../utils/actionContexts.js").ItemUseActionContext) => boolean,
 * }} ItemUseDef
 */

/** @type {ItemUseDef[]} */
export const ITEM_USE_DEFS = [
  {
    id: "wand_cast_from_identity",
    matches: createMatcher({
      itemTypes: [ITEM_USE_TYPE.WAND],
      identityPrefix: ITEM_IDENTITY_PREFIX.WAND,
    }),
    run: ITEM_USE_ACTIONS.castSpellFromIdentity({
      identityPrefix: ITEM_IDENTITY_PREFIX.WAND,
      targetMode: "intentTarget",
      castEventSource: ITEM_USE_TYPE.WAND,
      consumeOnSuccess: true,
    }),
  },
  {
    id: "scroll_cast_from_identity",
    matches: createMatcher({
      itemTypes: [ITEM_USE_TYPE.SCROLL],
      identityPrefix: ITEM_IDENTITY_PREFIX.SCROLL,
    }),
    run: ITEM_USE_ACTIONS.castSpellFromIdentity({
      identityPrefix: ITEM_IDENTITY_PREFIX.SCROLL,
      targetMode: "self",
      consumeOnSuccess: true,
    }),
  },
  {
    id: "book_learn_from_identity",
    matches: createMatcher({
      itemTypes: [ITEM_USE_TYPE.LEARN, ITEM_USE_TYPE.BOOK],
      identityPrefix: ITEM_IDENTITY_PREFIX.BOOK,
    }),
    run: ITEM_USE_ACTIONS.learnSpellFromIdentity({
      identityPrefix: ITEM_IDENTITY_PREFIX.BOOK,
      consumeOnSuccess: true,
    }),
  },
];

/**
 * @param {import("../utils/actionContexts.js").ItemUseActionContext} ctx
 */
export function findItemUseDef(ctx) {
  for (let i = 0; i < ITEM_USE_DEFS.length; i++) {
    const def = ITEM_USE_DEFS[i];
    const matcher = typeof def.matches === "function"
      ? def.matches
      : (def.match ? (c) => matchesLegacyShape(c, def.match) : null);
    if (!matcher) continue;
    try {
      if (matcher(ctx)) return def;
    } catch {}
  }
  return null;
}
