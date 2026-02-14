import { Resistances } from "../components/Resistences.js";
import { Vitality } from "../components/Vitality.js";
import { isEntityInvulnerable } from "./effectGuards.js";
import { Equipment } from "../components/Equipment.js";
import { Material } from "../components/Material.js";
import { MATERIAL_CATALOG } from "../data/materials.js";
import { ELECTRIC_DAMAGE_TUNING } from "../data/electricDamageTuning.js";

const BASE_ELECTRIC_OHMS = Number(ELECTRIC_DAMAGE_TUNING.baseOhms);
const BASE_BODY_CONDUCTIVITY = Number(ELECTRIC_DAMAGE_TUNING.baseBodyConductivity);
const RESIST_MULTIPLIER_MIN = Number(ELECTRIC_DAMAGE_TUNING.resistMultiplierMin);
const RESIST_MULTIPLIER_MAX = Number(ELECTRIC_DAMAGE_TUNING.resistMultiplierMax);
const CONDUCTIVITY_SCALE = Number(ELECTRIC_DAMAGE_TUNING.conductivityScale);
const CONDUCTIVITY_MULTIPLIER_MIN = Number(ELECTRIC_DAMAGE_TUNING.conductivityMultiplierMin);
const CONDUCTIVITY_MULTIPLIER_MAX = Number(ELECTRIC_DAMAGE_TUNING.conductivityMultiplierMax);
const SLOT_WEIGHT_TABLE = Object.entries(ELECTRIC_DAMAGE_TUNING.slotWeights || {});

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
  if (ohms <= 0) return RESIST_MULTIPLIER_MAX;
  return clamp(BASE_ELECTRIC_OHMS / ohms, RESIST_MULTIPLIER_MIN, RESIST_MULTIPLIER_MAX);
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

  let weighted = 0;
  let totalWeight = 0;
  for (let i = 0; i < SLOT_WEIGHT_TABLE.length; i++) {
    const [slot, rawWeight] = SLOT_WEIGHT_TABLE[i];
    const weight = Number(rawWeight);
    if (!(weight > 0)) continue;
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
  // Base body conductivity -> neutral 1.0 multiplier.
  return clamp(
    1 + (avgConductivity - BASE_BODY_CONDUCTIVITY) * CONDUCTIVITY_SCALE,
    CONDUCTIVITY_MULTIPLIER_MIN,
    CONDUCTIVITY_MULTIPLIER_MAX,
  );
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
