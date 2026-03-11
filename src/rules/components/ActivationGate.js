import { defineComponent } from "../../lib/ecs-js/index.js";

export const ActivationGate = defineComponent("ActivationGate", {
  kind: "eventKind",
  a: "",
  b: 0,
  c: "",
  priority: 0,
  enabled: true,
});
