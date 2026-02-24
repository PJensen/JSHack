// src/rules/utils/dealDamage.js
// Canonical damage pipeline. ALL damage in the game flows through here.
import { Resistances } from "../components/Resistences.js";
import { Vitality } from "../components/Vitality.js";
import { Equipment } from "../components/Equipment.js";
import { Material } from "../components/Material.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { isEntityInvulnerable } from "./effectGuards.js";
import { MATERIAL_CATALOG } from "../data/materials.js";
import { ELECTRIC_DAMAGE_TUNING } from "../data/electricDamageTuning.js";

// ── Electric tuning constants (moved from typedDamage.js) ───────────
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

// ── Electric resistance helpers (moved from typedDamage.js) ─────────

/** @param {any} resist */
export function electricMultiplier(resist) {
  const ohms = Number(resist?.electric?.ohms);
  if (ohms === Infinity) return 0;
  if (!Number.isFinite(ohms)) return 1;
  if (ohms <= 0) return RESIST_MULTIPLIER_MAX;
  return clamp(BASE_ELECTRIC_OHMS / ohms, RESIST_MULTIPLIER_MIN, RESIST_MULTIPLIER_MAX);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 */
export function equippedConductivityMultiplier(world, targetId) {
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
  return clamp(
    1 + (avgConductivity - BASE_BODY_CONDUCTIVITY) * CONDUCTIVITY_SCALE,
    CONDUCTIVITY_MULTIPLIER_MIN,
    CONDUCTIVITY_MULTIPLIER_MAX,
  );
}

// ── Active-effect resist bonus ───────────────────────────────────────
/** Sum raw potency of active resist effects matching the given key. */
function activeResistBonus(world, targetId, effectKey) {
  const ae = world.get(targetId, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return 0;
  let total = 0;
  for (let i = 0; i < ae.effects.length; i++) {
    const e = ae.effects[i];
    if (!e || e.key !== effectKey) continue;
    if (Number.isInteger(e.onsetLeft) && e.onsetLeft > 0) continue;
    if (!((e.turnsLeft | 0) > 0)) continue;
    total += Number(e.potency) || 0;
  }
  return total;
}

// ── Resistance resolution ───────────────────────────────────────────

/**
 * Resolve final damage after applying type-based resistances.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} targetId
 * @param {number} rawAmount
 * @param {string} type
 * @returns {number}
 */
export function resolveResistance(world, targetId, rawAmount, type) {
  const resist = world.get(targetId, Resistances);
  if (!resist) return rawAmount;

  const eq = world.get(targetId, Equipment);

  switch (type) {
    case 'electric':
    case 'plasma':
    case 'lightning': {
      const potionOhms = activeResistBonus(world, targetId, "resist_electric") * 1000;
      const ohmBonus = Number(eq?.electricOhmsDerived ?? 0) + potionOhms;
      const baseOhms = resist?.electric?.ohms;
      const effectiveOhms = baseOhms === Infinity ? Infinity
        : (Number.isFinite(baseOhms) ? baseOhms + ohmBonus : ohmBonus);
      const rMult = electricMultiplier({ electric: { ohms: effectiveOhms } });
      if (rMult <= 0) return 0;
      const gMult = equippedConductivityMultiplier(world, targetId);
      return Math.max(0, Math.floor(rawAmount * rMult * gMult));
    }
    case 'blunt': {
      const drBonus = Number(eq?.kineticDRDerived ?? 0);
      const multBonus = Number(eq?.bluntResistDerived ?? 0);
      const afterDR = Math.max(0, rawAmount - ((resist.kinetic?.DR || 0) + drBonus));
      const effectiveMult = Math.max(0, (resist.kinetic?.bluntMult ?? 1.0) - multBonus);
      return Math.max(0, Math.floor(afterDR * effectiveMult));
    }
    case 'slash': {
      const drBonus = Number(eq?.kineticDRDerived ?? 0);
      const multBonus = Number(eq?.slashResistDerived ?? 0);
      const afterDR = Math.max(0, rawAmount - ((resist.kinetic?.DR || 0) + drBonus));
      const effectiveMult = Math.max(0, (resist.kinetic?.slashMult ?? 1.0) - multBonus);
      return Math.max(0, Math.floor(afterDR * effectiveMult));
    }
    case 'pierce': {
      const drBonus = Number(eq?.kineticDRDerived ?? 0);
      const multBonus = Number(eq?.pierceResistDerived ?? 0);
      const afterDR = Math.max(0, rawAmount - ((resist.kinetic?.DR || 0) + drBonus));
      const effectiveMult = Math.max(0, (resist.kinetic?.pierceMult ?? 1.0) - multBonus);
      return Math.max(0, Math.floor(afterDR * effectiveMult));
    }
    case 'physical': {
      const drBonus = Number(eq?.kineticDRDerived ?? 0);
      return Math.max(0, rawAmount - ((resist.kinetic?.DR || 0) + drBonus));
    }
    case 'fire': {
      const bonus = Number(eq?.fireResistDerived ?? 0) + activeResistBonus(world, targetId, "resist_fire");
      const effectiveMult = Math.max(0, (resist.thermal?.burnMult ?? 1.0) - bonus);
      return Math.max(0, Math.floor(rawAmount * effectiveMult));
    }
    case 'poison': {
      const bonus = Number(eq?.poisonResistDerived ?? 0) + activeResistBonus(world, targetId, "resist_poison");
      const effectiveMult = Math.max(0, (resist.chemical?.toxMult ?? 1.0) - bonus);
      return Math.max(0, Math.floor(rawAmount * effectiveMult));
    }
    case 'acid': {
      const bonus = Number(eq?.acidResistDerived ?? 0) + activeResistBonus(world, targetId, "resist_acid");
      const effectiveMult = Math.max(0, (resist.chemical?.acidMult ?? 1.0) - bonus);
      return Math.max(0, Math.floor(rawAmount * effectiveMult));
    }
    case 'radiation': {
      const bonus = Number(eq?.radiationResistDerived ?? 0);
      const effectiveMult = Math.max(0, (resist.radiation?.gamma ?? 1.0) - bonus);
      return Math.max(0, Math.floor(rawAmount * effectiveMult));
    }
    default:
      return rawAmount;
  }
}

// ── The pipeline ────────────────────────────────────────────────────

/**
 * @typedef {Object} DamageSpec
 * @property {number}  target              - Entity ID receiving damage
 * @property {number}  amount              - Raw damage (pre-resistance)
 * @property {number}  [source=0]          - Entity ID that caused damage (0 = environmental)
 * @property {string}  [type='physical']   - Damage type for resistance resolution
 * @property {string}  [cause]             - Human-readable cause for messages
 * @property {{x:number,y:number}} [at]    - Override position for floating text
 * @property {boolean} [critical=false]    - Mark as critical hit
 * @property {boolean} [bypassInvuln=false]- Skip invulnerability check
 * @property {boolean} [bypassResist=false]- Skip resistance resolution
 * @property {boolean} [noTrigger=false]   - Suppress affix/hook triggers (prevents retaliate loops)
 */

/**
 * @typedef {Object} DamageResult
 * @property {boolean} applied  - Whether HP was deducted
 * @property {boolean} killed   - Whether target reached 0 HP
 * @property {number}  amount   - Final damage dealt (after resistances)
 * @property {number}  rawAmount- Original damage before resistances
 * @property {string}  reason   - 'applied' | 'invalid-target' | 'no-vitality' | 'zero-amount' | 'invulnerable' | 'resisted'
 */

const ZERO_RESULT = Object.freeze({ applied: false, killed: false, amount: 0, rawAmount: 0 });

/**
 * Canonical damage pipeline. ALL damage in the game flows through here.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {DamageSpec} spec
 * @returns {DamageResult}
 */
export function dealDamage(world, spec) {
  const target = Number(spec.target || 0) | 0;
  if (!(target > 0) || !world.isAlive(target)) {
    return { ...ZERO_RESULT, reason: 'invalid-target' };
  }

  const vit = world.get(target, Vitality);
  if (!vit || (vit.hp | 0) <= 0) {
    return { ...ZERO_RESULT, reason: 'no-vitality' };
  }

  const rawAmount = Math.max(0, Number(spec.amount || 0) | 0);
  if (rawAmount <= 0) {
    return { ...ZERO_RESULT, reason: 'zero-amount' };
  }

  const source = Number(spec.source || 0) | 0;
  const type = String(spec.type || 'physical').toLowerCase();
  const cause = spec.cause || type;
  const critical = !!spec.critical;

  // Step 2: Invulnerability gate
  if (!spec.bypassInvuln && isEntityInvulnerable(world, target)) {
    try {
      world.emit?.('status', { id: target, kind: 'immune', text: 'IMMUNE', source });
    } catch { /* */ }
    return { ...ZERO_RESULT, rawAmount, reason: 'invulnerable' };
  }

  // Step 3: Resistance resolution
  const finalAmount = spec.bypassResist
    ? rawAmount
    : resolveResistance(world, target, rawAmount, type);

  if (finalAmount <= 0) {
    try {
      world.emit?.('status', { id: target, kind: 'resist', text: 'RESIST', source });
    } catch { /* */ }
    return { ...ZERO_RESULT, rawAmount, reason: 'resisted' };
  }

  // Step 4: Apply damage
  vit.hp = Math.max(0, (vit.hp | 0) - finalAmount);

  // Step 5: Emit 'damaged'
  try {
    world.emit?.('damaged', {
      target,
      amount: finalAmount,
      rawAmount,
      type,
      source,
      cause,
      critical,
      at: spec.at || undefined,
      noTrigger: !!spec.noTrigger,
    });
  } catch { /* */ }

  // Step 6: Death check
  const killed = (vit.hp | 0) <= 0;
  if (killed) {
    try { world.emit?.('died', { id: target, killer: source, cause }); } catch { /* */ }
  }

  return { applied: true, killed, amount: finalAmount, rawAmount, reason: 'applied' };
}
