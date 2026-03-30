// rules/utils/emitSafe.js
// Canonical safe event emission — catches listener errors so a broken
// handler never crashes a system mid-tick.

/**
 * Emit a world event, swallowing any errors thrown by listeners.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {string} event
 * @param {*} [payload]
 */
export function emitSafe(world, event, payload) {
  try { world.emit?.(event, payload); } catch (e) { console.debug(`emit ${event}:`, e); }
}
