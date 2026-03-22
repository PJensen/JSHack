// src/rules/utils/spellCooldowns.js
// Lightweight player-spell cooldown tracking stored on world via Symbol key.
// Pattern mirrors src/rules/data/callbacks/ai.js SPELL_CAST_COOLDOWN_KEY.

/** @typedef {{ remaining: number, max: number }} SpellCD */

const PLAYER_SPELL_CD = Symbol.for("jshack:player:spellCooldowns");

/**
 * @param {any} world
 * @returns {Map<string, SpellCD>}
 */
export function getSpellCooldownMap(world) {
  if (!world[PLAYER_SPELL_CD]) world[PLAYER_SPELL_CD] = new Map();
  return world[PLAYER_SPELL_CD];
}

/**
 * @param {any} world
 * @param {string} spellId
 * @returns {SpellCD|null}
 */
export function getSpellCooldown(world, spellId) {
  const map = getSpellCooldownMap(world);
  return map.get(spellId) || null;
}

/**
 * @param {any} world
 * @param {string} spellId
 * @param {number} remaining
 * @param {number} max
 */
export function setSpellCooldown(world, spellId, remaining, max) {
  const map = getSpellCooldownMap(world);
  if (remaining <= 0) { map.delete(spellId); return; }
  map.set(spellId, { remaining, max });
}

/**
 * @param {any} world
 * @param {string} spellId
 * @returns {boolean}
 */
export function isSpellOnCooldown(world, spellId) {
  const cd = getSpellCooldown(world, spellId);
  return !!cd && cd.remaining > 0;
}

/**
 * Tick all player spell cooldowns down by 1. Remove entries that reach 0.
 * @param {any} world
 */
export function tickSpellCooldowns(world) {
  const map = getSpellCooldownMap(world);
  for (const [id, cd] of map) {
    cd.remaining--;
    if (cd.remaining <= 0) map.delete(id);
  }
}
