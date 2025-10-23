import { defineComponent } from '../../lib/ecs/core.js';

// LightProbe: per-entity hint for specular highlights
export const LightProbe = defineComponent('LightProbe', {
  receiveShadows: true,
  normal2D: null,       // [nx,ny]
  specularBoost: 1.0
});
