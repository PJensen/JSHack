import { defineComponent } from "../../lib/ecs-js/index.js";

/** Short-lived rules receipt produced after canonical healing changes HP. */
export const HealingApplied = defineComponent("HealingApplied", {
  target: 0,
  source: 0,
  amount: 0,
  hpBefore: 0,
  hpAfter: 0,
  maxHp: 0,
  rawAmount: 0,
  resolvedAmount: 0,
  cause: "",
  step: 0,
});
