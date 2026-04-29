// Registry mapping item identities to channeled-use action handlers.
// Items declare themselves here; systems look them up instead of branching on identity.

/** @type {Map<string, {onComplete: function}>} */
const _registry = new Map();

/**
 * @param {string} itemIdentity
 * @param {{ onComplete(world: any, actorId: number, ch: any): void }} def
 */
export function defineChannelAction(itemIdentity, def) {
  _registry.set(String(itemIdentity), def);
}

/**
 * @param {string} itemIdentity
 * @returns {{ onComplete: function }|null}
 */
export function getChannelAction(itemIdentity) {
  return _registry.get(String(itemIdentity)) || null;
}
