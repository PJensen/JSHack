import { defineComponent } from '../../lib/ecs-js/index.js';

/**
 * Collider component representing collision properties of an entity.
 * @property {boolean} solid - Whether the entity blocks movement.
 * @property {boolean} blocksSight - Whether the entity blocks line of sight.
 */
export const Collider = defineComponent('Collider', {
  solid: true,       // blocks movement if true
  blocksSight: false // line of sight blocking
});