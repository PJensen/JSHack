import { defineComponent } from "../../lib/ecs-js/index.js";

export const Score = defineComponent('Score', {
  current: 0,
  best: 0,
  lastDeathDepth: 0,
  runs: 0
});