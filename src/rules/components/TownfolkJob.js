import { defineComponent } from "../../lib/ecs-js/index.js";

export const TOWNFOLK_ROLES = Object.freeze({
  farmer:     "farmer",
  woodcutter: "woodcutter",
  miner:      "miner",
  smith:      "smith",
  priest:     "priest",
  barkeep:    "barkeep",
  villager:   "villager",
  mason:      "mason",
});

export const TOWNFOLK_STATES = Object.freeze({
  idle:       "idle",
  walking:    "walking",
  working:    "working",
  returning:  "returning",
});

export const TownfolkJob = defineComponent("TownfolkJob", {
  role:         "villager",
  state:        "idle",
  homeX:        0,
  homeY:        0,
  targetX:      0,
  targetY:      0,
  workTurns:    0,
  idleTurns:    0,
  workSiteKind: "",
  stuckTurns:   0,
});
