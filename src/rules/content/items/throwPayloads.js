import { getItemHooksByIdentity } from "./itemHooks.js";

export const THROW_ITEM_PAYLOADS = Object.freeze({});
export const THROW_ITEM_MATCHER_PAYLOADS = Object.freeze([]);

/**
 * Resolve a first-class throw payload object for the current item state.
 * Priority:
 * 1. Exact item identity payload object
 * 2. Item-def throw hooks
 * 3. Matcher payload object
 *
 * @param {{
 *   identity: string,
 *   info?: any,
 *   intent?: any,
 * }} state
 */
export function findThrowPayload(state) {
  const identity = String(state?.identity || "");
  const direct = THROW_ITEM_PAYLOADS[identity];
  if (direct) return { ...direct, source: "identity" };

  const hooks = getItemHooksByIdentity(identity);
  const hasThrowHooks = (
    typeof hooks.beforeThrow === "function"
    || typeof hooks.onThrow === "function"
    || typeof hooks.afterThrow === "function"
  );
  if (hasThrowHooks) {
    return {
      id: `item:${identity}:hooks`,
      source: "itemHooks",
      beforeThrow: hooks.beforeThrow,
      onThrow: hooks.onThrow,
      afterThrow: hooks.afterThrow,
    };
  }

  for (let i = 0; i < THROW_ITEM_MATCHER_PAYLOADS.length; i++) {
    const payload = THROW_ITEM_MATCHER_PAYLOADS[i];
    try {
      if (payload.matches(state)) return { ...payload, source: "matcher" };
    } catch (e) { console.error('[throwPayloads] matcher failed:', e); }
  }

  return null;
}
