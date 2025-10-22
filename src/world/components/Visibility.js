// Visibility.js
// ECS Component: simple visibility/hidden flags for entities
import { defineComponent } from '../../lib/ecs/core.js';

export const Visibility = defineComponent('Visibility', {
  visible: true,         // whether the entity is visible by default
  revealOnTrigger: false // if true, becomes visible when triggered
});
