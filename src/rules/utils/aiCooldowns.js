/**
 * Shared due-turn cooldown helpers for AI ability gates.
 */

/**
 * @param {any} world
 * @param {symbol} key
 * @returns {Map<string, number>}
 */
function ensureStore(world, key) {
  const rec = world[key];
  if (rec instanceof Map) return rec;
  const created = new Map();
  world[key] = created;
  return created;
}

/**
 * @param {any} world
 * @returns {number}
 */
function stepOf(world) {
  return Number(world?.step || 0) | 0;
}

/**
 * @param {any} world
 * @param {symbol} key
 * @param {string} slot
 * @returns {number}
 */
export function getAiCooldownRemaining(world, key, slot) {
  const store = ensureStore(world, key);
  const due = Number(store.get(String(slot)) ?? -1);
  const now = stepOf(world);
  if (!Number.isFinite(due) || due <= now) {
    store.delete(String(slot));
    return 0;
  }
  return Math.max(0, (due | 0) - now);
}

/**
 * @param {any} world
 * @param {symbol} key
 * @param {string} slot
 * @returns {boolean}
 */
export function isAiOnCooldown(world, key, slot) {
  return getAiCooldownRemaining(world, key, slot) > 0;
}

/**
 * @param {any} world
 * @param {symbol} key
 * @param {string} slot
 * @param {number} turns
 */
export function startAiCooldown(world, key, slot, turns) {
  const ttl = Math.max(0, Number(turns || 0) | 0);
  const store = ensureStore(world, key);
  const s = String(slot);
  if (!(ttl > 0)) {
    store.delete(s);
    return;
  }
  store.set(s, stepOf(world) + ttl);
}
