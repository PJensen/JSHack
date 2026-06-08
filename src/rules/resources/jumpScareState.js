import { defineWorldResource } from "../../lib/ecs-js/index.js";

/**
 * Runtime-only scare bookkeeping. Jump scares are presentation pacing, not a
 * durable simulation fact, so this should not be serialized.
 */
export const JumpScareStateResource = defineWorldResource(
  "jshack:jumpScare:state",
  {
    create: () => ({ triggeredByDepth: new Map() }),
    reset: (state) => {
      state.triggeredByDepth.clear();
    },
  },
);
