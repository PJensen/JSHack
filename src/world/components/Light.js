// Light.js
// ECS Component: Simple point light for rendering/visibility experiments
import { defineComponent } from '../../lib/ecs/core.js';

export const Light = defineComponent('Light', {
  radius: 0,       // light radius in tiles
  color: '#ffffaa' // soft yellow default
});
