// Deity.js
// Defines the Deity component for entities (e.g., player, NPCs)
// Usage: Attach to entities to represent their chosen or assigned deity/patron.

import { defineComponent } from '../../lib/ecs/core.js';

// Example deity: 'Zeus', 'Athena', 'None', etc.
// Value is a string or enum-like value.

const Deity = defineComponent('Deity', {
  name: '', // e.g., 'Zeus', 'Athena', etc.
});

export default Deity;
