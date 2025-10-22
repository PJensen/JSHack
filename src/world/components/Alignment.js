// Alignment.js
// Defines the Alignment component for entities (e.g., player, monsters, NPCs)
// Usage: Attach to entities to represent their moral or faction alignment.

import { defineComponent } from '../../lib/ecs/core.js';

// Enumerated axes for alignment
export const LawChaosAxis = Object.freeze({
  LAWFUL: 'lawful',
  NEUTRAL: 'neutral',
  CHAOTIC: 'chaotic'
});

export const GoodEvilAxis = Object.freeze({
  GOOD: 'good',
  NEUTRAL: 'neutral',
  EVIL: 'evil'
});

// Two-axis alignment: law/chaos and good/evil
export const Alignment = defineComponent('Alignment', {
  lawChaos: LawChaosAxis.NEUTRAL, // 'lawful', 'neutral', or 'chaotic'
  goodEvil: GoodEvilAxis.NEUTRAL  // 'good', 'neutral', or 'evil'
});

export default Alignment;
