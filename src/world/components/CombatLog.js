// CombatLog.js
// Component for representing the combat log (singleton)
// Stores recent combat messages for display in the HUD or UI
import { defineComponent } from '../../lib/ecs/core.js';

const CombatLog = defineComponent({
  entries: [],      // Array of combat log entries (strings or objects)
  maxEntries: 50,   // Maximum number of entries to keep (adjust as needed)
});

export default CombatLog;
