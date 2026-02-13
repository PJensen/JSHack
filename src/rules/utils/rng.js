// rules/utils/rng.js
// Game-specific RNG helpers for JSHack.
// Builds on the generic ecs-js mulberry32 PRNG with roguelike-specific
// utilities inspired by Nethack's RNG vocabulary.
//
// All helpers take a generator function rng: () => number (returning [0,1))
// as their first argument, keeping them composable with any seeded generator.
//
// Re-exports the ecs-js primitives so rules-layer code can import everything
// from one place.

// --- Re-exports from ecs-js (generic PRNG primitives) ---
export {
  mulberry32,
  createRng,
  seedFromString,
  rngFloat,
  rngInt,
  rngChoice,
  rngShuffle,
  rngShuffleInPlace,
  rngSelfTest,
} from '../../lib/ecs-js/rng.js';

// --- Seed derivation ---

/**
 * Derive a deterministic combat seed from world state and participant entity IDs.
 * Replaces the ad-hoc inline XOR pattern used across combat systems, monster
 * scripts, and affix triggers.
 * @param {number} worldSeed - world.seed
 * @param {number} step      - world.step (turn counter)
 * @param {number} entityA   - typically attacker entity ID
 * @param {number} entityB   - typically defender entity ID
 * @param {number} [salt=0]  - optional extra salt for disambiguation
 * @returns {number} 32-bit unsigned seed
 */
export function combatSeed(worldSeed, step, entityA, entityB, salt = 0) {
  return ((worldSeed >>> 0)
    ^ ((step * 0x9e3779b9) >>> 0)
    ^ (entityA >>> 0)
    ^ ((entityB << 16) >>> 0)
    ^ (salt >>> 0)) >>> 0;
}

// --- Nethack-style helpers ---

/**
 * rn2(rng, n) - random integer in [0, n). Nethack's workhorse.
 * @param {() => number} rng
 * @param {number} n - upper bound (exclusive), must be > 0
 * @returns {number}
 */
export function rn2(rng, n) {
  if (n <= 0) return 0;
  return Math.floor(rng() * n);
}

/**
 * rnd(rng, n) - random integer in [1, n]. Like rolling one n-sided die.
 * @param {() => number} rng
 * @param {number} n - number of sides (>= 1)
 * @returns {number}
 */
export function rnd(rng, n) {
  return 1 + Math.floor(rng() * Math.max(1, n));
}

/**
 * d(rng, count, sides) - roll `count` dice of `sides` sides, return sum.
 * Also accepts a string spec like "2d6".
 * @param {() => number} rng
 * @param {number|string} count - number of dice, or a "NdM" string
 * @param {number} [sides] - number of sides per die (ignored if count is a string)
 * @returns {number}
 */
export function d(rng, count, sides) {
  if (typeof count === 'string') {
    const m = /^\s*(\d+)d(\d+)\s*$/i.exec(count);
    if (!m) return 1;
    count = Math.max(1, parseInt(m[1], 10) | 0);
    sides = Math.max(2, parseInt(m[2], 10) | 0);
  }
  count = Math.max(1, count | 0);
  sides = Math.max(2, sides | 0);
  let sum = 0;
  for (let i = 0; i < count; i++) sum += rnd(rng, sides);
  return sum;
}

/**
 * Roll dice from a spec string like "2d6".
 * Convenience wrapper matching the (spec, rng) arg order used by combat code.
 * @param {string} spec - e.g. "2d6", "1d8"
 * @param {() => number} rng
 * @returns {number}
 */
export function rollDice(spec, rng) {
  return d(rng, spec);
}

/**
 * oneIn(rng, n) - returns true with probability 1/n.
 * @param {() => number} rng
 * @param {number} n - e.g., oneIn(rng, 4) is 25% chance
 * @returns {boolean}
 */
export function oneIn(rng, n) {
  return n > 0 && Math.floor(rng() * n) === 0;
}

/**
 * pct(rng, n) - returns true with probability n/100.
 * @param {() => number} rng
 * @param {number} n - percentage (0-100)
 * @returns {boolean}
 */
export function pct(rng, n) {
  return rng() * 100 < n;
}

/**
 * rnl(rng, x, luck) - luck-adjusted roll.
 * Returns true with probability ~1/x, decreased by positive luck.
 * Positive luck makes bad things less likely (effective denominator grows).
 * @param {() => number} rng
 * @param {number} x - base difficulty
 * @param {number} [luck=0] - positive = luckier (harder to trigger)
 * @returns {boolean}
 */
export function rnl(rng, x, luck = 0) {
  const adj = Math.max(1, x + luck);
  return Math.floor(rng() * adj) === 0;
}

/**
 * rne(rng, x) - exponential distribution for rare events.
 * Repeatedly roll rn2(x), counting successes until failure. Result >= 1.
 * Used for enchantment levels, rare spawns, etc.
 * @param {() => number} rng
 * @param {number} x - difficulty (higher = rarer high results)
 * @returns {number} >= 1
 */
export function rne(rng, x) {
  let result = 1;
  while (Math.floor(rng() * x) === 0 && result < 100) result++;
  return result;
}
