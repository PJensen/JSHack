// rules/data/identification.js
// Type-level identification knowledge for the current game run.
// Tracks which item types (by identity string) the player has identified.
// Extensible: works for any identity string (gems now, scrolls/potions later).

/** @type {Set<string>} */
const _identified = new Set();

/** Mark an identity as known. Returns true if this was newly identified. */
export function identify(identity) {
  if (_identified.has(identity)) return false;
  _identified.add(identity);
  return true;
}

/** Check if an identity is known. */
export function isIdentified(identity) {
  return _identified.has(identity);
}

/** Reset all knowledge (new game). */
export function resetIdentification() {
  _identified.clear();
}

/** Get a snapshot of all identified identities (for serialization). */
export function getIdentifiedSnapshot() {
  return Array.from(_identified);
}

/** Restore from snapshot (deserialization). */
export function restoreIdentification(arr) {
  _identified.clear();
  if (Array.isArray(arr)) arr.forEach(id => _identified.add(id));
}
