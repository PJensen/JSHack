import { defineComponent } from "../../lib/ecs-js/index.js";

export const ProcEffect = defineComponent("ProcEffect", {
  kind: "bonusDamageFlat",
  a: 0,
  b: 0,
  c: "",
  priority: 0,
  enabled: true,
});
