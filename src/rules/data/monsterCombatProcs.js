// rules/data/monsterCombatProcs.js
// Data-driven monster proc scripts for non-status combat effects.

export const MONSTER_COMBAT_PROC_TRIGGER_IDS = Object.freeze([
  "onHit",
  "onBeforeHit",
  "onDamaged",
]);

export const MONSTER_COMBAT_PROC_ACTION_IDS = Object.freeze([
  "add_damage_flat",
  "heal_attacker_fraction_damage",
  "heal_defender_flat",
  "retaliate_flat",
]);

export const MONSTER_COMBAT_PROC_EVENT_SCHEMA_IDS = Object.freeze([
  "attacker_defender",
  "defender_only",
]);

/**
 * @typedef {{
 *   id: string,
 *   script: string,
 *   trigger: "onHit"|"onBeforeHit"|"onDamaged",
 *   chancePct: number,
 *   seedSalt: number,
 *   action: {
 *     kind: "add_damage_flat"|"heal_attacker_fraction_damage"|"heal_defender_flat"|"retaliate_flat",
 *     amount?: number,
 *     numerator?: number,
 *     denominator?: number,
 *     minAmount?: number,
 *   },
 *   emitEvent?: string,
 *   eventSchema?: "attacker_defender"|"defender_only",
 *   includeAmount?: boolean,
 * }} MonsterCombatProcDef
 */

/** @type {MonsterCombatProcDef[]} */
export const MONSTER_COMBAT_PROC_DEFS = [
  {
    id: "wraith_touch_drain",
    script: "monster:wraithTouch",
    trigger: "onHit",
    chancePct: 20,
    seedSalt: 0xdead0003,
    action: { kind: "heal_attacker_fraction_damage", numerator: 1, denominator: 3, minAmount: 1 },
    emitEvent: "proc:drain",
    eventSchema: "attacker_defender",
    includeAmount: true,
  },
  {
    id: "orc_rage_bonus_damage",
    script: "monster:orcRage",
    trigger: "onBeforeHit",
    chancePct: 25,
    seedSalt: 0xdead0007,
    action: { kind: "add_damage_flat", amount: 2 },
    emitEvent: "proc:rage",
    eventSchema: "attacker_defender",
  },
  {
    id: "skeleton_reassemble_heal",
    script: "monster:skeletonReassemble",
    trigger: "onDamaged",
    chancePct: 20,
    seedSalt: 0xdead0008,
    action: { kind: "heal_defender_flat", amount: 2 },
    emitEvent: "proc:reassemble",
    eventSchema: "defender_only",
  },
  {
    id: "troll_regenerate_on_damaged",
    script: "monster:trollSmash",
    trigger: "onDamaged",
    chancePct: 30,
    seedSalt: 0xdead0009,
    action: { kind: "heal_defender_flat", amount: 1 },
    emitEvent: "proc:regenerate",
    eventSchema: "defender_only",
  },
  {
    id: "demon_hellfire_retaliate",
    script: "monster:demonHellfire",
    trigger: "onDamaged",
    chancePct: 100,
    seedSalt: 0xdead00bf,
    action: { kind: "retaliate_flat", amount: 2 },
    emitEvent: "proc:hellfire",
    eventSchema: "defender_only",
  },
  {
    id: "lich_drain",
    script: "monster:lichDrain",
    trigger: "onHit",
    chancePct: 25,
    seedSalt: 0xdead000c,
    action: { kind: "heal_attacker_fraction_damage", numerator: 1, denominator: 2, minAmount: 1 },
    emitEvent: "proc:drain",
    eventSchema: "attacker_defender",
    includeAmount: true,
  },
];
