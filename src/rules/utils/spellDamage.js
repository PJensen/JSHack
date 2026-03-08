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
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @param {number} baseAmount
 * @returns {number}
 */
export function scaleSpellDamage(world, casterId, baseAmount) {
  const base = Math.max(0, Number(baseAmount || 0) | 0);
  if (base <= 0) return 0;
  return Math.max(1, base + Math.floor(getSpellIntelligenceBonus(world, casterId) / 5));
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} casterId
 * @param {number} targetId
 * @param {{ id?:string, cause?:string }} [spell]
 * @param {number} [salt=0]
 * @returns {boolean}
 */
export function rollSpellCritical(world, casterId, targetId, spell = {}, salt = 0) {
  const snap = resolveCombatSnapshot(world, casterId, { mode: "ranged" });
  const intBonus = getSpellIntelligenceBonus(world, casterId);
  const critPct = 5 + Math.floor(intBonus / 2) + (snap?.luck || 0) + ((snap?.critChance || 0) * 100);
  if (!(critPct > 0)) return false;
  const key = String(spell?.id || spell?.cause || "spell");
  const rng = mulberry32(combatSeed(world.seed, world.step, casterId, targetId, hashString32(key) ^ (salt >>> 0)));
  return (rng() * 100) < critPct;
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
  const cause = String(options?.cause || options?.spell?.id || "spell");
  const critical = rollSpellCritical(world, casterId, targetId, options?.spell || { cause }, Number(options?.salt || 0));
  const snap = resolveCombatSnapshot(world, casterId, { mode: "ranged" });
  const critMult = 2 + Number(snap?.critMult || 0);
  let amount = scaleSpellDamage(world, casterId, Number(options?.baseAmount || 0));
  if (critical) amount = Math.max(1, Math.floor(amount * critMult));
  return {
    target: targetId,
    amount,
    source: casterId,
    type: String(options?.type || "physical"),
    cause,
    at: options?.at,
    critical,
    noTrigger: !!options?.noTrigger,
    bypassInvuln: !!options?.bypassInvuln,
    bypassResist: !!options?.bypassResist,
  };
}
