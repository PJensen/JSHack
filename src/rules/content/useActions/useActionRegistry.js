// Registry mapping item identities to use-action handlers.
// Items declare themselves here; systems look them up instead of branching on identity.

/** @typedef {{
 *   targeting?: object,
 *   channelTurns?: number | function,
 *   validate?: function,
 *   onComplete?: function,
 * }} UseAction */

/** @type {Map<string, UseAction>} */
const _registry = new Map();

/**
 * @param {string} itemIdentity
 * @param {UseAction} def
 */
export function defineUseAction(itemIdentity, def) {
  const id = String(itemIdentity || "").trim();
  if (!id) throw new Error("[defineUseAction] itemIdentity is required");
  if (!def || typeof def !== "object") throw new Error(`[defineUseAction "${id}"] def is required`);
  _registry.set(id, Object.freeze({ ...def }));
}

/**
 * @param {string} itemIdentity
 * @returns {UseAction|null}
 */
export function getUseAction(itemIdentity) {
  return _registry.get(String(itemIdentity)) || null;
}

/**
 * Backward-compatible aliases for the first migration pass.
 * New code should use defineUseAction/getUseAction.
 *
 * @param {string} itemIdentity
 * @param {UseAction} def
 */
export function defineChannelAction(itemIdentity, def) {
  defineUseAction(itemIdentity, def);
}

/**
 * @param {string} itemIdentity
 * @returns {UseAction|null}
 */
export function getChannelAction(itemIdentity) {
  return getUseAction(itemIdentity);
}
