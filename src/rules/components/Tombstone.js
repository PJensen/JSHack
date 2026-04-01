// Tombstone.js
// Component for marking a tombstone entity (e.g., where a player or monster died)
import { defineComponent } from "../../lib/ecs-js/core.js";

export const Tombstone = defineComponent({
  playerName: '',  // Name of the deceased entity
  depth: 0,        // Floor depth where death occurred
  cause: '',       // Cause of death ('combat', 'starvation', 'trap', etc.)
  killerName: null, // Name of killer entity (null for environmental deaths)
  turn: 0,         // Game turn when death occurred
  epitaph: '',     // Formatted epitaph message for display
});