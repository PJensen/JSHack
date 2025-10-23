import { defineComponent } from '../../lib/ecs/core.js';

// Material: shading response for tiles/entities
// albedo: [r,g,b] linear 0..1
export const Material = defineComponent('Material', {
  albedo: [0.8, 0.8, 0.8],
  roughness: 0.8, // 0 mirror .. 1 matte
  metalness: 0.0,
  specular: 0.2
});
