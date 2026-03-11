import { defineComponent } from "../../lib/ecs-js/index.js";

export const DerivedExpression = defineComponent("DerivedExpression", {
  target: "",
  kind: "addConst",
  source: "",
  value: 0,
  factor: 0,
  stage: "derived",
  priority: 0,
  enabled: true,
});
