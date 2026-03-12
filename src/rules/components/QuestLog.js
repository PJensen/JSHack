import { defineComponent } from "../../lib/ecs-js/index.js";

export const QuestLog = defineComponent("QuestLog", {
  lastEvent: "",
  lastFrom: "",
  lastTo: "",
  lastError: "",
  transitions: 0,
});
