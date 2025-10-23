import { defineComponent } from '../../lib/ecs/core.js';

// Occluder: light blocking properties for tiles/entities
export const Occluder = defineComponent('Occluder', {
  opacity: 1.0,     // 1 = wall; 0 = fully transparent
  thickness: 1.0,   // thickness scale for exponential attenuation
  normal2D: null    // [nx,ny] optional, unit vector
});
