// rules/data/monsterStatusProcs.js
// Data-driven monster proc scripts that apply status effects.
import { Brain } from "../components/Brain.js";
import { degradeFloorMemory } from "../environment/dungeon/transition.js";
import { MONSTER_SCRIPT_IDS } from "./monsterScriptIds.js";

export const MONSTER_PROC_TRIGGER = Object.freeze({
  ON_HIT: "onHit",
  ON_BEFORE_HIT: "onBeforeHit",
  ON_DAMAGED: "onDamaged",
});

export const MONSTER_PROC_TRIGGER_IDS = Object.freeze(Object.values(MONSTER_PROC_TRIGGER));

export const MONSTER_PROC_TARGET = Object.freeze({
  ATTACKER: "attacker",
  DEFENDER: "defender",
});

export const MONSTER_PROC_TARGET_IDS = Object.freeze(Object.values(MONSTER_PROC_TARGET));

export const MONSTER_PROC_EVENT_SCHEMA = Object.freeze({
  ATTACKER_DEFENDER: "attacker_defender",
  DEFENDER_ONLY: "defender_only",
});

export const MONSTER_PROC_EVENT_SCHEMA_IDS = Object.freeze(Object.values(MONSTER_PROC_EVENT_SCHEMA));

/**
 * Mind flayer blast: clear known spells, apply mindwipe, and degrade map memory.
 * @param {{ world:any, ctx:any, rng?:() => number, pushEffect:(entityId:number, effect:any) => void, emit:(event:string, payload:any) => void }} context
 */
function applyMindflayerBlast(context) {
  const world = context.world;
  const ctx = context.ctx;
  const rng = typeof context?.rng === "function" ? context.rng : (() => 0);
  const { depth } = degradeFloorMemory(rng, { fraction: 0.3 });
  const brain = world.get(ctx.defender, Brain);
  if (brain) brain.learnedSpellIds = [];

  context.pushEffect(ctx.defender, { key: "mindwipe", turnsLeft: 2, potency: 1, stacks: 1 });
  context.emit("proc:mindwipe", {
    actor: ctx.attacker,
    target: ctx.defender,
    affectedDepth: depth,
  });
}

/**
 * @typedef {{
 *   id: string,
 *   script: string,
 *   trigger: "onHit"|"onBeforeHit"|"onDamaged",
 *   chancePct: number,
 *   seedSalt: number,
 *   effect?: { key:string, turnsLeft:number, potency:number, stacks?:number },
 *   target?: "attacker"|"defender",
 *   apply?: (context:{ world:any, ctx:any, rng?:() => number, pushEffect:(entityId:number, effect:any) => void, emit:(event:string, payload:any) => void, emitProc?:(event:string, schema?:string, payload?:any) => void }) => void,
 *   emitEvent?: string,
 *   eventSchema?: "attacker_defender"|"defender_only",
 * }} MonsterStatusProcDef
 */

/** @type {MonsterStatusProcDef[]} */
export const MONSTER_STATUS_PROC_DEFS = [
  {
    id: "rat_bite_disease",
    script: MONSTER_SCRIPT_IDS.RAT_BITE,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 25,
    seedSalt: 0xdead0001,
    effect: { key: "disease", turnsLeft: 20, potency: 1, stacks: 1 },
    emitEvent: "proc:diseased",
  },
  {
    id: "spider_bite_poison",
    script: MONSTER_SCRIPT_IDS.SPIDER_BITE,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 30,
    seedSalt: 0xdead0002,
    effect: { key: "poison", turnsLeft: 5, potency: 2, stacks: 1 },
    emitEvent: "proc:poisoned",
  },
  {
    id: "dragon_claw_burn",
    script: MONSTER_SCRIPT_IDS.DRAGON_CLAW,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 20,
    seedSalt: 0xdead0004,
    effect: { key: "burn", turnsLeft: 5, potency: 4, stacks: 1 },
    emitEvent: "proc:burning",
  },
  {
    id: "snake_bite_poison",
    script: MONSTER_SCRIPT_IDS.SNAKE_BITE,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 25,
    seedSalt: 0xdead000f,
    effect: { key: "poison", turnsLeft: 5, potency: 1, stacks: 1 },
    emitEvent: "proc:poisoned",
  },
  {
    id: "goblin_shiv_bleed",
    script: MONSTER_SCRIPT_IDS.GOBLIN_SHIV,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 20,
    seedSalt: 0xdead0005,
    effect: { key: "bleed", turnsLeft: 3, potency: 1, stacks: 1 },
    emitEvent: "proc:bleeding",
  },
  {
    id: "bat_screech_stun",
    script: MONSTER_SCRIPT_IDS.BAT_SCREECH,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 15,
    seedSalt: 0xdead0006,
    effect: { key: "stun", turnsLeft: 1, potency: 1, stacks: 1 },
    emitEvent: "proc:stunned",
  },
  {
    id: "ogre_crush_stun",
    script: MONSTER_SCRIPT_IDS.OGRE_CRUSH,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 25,
    seedSalt: 0xdead000a,
    effect: { key: "stun", turnsLeft: 2, potency: 1, stacks: 1 },
    emitEvent: "proc:stunned",
  },
  {
    id: "grid_bug_zap_shock",
    script: MONSTER_SCRIPT_IDS.GRID_BUG_ZAP,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 30,
    seedSalt: 0xdead0010,
    effect: { key: "shock", turnsLeft: 2, potency: 1, stacks: 1 },
    emitEvent: "proc:shocked",
  },
  {
    id: "troll_smash_regen_on_hit",
    script: MONSTER_SCRIPT_IDS.TROLL_SMASH,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 100,
    seedSalt: 0xdead0011,
    target: MONSTER_PROC_TARGET.ATTACKER,
    effect: { key: "regen", turnsLeft: 3, potency: 2, stacks: 1 },
  },
  {
    id: "demon_hellfire_burn_on_hit",
    script: MONSTER_SCRIPT_IDS.DEMON_HELLFIRE,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 30,
    seedSalt: 0xdead000b,
    effect: { key: "burn", turnsLeft: 4, potency: 3, stacks: 1 },
    emitEvent: "proc:burning",
  },
  {
    id: "lich_phylactery_regen_on_damaged",
    script: MONSTER_SCRIPT_IDS.LICH_DRAIN,
    trigger: MONSTER_PROC_TRIGGER.ON_DAMAGED,
    chancePct: 20,
    seedSalt: 0xdead000d,
    effect: { key: "regen", turnsLeft: 3, potency: 2, stacks: 1 },
    emitEvent: "proc:phylactery",
    eventSchema: MONSTER_PROC_EVENT_SCHEMA.DEFENDER_ONLY,
  },
  {
    id: "mindflayer_mindwipe_on_hit",
    script: MONSTER_SCRIPT_IDS.MINDFLAYER_BLAST,
    trigger: MONSTER_PROC_TRIGGER.ON_HIT,
    chancePct: 20,
    seedSalt: 0xdead000e,
    apply: applyMindflayerBlast,
  },
];
