// Tombstone.js
// Component for marking a tombstone entity (e.g., where a player or monster died)
import { defineComponent } from "../../lib/ecs-js/core.js";

const Tombstone = defineComponent({
  name: '',        // Name of the deceased entity
  cause: '',       // Cause of death (optional)
  turn: 0,         // Game turn when death occurred
  epitaph: '',     // Optional epitaph or message
});

export default Tombstone;