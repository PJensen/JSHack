import { defineComponent } from "../../lib/ecs-js/index.js";

export const DistrictState = defineComponent("DistrictState", {
  topEntrance: "",
  townInfluence: 0,
  graveyardInfluence: 0,
  shortageScore: 0,
  dangerScore: 0,
  pressureScore: 0,
  shortageBand: "stable",
  dangerBand: "safe",
  pressureBand: "quiet",
  lastShortageBand: "stable",
  lastDangerBand: "safe",
  lastPressureBand: "quiet",
});
