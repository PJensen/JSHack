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
import { Pet } from '../components/Pet.js';
import { Owner } from '../components/Owner.js';

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

  // Kill events → deity.action('kill') + optional offering
  world.on('died', ({ id, killer }) => {
    if (!killer) return;
    if (!world.has(killer, Player)) return;
    const dev = world.get(killer, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;
    const def = getDeity(dev.deityId);
    deity.action('kill', { magnitude: 0.5, target: String(id) });
    // War gods treat kills as implicit blood offerings (resets neglect clock)
    if (def?.killsAreOfferings) {
      deity.offer('blood', { value: 0.3, alignment: def.alignment ?? 'neutral' });
    }
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

  // Pet death → deity.action('betray') — killing your own companion
  world.on('pet:died', ({ ownerId, name }) => {
    if (!world.has(ownerId, Player)) return;
    const dev = world.get(ownerId, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;
    // Betrayal is a serious offense — magnitude reflects the bond broken
    deity.action('betray', { magnitude: 0.8, target: name || 'companion' });
  });

  // Eating pet corpse → deity.desecrate() — ultimate disrespect
  world.on('corpse:desecrated', ({ actor, corpseName }) => {
    if (!world.has(actor, Player)) return;
    const dev = world.get(actor, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;
    // Direct desecration — eating your companion's remains
    deity.desecrate(corpseName || 'pet_corpse');
  });

  // Hitting your own pet → deity.action('betray') with lower magnitude
  world.on('damaged', ({ target, source, amount }) => {
    if (!source || !target) return;
    if (!world.has(source, Player)) return;
    if (!world.has(target, Pet)) return;

    // Check if the player owns this pet
    const owner = world.get(target, Owner);
    if (!owner || owner.ownerId !== source) return;

    const dev = world.get(source, Devotion);
    if (!dev?.deityId) return;
    const deity = _deities.get(dev.deityId);
    if (!deity) return;

    // Lesser betrayal than killing — scale by damage dealt
    const magnitude = Math.min(0.3, (amount || 1) * 0.05);
    deity.action('betray', { magnitude, target: 'companion' });
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
