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
import { Vitality } from '../components/Vitality.js';
import { Hunger } from '../components/Hunger.js';
import { Status } from '../components/Status.js';

/** @type {Map<string, import('../deity/Deity.js').Deity>} */
const _deities = new Map();

/** @type {WeakSet<import('../../lib/ecs-js/index.js').World>} */
const _wired = new WeakSet();

/** @type {WeakMap<import('../../lib/deity-js/deity.js').Deity, Set<string>>} */
const _miraclesWired = new WeakMap();

/** Get (or lazily create) a Deity instance for a given deityId. */
function ensureDeity(deityId, world = null) {
  if (_deities.has(deityId)) return _deities.get(deityId);
  const def = getDeity(deityId);
  if (!def) return null;
  const deity = new Deity(def);
  _deities.set(deityId, deity);

  // Wire miracles if we have a world reference
  if (world) {
    if (!_miraclesWired.has(deity)) {
      _miraclesWired.set(deity, new Set());
    }
    const wiredWorlds = _miraclesWired.get(deity);
    // Use a unique ID for the world to avoid double-wiring
    const worldId = String(world.id || 'default');
    if (!wiredWorlds.has(worldId)) {
      wireDeityMiracles(deity, deityId, world);
      wiredWorlds.add(worldId);
    }
  }

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
 * Wire deity-to-world miracles (deity → player benefits).
 * Called when a deity instance is created.
 * @param {import('../../lib/deity-js/deity.js').Deity} deity
 * @param {string} deityId
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
function wireDeityMiracles(deity, deityId, world) {
  // When deity grants a miracle, help the player based on their needs
  deity.on('miracle', ({ serenity, tick }) => {
    // Find the player who worships this deity
    for (const [playerId] of world.query(Player, Devotion)) {
      const dev = world.get(playerId, Devotion);
      if (dev?.deityId !== deityId) continue;

      // Determine what the player needs most
      const needs = assessPlayerNeeds(world, playerId);

      if (needs.length === 0) {
        // Player is fine — just log the blessing
        world.emit('deity:miracle', {
          playerId,
          deityId,
          effect: 'blessing',
          message: `${deity.name} smiles upon you.`
        });
        return;
      }

      // Apply miracle based on primary need and deity personality
      const deityDef = getDeity(deityId);
      const primaryNeed = needs[0];

      if (primaryNeed === 'healing' && world.has(playerId, Vitality)) {
        // Heal the player
        const vit = world.get(playerId, Vitality);
        const healAmount = Math.floor(vit.maxHp * (deityDef?.alignment === 'lawful' ? 0.6 : 0.4));
        vit.hp = Math.min(vit.maxHp, vit.hp + healAmount);
        world.emit('deity:miracle', {
          playerId,
          deityId,
          effect: 'heal',
          amount: healAmount,
          message: `${deity.name} restores your vitality!`
        });
        world.emit('healed', { id: playerId, amount: healAmount, source: 'divine' });
      } else if (primaryNeed === 'food' && world.has(playerId, Hunger)) {
        // Satiate hunger
        const hunger = world.get(playerId, Hunger);
        const feedAmount = deityDef?.alignment === 'chaotic' ? 300 : 500;
        hunger.hunger = Math.max(0, hunger.hunger - feedAmount);
        hunger.satiation = (hunger.satiation || 0) + 50;
        world.emit('deity:miracle', {
          playerId,
          deityId,
          effect: 'satiate',
          message: `${deity.name} provides sustenance!`
        });
      } else if ((primaryNeed === 'cure' || primaryNeed === 'blessing') && world.has(playerId, Status)) {
        // Cure harmful status effects
        const status = world.get(playerId, Status);
        const harmful = ['diseased', 'poisoned', 'cursed', 'bleeding', 'weakened'];
        const before = status.statuses.length;
        status.statuses = status.statuses.filter(s => !harmful.includes(s.type));
        const cured = before - status.statuses.length;

        if (cured > 0) {
          world.emit('deity:miracle', {
            playerId,
            deityId,
            effect: 'cure',
            count: cured,
            message: `${deity.name} purges your afflictions!`
          });
        }
      }
    }
  });
}

/**
 * Determine what the player needs most urgently.
 * @returns {string[]} Array of needs in priority order: 'healing', 'food', 'cure', 'blessing'
 */
function assessPlayerNeeds(world, playerId) {
  const needs = [];

  // Check HP
  if (world.has(playerId, Vitality)) {
    const vit = world.get(playerId, Vitality);
    const hpPercent = vit.hp / vit.maxHp;
    if (hpPercent < 0.5) {
      needs.push({ type: 'healing', urgency: 1.0 - hpPercent });
    }
  }

  // Check hunger
  if (world.has(playerId, Hunger)) {
    const hunger = world.get(playerId, Hunger);
    if (hunger.hunger > 200) {
      needs.push({ type: 'food', urgency: Math.min(1.0, hunger.hunger / 1000) });
    }
  }

  // Check status effects
  if (world.has(playerId, Status)) {
    const status = world.get(playerId, Status);
    let maxUrgency = 0;
    let needsBlessing = false;

    for (const s of status.statuses || []) {
      if (s.type === 'cursed') {
        needsBlessing = true;
        maxUrgency = Math.max(maxUrgency, 0.8);
      } else if (s.type === 'diseased' || s.type === 'poisoned') {
        maxUrgency = Math.max(maxUrgency, 0.7);
      } else if (s.type === 'bleeding') {
        maxUrgency = Math.max(maxUrgency, 0.6);
      }
    }

    if (needsBlessing) {
      needs.push({ type: 'blessing', urgency: maxUrgency });
    } else if (maxUrgency > 0) {
      needs.push({ type: 'cure', urgency: maxUrgency });
    }
  }

  // Sort by urgency descending and return just the types
  return needs.sort((a, b) => b.urgency - a.urgency).map(n => n.type);
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function deitySystem(world) {
  wireWorldEvents(world);

  for (const [entity, devotion] of world.query(Devotion)) {
    if (!devotion?.deityId) continue;
    const deity = ensureDeity(devotion.deityId, world);
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
 * @param {import('../../lib/ecs-js/index.js').World} world - needed to wire miracles
 * @returns {import('../deity/Deity.js').Deity|null}
 */
export function initDeity(deityId, world = null) {
  return ensureDeity(deityId, world);
}
