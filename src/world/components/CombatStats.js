// CombatStats.js
// ECS Component: Base combat statistics for entities that can attack/defend.
// Keep minimal but extensible; derived bonuses from Equipment/Affixes can be
// added at calculation time without bloating this component.
import { defineComponent } from '../../lib/ecs/core.js';

export const CombatStats = defineComponent('CombatStats', {
  // Base attack damage range; inclusive integers
  atkMin: 3,
  atkMax: 6,
  // Chance [0..1] and multiplier for critical hits
  critChance: 0.1,
  critMult: 1.5,
  // Flat defense mitigation applied to incoming hits
  defense: 0
});

export default CombatStats;
