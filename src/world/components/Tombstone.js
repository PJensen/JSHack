// Tombstone.js
// Component for marking a tombstone entity (e.g., where a player or monster died)
// Add fields as needed for your game (e.g., name, cause, turn, etc.)
import { defineComponent } from '../../lib/ecs/core.js';

const Tombstone = defineComponent({
  name: '',        // Name of the deceased entity
  cause: '',       // Cause of death (optional)
  turn: 0,         // Game turn when death occurred
  epitaph: '',     // Optional epitaph or message
});

export default Tombstone;
