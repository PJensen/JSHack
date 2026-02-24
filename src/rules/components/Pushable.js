import { defineTag } from '../../lib/ecs-js/index.js';

// Marks an entity as pushable by the player (e.g. statues).
// Push resolves via the push-entity bump resolver.
export const Pushable = defineTag('Pushable');
