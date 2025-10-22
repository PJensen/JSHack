// Interactable.js
// ECS Component: Marks entity as interactable with optional interaction type
import { defineComponent } from '../../lib/ecs/core.js';

export const Interactable = defineComponent('Interactable', {
  type: 'generic', // e.g., 'door', 'chest', 'altar', 'portal'
  enabled: true,
  prompt: null // optional prompt text
});
