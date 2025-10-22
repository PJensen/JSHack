// Trap.js
// ECS Component: Trap data for entities that trigger when stepped on or activated
import { defineComponent } from '../../lib/ecs/core.js';

// Fields chosen to keep trap-specific data only. Reusable concerns should be
// expressed via `Trigger`, `Latch`, and `Visibility` components attached to
// the same entity.
// - damage: numeric damage dealt when triggered
// - type: string identifier for trap behaviour (e.g., 'spike','pit','fire')
// - effectRef: optional `ScriptRef` or `Effect` id to run when triggered
// - tags: optional metadata tags for behaviour/customization
export const Trap = defineComponent('Trap', {
  damage: 1,
  type: 'spike',
  effectRef: null,
  tags: []
});
