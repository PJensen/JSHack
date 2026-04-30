import { defineComponent } from '../../lib/ecs-js/index.js';

// Legacy compatibility component.
// Runtime topology should prefer attached StatusEffectNode / TimedEffectNode
// entities. See RUNTIME_TOPOLOGY_DOCTRINE.md before adding new effect families
// that write directly to effects[].
function  isEffect(e) {
  if (!e || typeof e !== 'object') throw new Error('ActiveEffects: effect must be an object');
  if (typeof e.key !== 'string' || !e.key) throw new Error('ActiveEffects: key must be a non-empty string');
  if (!Number.isInteger(e.turnsLeft) || e.turnsLeft < 0) throw new Error('ActiveEffects: turnsLeft must be ≥ 0');
  if (e.stacks != null && (!Number.isInteger(e.stacks) || e.stacks < 1))
    throw new Error('ActiveEffects: stacks must be an integer ≥ 1');
  if (e.potency != null && typeof e.potency !== 'number')
    throw new Error('ActiveEffects: potency must be a number');
  if (e.startedAtTurn != null && !Number.isFinite(e.startedAtTurn))
    throw new Error('ActiveEffects: startedAtTurn must be numeric');
  if (e.sourceId != null && !Number.isInteger(e.sourceId))
    throw new Error('ActiveEffects: sourceId must be an integer');
  return true;
}

export const ActiveEffects = defineComponent(
  'ActiveEffects',
  { effects: [] },
  {
    validate(rec) {
      if (!rec || !Array.isArray(rec.effects))
        throw new Error('ActiveEffects: effects must be an array');
      for (const e of rec.effects) isEffect(e);
      return true;
    }
  }
);
