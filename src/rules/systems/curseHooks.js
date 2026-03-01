// rules/systems/curseHooks.js
// World event hooks for cursing and uncursing equipment.
// Centralises Beatitude mutations so scrolls, miracles, and holy water
// all go through one path. Also provides `curse:equipment` for future
// monster-curse mechanics.

import { Beatitude } from "../components/Beatitude.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

const CURSE_HOOKS_INSTALLED = Symbol.for('jshack:curse:hooks:installed');

/**
 * Install curse-related world event listeners.
 * Idempotent — safe to call multiple times per world instance.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function installCurseHooks(world) {
  if (world[CURSE_HOOKS_INSTALLED]) return;
  world[CURSE_HOOKS_INSTALLED] = true;

  // Remove curse from an item (scroll, miracle, holy water all emit this)
  world.on('curse:removed', ({ itemId }) => {
    const id = Number(itemId || 0) | 0;
    if (!(id > 0) || !world.isAlive(id)) return;
    const beat = world.get(id, Beatitude);
    if (!beat || beat.state !== 'cursed') return;
    beat.state = 'uncursed';
  });

  // Apply curse to an equipped item (future monster use)
  world.on('curse:equipment', ({ actor, itemId, source }) => {
    const id = Number(itemId || 0) | 0;
    if (!(id > 0) || !world.isAlive(id)) return;
    let beat = world.get(id, Beatitude);
    if (!beat) {
      try { world.add(id, Beatitude, { state: 'cursed' }); } catch {}
      beat = world.get(id, Beatitude);
    }
    if (beat) beat.state = 'cursed';
    world.emit?.('item:welded', {
      actor: Number(actor || 0) | 0,
      itemId: id,
      slot: null,
      name: world.get(id, NamedIdentity)?.name || 'item',
      source: source || 'unknown',
    });
  });
}
