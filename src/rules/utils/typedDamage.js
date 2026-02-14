import { Resistances } from "../components/Resistences.js";
import { Vitality } from "../components/Vitality.js";
import { isEntityInvulnerable } from "./effectGuards.js";

const BASE_ELECTRIC_OHMS = 1000;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {any} resist
 * @returns {number}
 */
function electricMultiplier(resist) {
  const ohms = Number(resist?.electric?.ohms);
  if (ohms === Infinity) return 0;
  if (!Number.isFinite(ohms)) return 1;
  if (ohms <= 0) return 2.5;
  return clamp(BASE_ELECTRIC_OHMS / ohms, 0.1, 2.5);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @param {{ amount:number, type?:string }} spec
 */
export function resolveTypedDamage(world, targetId, spec) {
  const amount = Math.max(0, Number(spec?.amount || 0) | 0);
  if (amount <= 0) return 0;

  const type = String(spec?.type || "generic").toLowerCase();
  if (type === "electric" || type === "plasma") {
    const resist = world.get(targetId, Resistances);
    const mult = electricMultiplier(resist);
    return Math.max(0, Math.floor(amount * mult));
  }
  return amount;
}

/**
 * Applies typed damage to a target and emits canonical events.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @param {{ amount:number, type?:string, sourceId?:number, at?:{x:number,y:number}|null, cause?:string, kind?:string, immuneText?:string, resistText?:string }} spec
 */
export function applyTypedDamage(world, targetId, spec) {
  const id = Number(targetId || 0) | 0;
  if (!(id > 0) || !world.isAlive(id)) {
    return { applied: false, killed: false, amount: 0, rawAmount: 0, reason: "invalid-target" };
  }

  const vit = world.get(id, Vitality);
  if (!vit || (vit.hp | 0) <= 0) {
    return { applied: false, killed: false, amount: 0, rawAmount: 0, reason: "no-vitality" };
  }

  const rawAmount = Math.max(0, Number(spec?.amount || 0) | 0);
  const sourceId = Number(spec?.sourceId || 0) | 0;
  const type = String(spec?.type || "generic");
  const kind = String(spec?.kind || type || "damage");
  const cause = String(spec?.cause || type || "damage");
  const immuneText = String(spec?.immuneText || "IMMUNE");
  const resistText = String(spec?.resistText || "RESIST");

  if (rawAmount <= 0) {
    return { applied: false, killed: false, amount: 0, rawAmount: 0, reason: "zero-amount" };
  }

  if (isEntityInvulnerable(world, id)) {
    try { world.emit?.("status", { id, kind: "immune", source: sourceId, text: immuneText }); } catch { /* */ }
    return { applied: false, killed: false, amount: 0, rawAmount, reason: "invulnerable" };
  }

  const finalAmount = resolveTypedDamage(world, id, { amount: rawAmount, type });
  if (finalAmount <= 0) {
    try { world.emit?.("status", { id, kind: "immune", source: sourceId, text: resistText }); } catch { /* */ }
    return { applied: false, killed: false, amount: 0, rawAmount, reason: "resisted" };
  }

  vit.hp = Math.max(0, (vit.hp | 0) - finalAmount);
  try {
    world.emit?.("damage", {
      id,
      amount: finalAmount,
      rawAmount,
      type,
      kind,
      at: spec?.at || undefined,
      source: sourceId,
    });
  } catch { /* */ }

  const killed = (vit.hp | 0) <= 0;
  if (killed) {
    try { world.emit?.("died", { id, killer: sourceId, cause }); } catch { /* */ }
  }

  return { applied: true, killed, amount: finalAmount, rawAmount, reason: "applied" };
}
