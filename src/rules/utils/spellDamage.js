import { Brain } from "../components/Brain.js";
import { combatSeed, mulberry32 } from "./rng.js";
import { resolveCombatSnapshot } from "./resolveCombatSnapshot.js";

/**
 * @param {string} value
 * @returns {number}
 */
function hashString32(value) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i) & 0xff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Positive-only spell scaling. Baseline INT 10 preserves current damage;
 * extra INT adds modest power without invalidating existing tuning.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @returns {number}
 */
export function getSpellIntelligenceBonus(world, casterId) {
  const brain = (casterId > 0 && world.isAlive(casterId)) ? world.get(casterId, Brain) : null;
  const intelligence = Number(brain?.intelligence || 10);
  return Math.max(0, intelligence - 10);
}

/**
 * @param {number} baseAmount
 * @param {number} intelligenceBonus
 * @returns {number}
 */
export function scaleSpellDamageFromBonus(baseAmount, intelligenceBonus) {
  const base = Math.max(0, Number(baseAmount || 0) | 0);
  if (base <= 0) return 0;
  return Math.max(1, base + Math.floor(Math.max(0, Number(intelligenceBonus || 0)) / 5));
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @param {number} baseAmount
 * @returns {number}
 */
export function scaleSpellDamage(world, casterId, baseAmount) {
  return scaleSpellDamageFromBonus(baseAmount, getSpellIntelligenceBonus(world, casterId));
}

/**
 * Snapshot spell-damage parameters at cast time so timed effects keep their
 * original behavior even if the caster changes gear or later dies.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @param {{ id?:string, cause?:string }} [spell]
 * @param {{ cause?:string, type?:string, spellId?:string }} [overrides]
 */
export function createSpellDamageContext(world, casterId, spell = {}, overrides = {}) {
  const snap = resolveCombatSnapshot(world, casterId, { mode: "ranged" });
  const intelligenceBonus = getSpellIntelligenceBonus(world, casterId);
  const spellId = String(overrides?.spellId || spell?.id || "");
  return {
    sourceId: Number(casterId || 0) | 0,
    spellId,
    cause: String(overrides?.cause || spell?.cause || (spellId ? `spell:${spellId}` : "spell")),
    type: String(overrides?.type || "physical").toLowerCase(),
    intelligenceBonus,
    critChancePct: Math.max(0, 5 + Math.floor(intelligenceBonus / 2) + (snap?.luck || 0) + ((snap?.critChance || 0) * 100)),
    critMult: Math.max(1, 2 + Number(snap?.critMult || 0)),
  };
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} targetId
 * @param {{
 *   sourceId?:number,
 *   spellId?:string,
 *   cause?:string,
 *   critChancePct?:number,
 *   critMult?:number,
 * }} context
 * @param {number} [salt=0]
 * @returns {boolean}
 */
export function rollSpellCriticalFromContext(world, targetId, context = {}, salt = 0) {
  const critPct = Math.max(0, Number(context?.critChancePct || 0));
  if (!(critPct > 0)) return false;
  const key = String(context?.spellId || context?.cause || "spell");
  const sourceId = Number(context?.sourceId || 0) | 0;
  const rng = mulberry32(combatSeed(world.seed, world.step, sourceId, targetId, hashString32(key) ^ (salt >>> 0)));
  return (rng() * 100) < critPct;
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} targetId
 * @param {{
 *   sourceId?:number,
 *   spellId?:string,
 *   cause?:string,
 *   type?:string,
 *   critChancePct?:number,
 *   critMult?:number,
 * }} context
 * @param {{
   *   baseAmount:number,
 *   at?:{x:number,y:number},
 *   salt?:number,
 *   noTrigger?:boolean,
 *   bypassInvuln?:boolean,
 *   bypassResist?:boolean,
 *   cause?:string,
 *   type?:string,
 * }} [options]
 */
export function buildSpellDamageSpecFromContext(world, targetId, context, options = {}) {
  const cause = String(options?.cause || context?.cause || "spell");
  const critical = rollSpellCriticalFromContext(world, targetId, context, Number(options?.salt || 0));
  const critMult = Math.max(1, Number(context?.critMult || 1));
  let amount = Math.max(0, Number(options?.baseAmount || 0) | 0);
  if (critical) amount = Math.max(1, Math.floor(amount * critMult));
  return {
    target: targetId,
    amount,
    source: Number(context?.sourceId || 0) | 0,
    type: String(options?.type || context?.type || "physical"),
    cause,
    at: options?.at,
    critical,
    noTrigger: !!options?.noTrigger,
    bypassInvuln: !!options?.bypassInvuln,
    bypassResist: !!options?.bypassResist,
  };
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @param {number} targetId
 * @param {{
 *   spell?: { id?:string, cause?:string },
 *   baseAmount:number,
 *   type?:string,
 *   cause?:string,
 *   at?:{x:number,y:number},
 *   salt?:number,
 *   noTrigger?:boolean,
 *   bypassInvuln?:boolean,
 *   bypassResist?:boolean,
 * }} options
 */
export function buildSpellDamageSpec(world, casterId, targetId, options) {
  const context = createSpellDamageContext(world, casterId, options?.spell || {}, {
    cause: options?.cause,
    type: options?.type,
  });
  return buildSpellDamageSpecFromContext(world, targetId, context, {
    ...options,
    baseAmount: scaleSpellDamageFromBonus(Number(options?.baseAmount || 0), context.intelligenceBonus),
  });
}
