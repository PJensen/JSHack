import { defineWorldResource } from "../../lib/ecs-js/index.js";

/**
 * Runtime-only buffer of semantic material reaction events captured by
 * listeners and drained by materialReactionSystem. This is listener plumbing,
 * not durable simulation state, so it must not be serialized.
 */
export const MaterialReactionEventQueueResource = defineWorldResource(
  "jshack:materialReactions:eventQueue",
  {
    create: () => ({ nextId: 0, events: [] }),
    reset: (queue) => {
      queue.nextId = 0;
      queue.events.length = 0;
    },
  },
);
