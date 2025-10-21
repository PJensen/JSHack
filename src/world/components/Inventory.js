// Inventory.js
// ECS Component: Inventory (list of item entity ids)
import { defineComponent } from '../../lib/ecs/core.js';

export const Inventory = defineComponent('Inventory', {
  items: []
});
