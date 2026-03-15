// Corpse nutrition and on-eat hook data.

import {
  cancelEat,
  corpseIronStomachProgress,
  corpseStatusEffect,
  corpseDamage,
  grantElectricResist,
} from "./callbacks/eat.js";

/**
 * Base nutrition by monster sizeClass.
 * These values represent "hunger reduction" when the food is consumed.
 */
export const NUTRITION_BY_SIZE = {
  XS: 90,
  S: 180,
  M: 360,
  L: 600,
  XL: 900,
};

/**
 * Compute nutrition from a monster def, factoring in massKg for fine-tuning.
 * @param {{ sizeClass: string, massKg: number }} monsterDef
 * @returns {number}
 */
export function computeCorpseNutrition(monsterDef) {
  const base = NUTRITION_BY_SIZE[monsterDef.sizeClass] || 200;
  const massBonus = Math.floor((monsterDef.massKg || 0) / 10);
  return base + massBonus;
}

const EMPTY_HOOKS = Object.freeze([]);

/**
 * Corpse item definitions keyed by corpse identity.
 * The identity convention is `corpse_${monsterId}`.
 */
export const CORPSE_DEFS = Object.freeze({
  corpse_rat: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("disease", 20, 1), corpseIronStomachProgress]),
  }),
  corpse_bat: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("disease", 20, 1), corpseIronStomachProgress]),
  }),
  corpse_grid_bug: Object.freeze({
    onEat: Object.freeze([corpseDamage(3)]),
  }),
  corpse_snake: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("poison", 8, 2)]),
  }),
  corpse_spider: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("poison", 8, 2)]),
  }),
  corpse_wraith: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 15, 1)]),
  }),
  corpse_floating_eye: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 30, 2, "hallucination")]),
  }),
  corpse_lich: Object.freeze({
    onEat: Object.freeze([corpseStatusEffect("mindwipe", 15, 1)]),
  }),
  corpse_eel: Object.freeze({
    onEat: Object.freeze([grantElectricResist]),
  }),
  corpse_test_cancel: Object.freeze({
    onEat: Object.freeze([cancelEat("FAIL", "You cannot stomach that.", true)]),
  }),
});

/**
 * @param {string} key
 * @returns {string}
 */
function normalizeCorpseIdentity(key) {
  const normalized = String(key || "").toLowerCase().trim();
  if (!normalized) return "";
  if (normalized.startsWith("corpse_")) return normalized;
  return `corpse_${normalized}`;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {{ onEat?: Function[] }|null}
 */
export function getCorpseDef(key) {
  const identity = normalizeCorpseIdentity(key);
  return identity ? (CORPSE_DEFS[identity] || null) : null;
}

/**
 * @param {string} key corpse identity or monster id
 * @returns {Function[]}
 */
export function getCorpseEatHooks(key) {
  const hooks = getCorpseDef(key)?.onEat;
  return Array.isArray(hooks) ? hooks : EMPTY_HOOKS;
}
