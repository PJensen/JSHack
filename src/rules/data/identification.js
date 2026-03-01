// rules/data/identification.js
// Type-level identification knowledge for the current game run.
// Tracks which item types (by identity string) the player has identified.
// Extensible: works for any identity string (gems now, scrolls/potions later).
//
// The system can be globally enabled/disabled. When disabled, isIdentified()
// always returns true (all items appear identified).

/** @type {boolean} */
let _enabled = true;

/** @type {Set<string>} */
const _identified = new Set();

/** Enable or disable the identification system globally. */
export function setIdentificationEnabled(on) {
  _enabled = !!on;
}

/** Returns true if the identification system is currently enabled. */
export function isIdentificationEnabled() {
  return _enabled;
}

/** Mark an identity as known. Returns true if this was newly identified. */
export function identify(identity) {
  if (_identified.has(identity)) return false;
  _identified.add(identity);
  return true;
}

/** Check if an identity is known. When the system is disabled, always true. */
export function isIdentified(identity) {
  if (!_enabled) return true;
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
