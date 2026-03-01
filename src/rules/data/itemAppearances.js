// rules/data/itemAppearances.js
// Maps item slots/types to their unidentified display labels.
// Items that are not yet identified show as "Unidentified <Label>" in the UI.

import { isIdentificationEnabled } from './identification.js';

/**
 * Categories of items that require identification.
 * Maps item type or slot to the unidentified display label.
 * @type {Record<string, string>}
 */
const UNIDENTIFIED_LABELS = Object.freeze({
  // jewelry
  neck: "Amulet",
  ring: "Ring",
  // magic item types
  scroll: "Scroll",
  potion: "Potion",
  wand: "Wand",
});

/**
 * Item types that are exempt from the identification system.
 * These always show their true name.
 * @type {ReadonlySet<string>}
 */
const EXEMPT_TYPES = Object.freeze(new Set([
  "currency",
  "ammo",
  "food",
  "gem",    // gems use their own identification via touchstone
  "misc",
  "learn",  // spellbooks show their name (you learn by reading)
  "book",
]));

/**
 * Returns the unidentified display name for an item, or null if the item
 * category is exempt from identification.
 *
 * @param {{ type?: string, slot?: string }} itemInfo
 * @returns {string|null}
 */
export function getUnidentifiedName(itemInfo) {
  const type = String(itemInfo?.type || "").toLowerCase();
  if (EXEMPT_TYPES.has(type)) return null;

  // Magic item types (scroll, potion, wand) use type as key
  if (UNIDENTIFIED_LABELS[type]) return `Unidentified ${UNIDENTIFIED_LABELS[type]}`;

  // Equipment uses slot as key
  const slot = String(itemInfo?.slot || "").toLowerCase();
  if (UNIDENTIFIED_LABELS[slot]) return `Unidentified ${UNIDENTIFIED_LABELS[slot]}`;

  return null;
}

/**
 * Returns true if this item type/slot is subject to the identification system.
 * Always returns false when the identification system is globally disabled.
 *
 * @param {{ type?: string, slot?: string }} itemInfo
 * @returns {boolean}
 */
export function requiresIdentification(itemInfo) {
  if (!isIdentificationEnabled()) return false;
  return getUnidentifiedName(itemInfo) !== null;
}
