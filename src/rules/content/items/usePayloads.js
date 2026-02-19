import { getCatalogItem } from "../../data/itemCatalog.js";
import {
  createCastSpellFromIdentityOnUse,
  createConsumableScriptOnUse,
  createLearnSpellFromIdentityOnUse,
  openDeathLogOnUse,
  openFlavorBookOnUse,
} from "./useHelpers.js";

export const USE_ITEM_PAYLOADS = Object.freeze({
  book_dead: Object.freeze({
    id: "book_dead_open_deathlog",
    onUse: openDeathLogOnUse,
  }),
});

export const USE_ITEM_MATCHER_PAYLOADS = Object.freeze([
  Object.freeze({
    id: "book_flavor_open_reader",
    matches: (state) => {
      if (state.identity === "book_dead") return false;
      const def = getCatalogItem(state.identity);
      return !!(def && String(def.type || "") === "book" && def.flavorText);
    },
    onUse: openFlavorBookOnUse,
  }),
  Object.freeze({
    id: "wand_cast_from_identity",
    matches: (state) => {
      return state.identity.startsWith("wand_") && String(state.info?.type || "").toLowerCase() === "wand";
    },
    onUse: createCastSpellFromIdentityOnUse({
      identityPrefix: "wand_",
      targetMode: "intentTarget",
      castEventSource: "wand",
      consumeOnSuccess: true,
    }),
  }),
  Object.freeze({
    id: "scroll_cast_from_identity",
    matches: (state) => {
      return state.identity.startsWith("scroll_") && String(state.info?.type || "").toLowerCase() === "scroll";
    },
    onUse: createCastSpellFromIdentityOnUse({
      identityPrefix: "scroll_",
      targetMode: "self",
      consumeOnSuccess: true,
    }),
  }),
  Object.freeze({
    id: "book_learn_from_identity",
    matches: (state) => {
      const type = String(state.info?.type || "").toLowerCase();
      return state.identity.startsWith("book_") && (type === "learn" || type === "book");
    },
    onUse: createLearnSpellFromIdentityOnUse({
      identityPrefix: "book_",
      consumeOnSuccess: true,
    }),
  }),
]);

export const USE_EFFECT_PAYLOADS = Object.freeze({
  "consumable:eat": Object.freeze({
    id: "consumable_eat_script",
    onUse: createConsumableScriptOnUse("consumable:eat"),
  }),
  "consumable:mapping": Object.freeze({
    id: "consumable_mapping_script",
    onUse: createConsumableScriptOnUse("consumable:mapping"),
  }),
});

/**
 * Resolve a first-class use payload object for the current item state.
 * Priority:
 * 1. Consumable effect-key payload object
 * 2. Exact item identity payload object
 * 3. Matcher payload object
 *
 * @param {{
 *   identity: string,
 *   info: any,
 *   consumable: any,
 * }} state
 */
export function findUsePayload(state) {
  const effectKey = String(state?.consumable?.effectKey || "");
  if (effectKey) {
    const payload = USE_EFFECT_PAYLOADS[effectKey];
    if (payload) return { ...payload, source: "effect" };
    return {
      id: `script:${effectKey}`,
      onUse: createConsumableScriptOnUse(effectKey),
      source: "effect",
    };
  }

  const identity = String(state?.identity || "");
  const direct = USE_ITEM_PAYLOADS[identity];
  if (direct) return { ...direct, source: "identity" };

  for (let i = 0; i < USE_ITEM_MATCHER_PAYLOADS.length; i++) {
    const payload = USE_ITEM_MATCHER_PAYLOADS[i];
    try {
      if (payload.matches(state)) return { ...payload, source: "matcher" };
    } catch {}
  }

  return null;
}
