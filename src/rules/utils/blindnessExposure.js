// ── Attacker penalties (swinging blind) ─────────────────────────────────
const BLINDED_ATTACK_PENALTY_PER_STACK = 3;
const BLINDED_ATTACK_PENALTY_CAP = 8;
const BLINDED_FUMBLE_CHANCE_PER_STACK_PCT = 10;
const BLINDED_FUMBLE_CHANCE_CAP_PCT = 40;

// ── Defender penalties (being hit while blind) ──────────────────────────
const BLINDED_MELEE_DEFENSE_PENALTY_PER_STACK = 2;
const BLINDED_RANGED_DEFENSE_PENALTY_PER_STACK = 3;
const BLINDED_DEFENSE_PENALTY_CAP = 12;
const BLINDED_CRIT_CHANCE_BONUS_PER_STACK_PCT = 4;
const BLINDED_CRIT_CHANCE_BONUS_CAP_PCT = 40;
const BLINDED_CRIT_MULT_BONUS_PER_STACK = 0.15;
const BLINDED_CRIT_MULT_BONUS_CAP = 1.0;
const BLINDED_PHYSICAL_DAMAGE_MULT_PER_STACK = 0.05;
const BLINDED_PHYSICAL_DAMAGE_MULT_CAP = 0.5;

/**
 * Hit penalty for a blinded attacker swinging without sight.
 * @param {number} blindedStrength
 * @returns {number} positive value to subtract from attack bonus
 */
export function getBlindedAttackPenalty(blindedStrength) {
  const strength = Math.max(0, Number(blindedStrength || 0));
  return Math.min(BLINDED_ATTACK_PENALTY_CAP, strength * BLINDED_ATTACK_PENALTY_PER_STACK);
}

/**
 * Fumble chance for a blinded attacker (percentage, 0–100).
 * @param {number} blindedStrength
 * @returns {number}
 */
export function getBlindedFumbleChancePct(blindedStrength) {
  const strength = Math.max(0, Number(blindedStrength || 0));
  return Math.min(BLINDED_FUMBLE_CHANCE_CAP_PCT, strength * BLINDED_FUMBLE_CHANCE_PER_STACK_PCT);
}

/**
 * @param {number} blindedStrength
 * @param {'melee'|'ranged'|string} mode
 * @returns {number}
 */
export function getBlindedDefensePenalty(blindedStrength, mode = 'melee') {
  const strength = Math.max(0, Number(blindedStrength || 0));
  const perStack = String(mode || 'melee').toLowerCase() === 'ranged'
    ? BLINDED_RANGED_DEFENSE_PENALTY_PER_STACK
    : BLINDED_MELEE_DEFENSE_PENALTY_PER_STACK;
  return Math.min(BLINDED_DEFENSE_PENALTY_CAP, strength * perStack);
}

/**
 * @param {number} blindedStrength
 * @returns {number}
 */
export function getBlindedCritChanceBonusPct(blindedStrength) {
  const strength = Math.max(0, Number(blindedStrength || 0));
  return Math.min(BLINDED_CRIT_CHANCE_BONUS_CAP_PCT, strength * BLINDED_CRIT_CHANCE_BONUS_PER_STACK_PCT);
}

/**
 * @param {number} blindedStrength
 * @returns {number}
 */
export function getBlindedCritMultBonus(blindedStrength) {
  const strength = Math.max(0, Number(blindedStrength || 0));
  return Math.min(BLINDED_CRIT_MULT_BONUS_CAP, strength * BLINDED_CRIT_MULT_BONUS_PER_STACK);
}

/**
 * @param {number} amount
 * @param {number} blindedStrength
 * @returns {number}
 */
export function calculateBlindedPhysicalDamage(amount, blindedStrength) {
  const dmg = Math.max(0, Number(amount || 0));
  const strength = Math.max(0, Number(blindedStrength || 0));
  if (dmg <= 0 || strength <= 0) return dmg;
  const mult = 1 + Math.min(
    BLINDED_PHYSICAL_DAMAGE_MULT_CAP,
    strength * BLINDED_PHYSICAL_DAMAGE_MULT_PER_STACK,
  );
  return Math.max(1, Math.floor(dmg * mult));
}
