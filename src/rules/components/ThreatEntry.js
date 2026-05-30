import { defineComponent } from "../../lib/ecs-js/index.js";

export const ThreatEntry = defineComponent("ThreatEntry", {
  sourceId: 0,
  value: 0,
  lastTurnTouched: 0,
  kind: "",
  forcedUntilTurn: 0,
  decayRate: 2,
  sticky: false,
});
