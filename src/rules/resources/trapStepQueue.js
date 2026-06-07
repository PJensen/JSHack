import { defineWorldResource } from "../../lib/ecs-js/index.js";

/**
 * Runtime-only buffer of actor arrivals captured from movement events and
 * drained by trapSystem. This is listener plumbing, not durable simulation
 * state, so it must not be serialized.
 */
export const TrapStepQueueResource = defineWorldResource(
  "jshack:trap:stepQueue",
  {
    create: () => [],
    reset: (queue) => {
      queue.length = 0;
    },
  },
);
