// display/util/rng.js
// Visual-only RNG; mulberry32-based and returns a 0..1 PRNG function.
// Re-exports from the canonical ecs-js mulberry32 with a non-zero fallback seed.

import { mulberry32 } from '../../lib/ecs-js/rng.js';

export function makeRng(seed = 0) {
  return mulberry32((seed >>> 0) || 0x12345678);
}
