import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { isIdentified } from "../data/identification.js";
import { getUnidentifiedGemValue } from "../data/gemPricing.js";

const BASE_BY_TYPE = Object.freeze({
  equip: 32,
  potion: 22,
  scroll: 34,
  learn: 38,
  wand: 45,
  book: 35,
  ammo: 8,
  food: 7,
  ingredient: 8,
  material: 8,
  tool: 20,
  item: 12,
  misc: 10,
});

const SLOT_BONUS = Object.freeze({
  weapon: 22,
  armor: 24,
  shield: 18,
  head: 12,
  neck: 12,
  belt: 10,
  gloves: 10,
  ring: 28,
  legs: 16,
  ranged: 20,
  feet: 10,
  ammo: 0,
  bag: 0,
  brain: 12,
});

const BONUS_WEIGHTS = Object.freeze({
  attack: 8,
  defense: 10,
  maxHp: 1.3,
  maxMana: 1.5,
  maxStamina: 0.9,
  critChance: 140,
  critMult: 55,
  manaRegen: 42,
  staminaRegen: 26,
  fireResist: 80,
  poisonResist: 80,
  acidResist: 80,
  slashResist: 80,
  pierceResist: 80,
  bluntResist: 80,
  kineticDR: 10,
  electricOhms: 0.03,
  dig: 15,
  chop: 14,
});

const RARITY_MULTIPLIERS = Object.freeze([1.0, 1.35, 1.75, 2.2, 2.7, 3.2]);

/**
 * @param {unknown} raw
 * @param {number} fallback
 */
function toNumber(raw, fallback = 0) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parse "NdM" dice notation and return expected average.
 * @param {unknown} spec
 * @returns {number}
 */
function expectedDice(spec) {
  const match = /^\s*(\d+)\s*d\s*(\d+)\s*$/i.exec(String(spec || ""));
  if (!match) return 0;
  const count = Math.max(0, Number(match[1]) | 0);
  const sides = Math.max(0, Number(match[2]) | 0);
  if (count <= 0 || sides <= 0) return 0;
  return count * ((sides + 1) / 2);
}

/**
 * @param {unknown} rarity
 * @returns {number}
 */
function rarityMultiplier(rarity) {
  const tier = Math.max(1, toNumber(rarity, 1) | 0);
  if (tier <= RARITY_MULTIPLIERS.length) return RARITY_MULTIPLIERS[tier - 1];
  return RARITY_MULTIPLIERS[RARITY_MULTIPLIERS.length - 1] + ((tier - RARITY_MULTIPLIERS.length) * 0.45);
}

/**
 * @param {unknown} bonuses
 * @returns {number}
 */
function scoreBonuses(bonuses) {
  if (!bonuses || typeof bonuses !== "object") return 0;
  let score = 0;
  for (const [key, raw] of Object.entries(bonuses)) {
    const value = Math.abs(toNumber(raw, 0));
    if (value <= 0) continue;
    const weight = Object.prototype.hasOwnProperty.call(BONUS_WEIGHTS, key)
      ? BONUS_WEIGHTS[key]
      : (value <= 1 ? 48 : 4);
    score += value * weight;
  }
  return score;
}

/**
 * Estimate value from ItemInfo when explicit value is missing.
 * Deterministic and side-effect free.
 *
 * @param {Record<string, any>|null|undefined} info
 * @returns {number}
 */
export function estimateItemValueFromInfo(info) {
  if (!info || typeof info !== "object") return 0;

  const explicit = toNumber(info.value, 0);
  if (explicit > 0) return Math.ceil(explicit);

  const type = String(info.type || "").toLowerCase();
  if (type === "gem") return 0;
  if (type === "currency") {
    const count = Math.max(1, toNumber(info.count, 1) | 0);
    return Math.max(1, count);
  }

  let score = BASE_BY_TYPE[type] ?? 10;
  const slot = String(info.slot || "").toLowerCase();
  score += SLOT_BONUS[slot] ?? 0;
  score += scoreBonuses(info.bonuses);
  score += expectedDice(info.damageDice) * 7;

  if (info.twoHanded) score += 10;

  const affixCount = Array.isArray(info.affixes) ? info.affixes.length : 0;
  score += affixCount * 20;

  if (Number.isFinite(Number(info.staminaCost))) {
    const staminaCost = Math.max(0, toNumber(info.staminaCost, 0));
    // Lower stamina costs are modestly premium; very high costs lose a bit of value.
    score += Math.max(-8, 10 - (staminaCost * 0.65));
  }

  score *= rarityMultiplier(info.rarity);
  return Math.max(1, Math.ceil(score));
}

/**
 * Resolve appearance-based valuation for unidentified gems.
 * Returns 0 for non-gems, identified gems, or when pricing table is unavailable.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @returns {number}
 */
export function getUnidentifiedGemAppraisal(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  if (!info || String(info.type || "").toLowerCase() !== "gem") return 0;

  const identity = String(world.get(itemId, NamedIdentity)?.identity || "");
  if (identity && isIdentified(identity)) return 0;

  return Math.max(0, Math.ceil(toNumber(getUnidentifiedGemValue(String(info.description || "")), 0)));
}

/**
 * Appraise an item entity for commerce.
 * - Uses explicit ItemInfo.value when present
 * - Supports caller-provided unidentified gem value
 * - Falls back to deterministic stat-based appraisal
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {{ unidentifiedGemValue?: number }} [opts]
 * @returns {number}
 */
export function appraiseItemValue(world, itemId, opts = {}) {
  const info = world.get(itemId, ItemInfo);
  if (!info) return 0;

  const type = String(info.type || "").toLowerCase();
  if (type === "gem") {
    const override = toNumber(opts.unidentifiedGemValue, 0);
    if (override > 0) return Math.ceil(override);
  }

  return estimateItemValueFromInfo(info);
}
