import { defineComponent } from "../../lib/ecs-js/index.js";

// Tracks semantic status flags on an entity, typically derived from ActiveEffects.
// Shape: { statuses: Array<{ type: string, duration: number, potency?: number, stacks?: number }> }
export const Status = defineComponent('Status', {
  statuses: []
}, {
  validate(rec) {
    if (!rec || !Array.isArray(rec.statuses)) throw new Error('Status.statuses must be an array');
    for (const s of rec.statuses) {
      if (!s || typeof s !== 'object') throw new Error('Status entry must be an object');
      if (typeof s.type !== 'string' || !s.type) throw new Error('Status.type must be a non-empty string');
      if (!Number.isInteger(s.duration) || s.duration < 0) throw new Error('Status.duration must be an integer ≥ 0');
      if (s.potency != null && typeof s.potency !== 'number') throw new Error('Status.potency must be a number');
      if (s.stacks != null && (!Number.isInteger(s.stacks) || s.stacks < 1)) throw new Error('Status.stacks must be an integer ≥ 1');
    }
    return true;
  }
});
