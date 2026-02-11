/**
 * deitySystem — effects-phase system that ticks deity mood each world step.
 *
 * Reads Devotion components, ticks associated Deity instances, and emits
 * deity events onto the world event bus for the app layer to handle.
 *
 * The system also listens to world events (kills, heals) and forwards them
 * to the deity as actions.
 */

import { Devotion } from '../components/Devotion.js';
import { Deity } from '../../lib/deity-js/deity.js';
import { getDeity } from '../data/deities.js';
import { Player } from '../components/Player.js';

/** @type {Map<string, import('../deity/Deity.js').Deity>} */
const _deities = new Map();

/** @type {WeakSet<import('../../lib/ecs-js/index.js').World>} */
const _wired = new WeakSet();

/** Get (or lazily create) a Deity instance for a given deityId. */
function ensureDeity(deityId) {
  if (_deities.has(deityId)) return _deities.get(deityId);
  const def = getDeity(deityId);
  if (!def) return null;
  const deity = new Deity(def);
  _deities.set(deityId, deity);
  return deity;
}

/**
 * Install world-event hooks that feed the deity.
 * Called once per world instance.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
function wireWorldEvents(world) {
  if (_wired.has(world)) return;
  _wired.add(world);

  // Kill events → deity.action('kill')
  world.on('died', ({ id, killer }) => {
    if (!killer) return;
    // Only feed player kills to the deity
    if (!world.has(killer, Player)) return;
    const dev = world.get(killer, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;
    // Magnitude: base 0.3, bigger monsters could be higher in the future
    deity.action('kill', { magnitude: 0.5, target: String(id) });
  });

  // Heal events → deity.action('heal')
  world.on('healed', ({ id }) => {
    if (!world.has(id, Player)) return;
    const dev = world.get(id, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;
    deity.action('heal', { magnitude: 0.3, target: 'self' });
  });
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function deitySystem(world) {
  wireWorldEvents(world);

  for (const [entity, devotion] of world.query(Devotion)) {
    if (!devotion?.deityId) continue;
    const deity = ensureDeity(devotion.deityId);
    if (!deity) continue;

    // Tick the deity once per world step.
    // Deity events are forwarded to the world bus.
    deity.tick(1);
  }
}

/**
 * Access a deity instance by id (for app-layer event wiring).
 * @param {string} deityId
 */
export function getDeityInstance(deityId) {
  return _deities.get(deityId) ?? null;
}

/**
 * Initialize and register a deity (called from main.js after player creation).
 * @param {string} deityId
 * @returns {import('../deity/Deity.js').Deity|null}
 */
export function initDeity(deityId) {
  return ensureDeity(deityId);
}
