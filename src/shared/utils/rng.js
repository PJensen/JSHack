// shared/utils/rng.js
// Visual/game-agnostic RNG helpers. For rules, prefer world.rand where available.
// Re-exports from the canonical ecs-js mulberry32 with a non-zero fallback seed.

import { mulberry32 } from '../../lib/ecs-js/rng.js';

export function makeRng(seed = 0) {
  return mulberry32((seed >>> 0) || 0x12345678);
}
