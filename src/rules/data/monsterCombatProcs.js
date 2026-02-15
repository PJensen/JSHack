// rules/data/monsterCombatProcs.js
// Monster combat proc definitions (data/metadata).
// Actual runtime behavior now lives as inline callbacks on monster defs
// in monsters.js via callbacks/combat.js factories.
// This file retains the proc def arrays for validation and test reference.

import {
  MONSTER_PROC_TRIGGER,
  MONSTER_STATUS_PROC_DEFS,
} from "./monsterStatusProcs.js";

export const MONSTER_COMBAT_TRIGGER = MONSTER_PROC_TRIGGER;

const MONSTER_EXTRA_COMBAT_PROC_DEFS = Object.freeze([
  {
    id: "orc_rage_before_hit",
    monsterId: "orc",
    trigger: MONSTER_PROC_TRIGGER.ON_BEFORE_HIT,
    chancePct: 25,
    seedSalt: 0xdead0007,
  },
  {
    id: "skeleton_reassemble_on_damaged",
    monsterId: "skeleton",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 20,
    seedSalt: 0xdead0008,
  },
  {
    id: "troll_regenerate_on_damaged",
    monsterId: "troll",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 30,
    seedSalt: 0xdead0009,
  },
  {
    id: "wraith_touch_drain_on_hit",
    monsterId: "wraith",
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 20,
    seedSalt: 0xdead0003,
  },
  {
    id: "demon_hellfire_retaliate_on_damaged",
    monsterId: "demon",
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 100,
    seedSalt: 0xdead0012,
  },
  {
    id: "lich_drain_on_hit",
    monsterId: "lich",
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 25,
    seedSalt: 0xdead000c,
  },
]);

export const MONSTER_COMBAT_PROC_DEFS = Object.freeze([
  ...MONSTER_STATUS_PROC_DEFS,
  ...MONSTER_EXTRA_COMBAT_PROC_DEFS,
]);
