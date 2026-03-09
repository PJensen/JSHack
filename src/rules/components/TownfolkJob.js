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
  sleeping:   "sleeping",
  socializing:"socializing",
});

export const TownfolkJob = defineComponent("TownfolkJob", {
  role:         "villager",
  state:        "idle",
  scheduleEnabled: false,
  homeX:        0,
  homeY:        0,
  bedX:         0,
  bedY:         0,
  workX:        0,
  workY:        0,
  workAuxX:     0,
  workAuxY:     0,
  pubX:         0,
  pubY:         0,
  targetX:      0,
  targetY:      0,
  workTurns:    0,
  idleTurns:    0,
  workSiteKind: "",
  routineKind:  "",
  lastPhase:    "",
  carrying:     "",
  stuckTurns:   0,
});
