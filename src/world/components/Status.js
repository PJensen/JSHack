// Status.js
// ECS Component: Status effects (timed, per-entity)
import { defineComponent } from '../../lib/ecs/core.js';

export const Status = defineComponent('Status', {
  statuses: [] // array of {type, duration, ...}
});
