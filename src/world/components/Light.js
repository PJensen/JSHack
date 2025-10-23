// Light.js
// ECS Component: Dynamic light source (point/beam/ambient)
// Backward-compatible with legacy usage where color is a hex string.
import { defineComponent } from '../../lib/ecs/core.js';

export const Light = defineComponent('Light', {
  kind: 'point',      // 'point' | 'beam' | 'ambient'
  x: null,            // optional world position override (tiles, continuous)
  y: null,
  // Accept either hex string (legacy) or linear [r,g,b] via systems using converters
  color: [1.0, 0.94, 0.67],
  intensity: 1.0,     // brightness scalar
  radius: 6,          // max influence distance (tiles)
  falloff: { kL: 0.0, kQ: 1.0 }, // 1/(1+kL*r+kQ*r^2); pure inverse-square by default
  castsShadows: true,
  flickerSeed: null,  // optional deterministic flicker seed
  pulse: null,        // { periodMs, min, max }
  active: true,
  // Runtime effective intensity written by FlickerSystem
  intensityEff: null
});
