// MeleeAttack.js
// ECS Component: Intent for a single melee attack resolution.
// Attach to a transient entity with data referencing attacker/target.
import { defineComponent } from '../../lib/ecs/core.js';

export const MeleeAttack = defineComponent('MeleeAttack', {
  attacker: null,  // entity id of the attacker
  target: null,    // entity id of the target
  // Optional explicit position of impact (tile coords)
  x: null,
  y: null,
  // Optional tags or weapon key for downstream logic
  tags: null
});

export default MeleeAttack;
