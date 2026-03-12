import { defineComponent } from "../../lib/ecs-js/index.js";

export const EntranceState = defineComponent("EntranceState", {
  pressure: 0,
  resourceYield: 0,
  corruption: 0,
  traffic: 0,
  knowledge: 0,
  accessibility: 1,
  localFear: 0,
  incidentRate: 0,
  factionControl: "civic",
});
