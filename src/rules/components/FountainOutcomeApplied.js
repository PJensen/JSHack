import { defineComponent } from "../../lib/ecs-js/index.js";

export const FountainOutcomeApplied = defineComponent("FountainOutcomeApplied", {
  actor: 0,
  fountain: 0,
  item: 0,
  verb: "",
  outcome: "",
  ruleId: "",
  step: 0,
});
