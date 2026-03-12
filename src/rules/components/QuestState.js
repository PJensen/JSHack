import { defineComponent } from "../../lib/ecs-js/index.js";

export const QuestState = defineComponent("QuestState", {
  node: "enter",
  status: "active",
  t0: 0,
});
