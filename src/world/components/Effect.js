// Effect.js
// ECS Component: Visual or status effect instance
import { defineComponent } from '../../lib/ecs/core.js';

export const Effect = defineComponent('Effect', {
  // Effect type, e.g. 'float_text', 'particle_burst', 'lightning', 'ripple'
  type: '',
  // Remaining time to live (seconds)
  ttl: 0,
  // Max lifetime (seconds) - useful for progress easing
  ttlMax: 0,
  // World position {x,y} or null for screen-space
  pos: null,
  // Arbitrary effect-specific data (text, color, particles, path, etc.)
  data: null,
  // Layer: 'ground'|'mid'|'top'|'screen' or numeric z-order
  layer: 'mid',
  // Priority for trimming when budget constrained
  priority: 0
});
