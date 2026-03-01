// src/main/channelingController.js
// App-layer controller for the cast-time mechanic.
// When a spell with castTime begins channeling, this controller:
//   1. Locks player input (window.__JSHACK_INPUT_LOCKED)
//   2. Auto-ticks the world every 500ms (adds WaitIntent + world.tick)
//   3. Listens for ESC to cancel the channel
//   4. Cleans up on channeling:complete or channeling:cancelled

import { WaitIntent } from "../rules/components/Intents/WaitIntent.js";
import { Channeling } from "../rules/components/Channeling.js";
import { getSpell } from "../rules/data/spells.js";

const INSTALLED_KEY = Symbol.for('jshack:channelingController:installed');
const TICK_INTERVAL_MS = 500;

/**
 * Install the channeling auto-tick controller on a world.
 * @param {import('../lib/ecs-js/index.js').World} world
 * @param {() => number} getActorId - Returns the current player entity id
 */
export function installChannelingController(world, getActorId) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  let _timerId = null;
  let _escHandler = null;
  let _cancelUiHandler = null;

  /** Dispatch a window CustomEvent for the HUD overlay. */
  function uiEvent(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  function stopLoop() {
    if (_timerId !== null) {
      clearTimeout(_timerId);
      _timerId = null;
    }
    if (_escHandler) {
      try { window.removeEventListener('keydown', _escHandler); } catch {}
      _escHandler = null;
    }
    if (_cancelUiHandler) {
      try { window.removeEventListener('ui:cancelChanneling', _cancelUiHandler); } catch {}
      _cancelUiHandler = null;
    }
    try { /** @type {any} */ (window).__JSHACK_INPUT_LOCKED = false; } catch {}
    uiEvent('ui:channeling:end', {});
  }

  function cancelChanneling() {
    const actorId = getActorId();
    if (actorId && world.has(actorId, Channeling)) {
      const ch = world.get(actorId, Channeling);
      try { world.remove(actorId, Channeling); } catch {}
      try {
        world.emit?.('channeling:cancelled', {
          actor: actorId,
          spellId: ch?.spellId || '',
          reason: 'player_cancel',
        });
      } catch {}
    }
    stopLoop();
  }

  function scheduleNextTick() {
    _timerId = setTimeout(() => {
      _timerId = null;
      const actorId = getActorId();
      if (!actorId) { stopLoop(); return; }

      // Check if still channeling
      if (!world.has(actorId, Channeling)) {
        stopLoop();
        return;
      }

      // Add WaitIntent and tick the world
      try { world.add(actorId, WaitIntent, {}); } catch {}
      try { world.tick(1); } catch {}

      // Continue if still channeling after tick
      if (world.has(actorId, Channeling)) {
        scheduleNextTick();
      } else {
        // Channeling completed — the CastSpellIntent was deferred during
        // the tick (intents phase buffers structural mutations).  Run one
        // more tick so castSpellSystem can pick it up and fire the spell.
        try { world.add(actorId, WaitIntent, {}); } catch {}
        try { world.tick(1); } catch {}
        stopLoop();
      }
    }, TICK_INTERVAL_MS);
  }

  function startLoop(spellId) {
    try { /** @type {any} */ (window).__JSHACK_INPUT_LOCKED = true; } catch {}

    // Dispatch UI start event so the HUD can show the channeling overlay
    const spell = getSpell(spellId || '');
    const spellName = spell?.name || spellId || 'Spell';
    const castTime = spell?.castTime || 0;
    uiEvent('ui:channeling:start', { spellId, spellName, castTime });

    // Install ESC handler for cancellation
    _escHandler = (ev) => {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        ev.preventDefault();
        ev.stopPropagation();
        cancelChanneling();
      }
    };
    try { window.addEventListener('keydown', _escHandler, true); } catch {}

    // Install cancel handler for mobile cancel button
    _cancelUiHandler = () => cancelChanneling();
    try { window.addEventListener('ui:cancelChanneling', _cancelUiHandler); } catch {}

    scheduleNextTick();
  }

  // Listen for channeling events on the player
  world.on('channeling:start', ({ actor, spellId }) => {
    const actorId = getActorId();
    if (actor !== actorId) return; // Only auto-tick for the player
    startLoop(spellId);
  });

  world.on('channeling:tick', ({ actor, spellId, turnsRemaining, turnsTotal }) => {
    const actorId = getActorId();
    if (actor !== actorId) return;
    uiEvent('ui:channeling:tick', { spellId, turnsRemaining, turnsTotal });
  });

  world.on('channeling:complete', ({ actor }) => {
    const actorId = getActorId();
    if (actor === actorId) stopLoop();
  });

  world.on('channeling:cancelled', ({ actor }) => {
    const actorId = getActorId();
    if (actor === actorId) stopLoop();
  });
}
