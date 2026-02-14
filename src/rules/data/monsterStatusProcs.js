// rules/data/monsterStatusProcs.js
// Data-driven monster proc scripts that apply status effects.

export const MONSTER_PROC_TRIGGER_IDS = Object.freeze([
  "onHit",
  "onBeforeHit",
  "onDamaged",
]);

/**
 * @typedef {{
 *   id: string,
 *   script: string,
 *   trigger: "onHit"|"onBeforeHit"|"onDamaged",
 *   chancePct: number,
 *   seedSalt: number,
 *   effect: { key:string, turnsLeft:number, potency:number, stacks?:number },
 *   emitEvent?: string,
 * }} MonsterStatusProcDef
 */

/** @type {MonsterStatusProcDef[]} */
export const MONSTER_STATUS_PROC_DEFS = [
  {
    id: "rat_bite_disease",
    script: "monster:ratBite",
    trigger: "onHit",
    chancePct: 25,
    seedSalt: 0xdead0001,
    effect: { key: "disease", turnsLeft: 20, potency: 1, stacks: 1 },
    emitEvent: "proc:diseased",
  },
  {
    id: "spider_bite_poison",
    script: "monster:spiderBite",
    trigger: "onHit",
    chancePct: 30,
    seedSalt: 0xdead0002,
    effect: { key: "poison", turnsLeft: 5, potency: 2, stacks: 1 },
    emitEvent: "proc:poisoned",
  },
  {
    id: "dragon_claw_burn",
    script: "monster:dragonClaw",
    trigger: "onHit",
    chancePct: 20,
    seedSalt: 0xdead0004,
    effect: { key: "burn", turnsLeft: 5, potency: 4, stacks: 1 },
    emitEvent: "proc:burning",
  },
  {
    id: "snake_bite_poison",
    script: "monster:snakeBite",
    trigger: "onHit",
    chancePct: 25,
    seedSalt: 0xdead000f,
    effect: { key: "poison", turnsLeft: 5, potency: 1, stacks: 1 },
    emitEvent: "proc:poisoned",
  },
  {
    id: "goblin_shiv_bleed",
    script: "monster:goblinShiv",
    trigger: "onHit",
    chancePct: 20,
    seedSalt: 0xdead0005,
    effect: { key: "bleed", turnsLeft: 3, potency: 1, stacks: 1 },
    emitEvent: "proc:bleeding",
  },
  {
    id: "bat_screech_stun",
    script: "monster:batScreech",
    trigger: "onHit",
    chancePct: 15,
    seedSalt: 0xdead0006,
    effect: { key: "stun", turnsLeft: 1, potency: 1, stacks: 1 },
    emitEvent: "proc:stunned",
  },
  {
    id: "ogre_crush_stun",
    script: "monster:ogreCrush",
    trigger: "onHit",
    chancePct: 25,
    seedSalt: 0xdead000a,
    effect: { key: "stun", turnsLeft: 2, potency: 1, stacks: 1 },
    emitEvent: "proc:stunned",
  },
  {
    id: "grid_bug_zap_shock",
    script: "monster:gridBugZap",
    trigger: "onHit",
    chancePct: 30,
    seedSalt: 0xdead0010,
    effect: { key: "shock", turnsLeft: 2, potency: 1, stacks: 1 },
    emitEvent: "proc:shocked",
  },
];

