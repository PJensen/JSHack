// src/rules/utils/spellCooldowns.js
// Lightweight player-spell cooldown tracking stored on world via Symbol key.
// Pattern mirrors src/rules/data/callbacks/ai.js SPELL_CAST_COOLDOWN_KEY.
import { createTurnSchedule } from "./turnSchedule.js";

/** @typedef {{ dueTurn: number, max: number }} SpellCD */

const PLAYER_SPELL_CD = Symbol.for("jshack:player:spellCooldowns");
const PLAYER_SPELL_CD_SCHEDULE = Symbol.for("jshack:player:spellCooldowns:schedule");

function worldStep(world) {
  return Number(world?.step || 0) | 0;
}

/**
 * @param {any} world
 */
function getSpellSchedule(world) {
  if (!world[PLAYER_SPELL_CD_SCHEDULE]) {
    world[PLAYER_SPELL_CD_SCHEDULE] = createTurnSchedule({ maxLevel: 12 });
  }
  return world[PLAYER_SPELL_CD_SCHEDULE];
}

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
  const rec = map.get(spellId) || null;
  if (!rec) return null;
  const remaining = Math.max(0, (rec.dueTurn | 0) - worldStep(world));
  if (remaining <= 0) {
    map.delete(spellId);
    getSpellSchedule(world).cancel(spellId);
    return null;
  }
  return { remaining, max: rec.max | 0 };
}

/**
 * @param {any} world
 * @param {string} spellId
 * @param {number} remaining
 * @param {number} max
 */
export function setSpellCooldown(world, spellId, remaining, max) {
  const map = getSpellCooldownMap(world);
  if (remaining <= 0) {
    map.delete(spellId);
    getSpellSchedule(world).cancel(spellId);
    return;
  }
  const dueTurn = worldStep(world) + (remaining | 0);
  map.set(spellId, { dueTurn, max: max | 0 });
  getSpellSchedule(world).schedule(spellId, dueTurn, spellId);
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
  const schedule = getSpellSchedule(world);
  schedule.drainDue(worldStep(world), (spellId) => {
    map.delete(spellId);
  });
}
