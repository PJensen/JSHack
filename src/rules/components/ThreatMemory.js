import { defineComponent } from "../../lib/ecs-js/index.js";

export const THREAT_MEMORY_LEVELS = Object.freeze({
  sighted: "sighted",
  alarmed: "alarmed",
  cleared: "cleared",
});

export const ThreatMemory = defineComponent("ThreatMemory", {
  threatId: 0,
  threatIdentity: "",
  threatName: "",
  level: THREAT_MEMORY_LEVELS.sighted,
  depth: 0,
  firstSeenTurn: 0,
  lastSeenTurn: 0,
  lastKnownX: 0,
  lastKnownY: 0,
  witnessId: 0,
  alarmTurn: -1,
  bellRingerId: 0,
});
