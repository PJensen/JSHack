import { defineWorldResource } from "../../lib/ecs-js/index.js";

export const TrapDodgePromptStateResource = defineWorldResource(
  "jshack:trap:dodgePromptState",
  {
    create: () => ({ enabled: false, pending: new Map() }),
    reset: (state) => {
      state.enabled = false;
      state.pending.clear();
    },
  },
);
