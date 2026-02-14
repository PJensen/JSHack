import { Resistances } from "../components/Resistences.js";
import { Vitality } from "../components/Vitality.js";
import { isEntityInvulnerable } from "./effectGuards.js";
import { Equipment } from "../components/Equipment.js";
import { Material } from "../components/Material.js";
import { MATERIAL_CATALOG } from "../data/materials.js";

const BASE_ELECTRIC_OHMS = 1000;
const BASE_BODY_CONDUCTIVITY = 0.2;

const MATERIAL_CONDUCTIVITY = new Map(
  MATERIAL_CATALOG.map((row) => [String(row?.id || ""), Number(row?.Material?.conductivity ?? BASE_BODY_CONDUCTIVITY)]),
);

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
 * Material conductivity coupling from equipped gear.
 * Conductive worn materials amplify electric transfer; insulators reduce it.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 */
function equippedConductivityMultiplier(world, targetId) {
  const eq = world.get(targetId, Equipment);
  if (!eq) return 1;

  /** @type {Array<[string, number]>} */
  const slotWeights = [
    ["armor", 0.55],
    ["shield", 0.25],
    ["weapon", 0.20],
    ["ring1", 0.08],
    ["ring2", 0.08],
    ["ammo", 0.04],
  ];

  let weighted = 0;
  let totalWeight = 0;
  for (let i = 0; i < slotWeights.length; i++) {
    const [slot, weight] = slotWeights[i];
    const itemId = Number(eq[slot] || 0) | 0;
    if (!(itemId > 0) || !world.isAlive(itemId)) continue;

    const mat = world.get(itemId, Material);
    const kind = String(mat?.kind || "");
    if (!kind) continue;
    const conductivity = MATERIAL_CONDUCTIVITY.has(kind)
      ? Number(MATERIAL_CONDUCTIVITY.get(kind))
      : BASE_BODY_CONDUCTIVITY;
    if (!Number.isFinite(conductivity)) continue;
    weighted += conductivity * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 1;
  const avgConductivity = weighted / totalWeight;
  // 0.2 (flesh-like) -> neutral 1.0
  return clamp(1 + (avgConductivity - BASE_BODY_CONDUCTIVITY) * 1.8, 0.65, 2.0);
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
    const resistMult = electricMultiplier(resist);
    if (resistMult <= 0) return 0;
    const gearMult = equippedConductivityMultiplier(world, targetId);
    return Math.max(0, Math.floor(amount * resistMult * gearMult));
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
