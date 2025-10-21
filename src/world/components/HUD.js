// HUD.js
// Component for representing HUD state and effects (singleton)
// Extend fields as needed for your game's HUD features
import { defineComponent } from '../../lib/ecs/core.js';

const HUD = defineComponent({
  health: 0,           // Player health to display
  maxHealth: 0,        // Max health for bar
  score: 0,            // Player score
  isHurting: false,    // For hurt animation/effect
  hurtTimer: 0,        // Time left for hurt effect
  notifications: [],   // Array of HUD messages/notifications
  // Add more fields as needed for animations, overlays, etc.
});

export default HUD;
