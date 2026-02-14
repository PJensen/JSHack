// rules/data/gemPricing.js
// Appearance-based price columns for unidentified gems.
// Each game run shuffles price buckets so the same "red gem" appearance
// has a different sell value each game (NetHack-style).

import { GEM_DEFS } from "./gems.js";

/** Price buckets — one per unique gem appearance group. */
const PRICE_BUCKETS = [100, 200, 350, 500, 700, 1000, 1500, 2000, 3000];

/** @type {Map<string, number>} appearance → unidentified sell value */
const _priceMap = new Map();

/** Collect unique appearance strings from gem/glass entries (not rocks). */
function uniqueAppearances() {
  const set = new Set();
  for (const def of Object.values(GEM_DEFS)) {
    if (def.material === 'mineral') continue; // gray stones / rocks excluded
    set.add(def.appearance);
  }
  return Array.from(set);
}

/**
 * Fisher-Yates shuffle (in-place).
 * @param {any[]} arr
 * @param {Object} rng - createRng() instance with .int(min,max)
 */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Initialize appearance-based pricing. Call once at game start.
 * @param {Object} rng - createRng() instance
 */
export function initGemPricing(rng) {
  _priceMap.clear();
  const appearances = uniqueAppearances();
  const buckets = PRICE_BUCKETS.slice();
  shuffle(buckets, rng);
  for (let i = 0; i < appearances.length; i++) {
    _priceMap.set(appearances[i], buckets[i % buckets.length]);
  }
}

/**
 * Get the unidentified sell value for a gem appearance string.
 * Returns 0 if appearance is unknown (shouldn't happen for gems).
 * @param {string} appearance
 * @returns {number}
 */
export function getUnidentifiedGemValue(appearance) {
  return _priceMap.get(appearance) || 0;
}

/** Reset pricing (new game). */
export function resetGemPricing() {
  _priceMap.clear();
}

/** Snapshot for save/load. */
export function getGemPricingSnapshot() {
  return Array.from(_priceMap.entries());
}

/** Restore from snapshot. */
export function restoreGemPricing(entries) {
  _priceMap.clear();
  if (Array.isArray(entries)) {
    for (const [k, v] of entries) _priceMap.set(k, v);
  }
}
