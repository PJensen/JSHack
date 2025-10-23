import { defineComponent } from '../../lib/ecs/core.js';

// Emissive: local glow that does not cast shadows
// color: [r,g,b] linear 0..1; strength: scalar; radius: kernel radius (tiles)
export const Emissive = defineComponent('Emissive', {
  color: [1, 1, 1],
  strength: 1,
  radius: 0,
  castsShadows: false
});
