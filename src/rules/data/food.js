// rules/data/food.js
// Nutrition data for food items and corpse nutrition calculations.
import { Resistances } from "../components/Resistences.js";

/**
 * Base nutrition by monster sizeClass.
 * These values represent "hunger reduction" when the food is consumed.
 */
export const NUTRITION_BY_SIZE = {
  XS: 80,    // bat, grid_bug, snake — meager meal
  S:  150,   // rat, goblin, spider — light meal
  M:  300,   // orc, skeleton, wraith, lich — standard meal
  L:  500,   // troll, ogre, demon — hearty meal
  XL: 800,   // dragon — feast
};

/**
 * Compute nutrition from a monster def, factoring in massKg for fine-tuning.
 * @param {{ sizeClass: string, massKg: number }} monsterDef
 * @returns {number} nutrition value (hunger reduction)
 */
export function computeCorpseNutrition(monsterDef) {
  const base = NUTRITION_BY_SIZE[monsterDef.sizeClass] || 200;
  const massBonus = Math.floor((monsterDef.massKg || 0) / 10);
  return base + massBonus;
}

export const CORPSE_PROC_ID = Object.freeze({
  DISEASE: "corpse:disease",
  POISON: "corpse:poison",
  SHOCK: "corpse:shock",
  MINDWIPE: "corpse:mindwipe",
  HALLUCINATION: "corpse:hallucination",
  ELECTRIC_RESIST: "corpse:electric_resist",
});

/**
 * Declarative corpse proc map.
 * Monster id -> proc id.
 * null/undefined = no special effect.
 */
export const CORPSE_EFFECTS = Object.freeze({
  rat: CORPSE_PROC_ID.DISEASE,
  bat: CORPSE_PROC_ID.DISEASE,
  snake: CORPSE_PROC_ID.POISON,
  spider: CORPSE_PROC_ID.POISON,
  grid_bug: CORPSE_PROC_ID.SHOCK,
  wraith: CORPSE_PROC_ID.MINDWIPE,
  floating_eye: CORPSE_PROC_ID.HALLUCINATION,
  lich: CORPSE_PROC_ID.MINDWIPE,
  eel: CORPSE_PROC_ID.ELECTRIC_RESIST,
});

/**
 * @param {{
 *   world:any,
 *   actor:number,
 *   itemId:number,
 *   pushEffect:(effect:{key:string,turnsLeft:number,potency:number,stacks?:number,sourceId?:number}) => void,
 *   damage:(amount:number, source?:string) => number,
 *   emit:(eventName:string, payload:any) => void,
 * }} ctx
 */
function grantElectricResist(ctx) {
  let resist = ctx.world.get(ctx.actor, Resistances);
  if (!resist) {
    try { ctx.world.add(ctx.actor, Resistances, {}); } catch {}
    resist = ctx.world.get(ctx.actor, Resistances);
  }
  if (!resist) return;
  const current = Number(resist?.electric?.ohms);
  const nextOhms = Number.isFinite(current)
    ? Math.max(current, 2400)
    : 2400;
  if (!resist.electric || typeof resist.electric !== "object") resist.electric = {};
  resist.electric.ohms = nextOhms;
  if (!Number.isFinite(resist.electric.fibrillationA)) resist.electric.fibrillationA = 0.03;
  ctx.emit("hunger:resistance-gained", { actor: ctx.actor, type: "electric", ohms: nextOhms });
}

/**
 * First-class callback table for corpse effects.
 */
export const CORPSE_USE_PROCS = Object.freeze({
  [CORPSE_PROC_ID.DISEASE]: (ctx) => {
    ctx.pushEffect({ key: "disease", turnsLeft: 20, potency: 1, stacks: 1, sourceId: ctx.itemId });
    ctx.emit("hunger:sickened", { actor: ctx.actor, type: "disease" });
  },
  [CORPSE_PROC_ID.POISON]: (ctx) => {
    ctx.pushEffect({ key: "poison", turnsLeft: 8, potency: 2, stacks: 1, sourceId: ctx.itemId });
    ctx.emit("hunger:sickened", { actor: ctx.actor, type: "poison" });
  },
  [CORPSE_PROC_ID.SHOCK]: (ctx) => {
    ctx.damage(3, "corpse");
  },
  [CORPSE_PROC_ID.MINDWIPE]: (ctx) => {
    ctx.pushEffect({ key: "mindwipe", turnsLeft: 15, potency: 1, stacks: 1, sourceId: ctx.itemId });
    ctx.emit("hunger:sickened", { actor: ctx.actor, type: "mindwipe" });
  },
  [CORPSE_PROC_ID.HALLUCINATION]: (ctx) => {
    ctx.pushEffect({ key: "mindwipe", turnsLeft: 30, potency: 2, stacks: 1, sourceId: ctx.itemId });
    ctx.emit("hunger:sickened", { actor: ctx.actor, type: "hallucination" });
  },
  [CORPSE_PROC_ID.ELECTRIC_RESIST]: (ctx) => {
    grantElectricResist(ctx);
  },
});

/**
 * @param {string} corpseType
 * @param {{
 *   world:any,
 *   actor:number,
 *   itemId:number,
 *   pushEffect:(effect:{key:string,turnsLeft:number,potency:number,stacks?:number,sourceId?:number}) => void,
 *   damage:(amount:number, source?:string) => number,
 *   emit:(eventName:string, payload:any) => void,
 * }} ctx
 */
export function runCorpseUseProc(corpseType, ctx) {
  const procId = CORPSE_EFFECTS[String(corpseType || "").toLowerCase()];
  if (!procId) return false;
  const fn = CORPSE_USE_PROCS[procId];
  if (typeof fn !== "function") return false;
  try { fn(ctx); } catch {}
  return true;
}

/** Standard ration nutrition values. */
export const RATION_NUTRITION = 400;
export const IRON_RATION_NUTRITION = 600;

/** Corpse weight by sizeClass (for ItemInfo.weight). */
export const CORPSE_WEIGHT = {
  XS: 1,
  S:  2,
  M:  4,
  L:  8,
  XL: 15,
};

// ── Hunger severity constants ─────────────────────────────────────
// Single source of truth for level names, thresholds, and penalties.
// Consumed by hungerSystem, combatSystem, manaRegenerationSystem, and display.

/** Severity thresholds (frozen). */
export const HUNGER_LEVELS = Object.freeze([
  Object.freeze({ name: 'normal',   min: 0,    max: 199  }),
  Object.freeze({ name: 'peckish',  min: 200,  max: 399  }),
  Object.freeze({ name: 'hungry',   min: 400,  max: 599  }),
  Object.freeze({ name: 'famished', min: 600,  max: 799  }),
  Object.freeze({ name: 'starving', min: 800,  max: 999  }),
  Object.freeze({ name: 'wasting',  min: 1000, max: Infinity }),
]);

/** All status types that the hunger system projects (for filtering). */
export const HUNGER_STATUS_TYPES = Object.freeze(new Set([
  'satiated', 'peckish', 'hungry', 'famished', 'starving', 'wasting',
]));

/** Attack/defense penalty per hunger level (read by combatSystem). */
export const HUNGER_POTENCY = Object.freeze({
  peckish: 0, hungry: 1, famished: 2, starving: 3, wasting: 4,
});

/** Levels that apply a combat penalty (frozen array for status lookups). */
export const HUNGER_COMBAT_LEVELS = Object.freeze(['hungry', 'famished', 'starving', 'wasting']);

/** Levels that throttle mana regen, mapped to multiplier. */
export const HUNGER_MANA_MULT = Object.freeze({
  famished: 0.5, starving: 0.0, wasting: 0.0,
});

/**
 * Resolve a hunger counter value to its severity level name.
 * @param {number} hunger
 * @returns {string}
 */
export function getHungerLevel(hunger) {
  for (const level of HUNGER_LEVELS) {
    if (hunger >= level.min && hunger <= level.max) return level.name;
  }
  return 'wasting';
}
