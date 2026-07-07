import { defineWorldResource } from "../../lib/ecs-js/index.js";

const disabledAI = Object.freeze({
  experimental: true,

  /**
   * AI output is flavor text only. It must never own canonical simulation state.
   *
   * @returns {Promise<null>}
   */
  async complete() {
    return null;
  },

  isEnabled() {
    return false;
  },
});

export const AIResource = defineWorldResource("jshack:experimental:ai", {
  create: () => disabledAI,
});
