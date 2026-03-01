// src/main/channelingController.js
// App-layer controller for the cast-time mechanic.
// When a spell with castTime begins channeling, this controller:
//   1. Locks player input (window.__JSHACK_INPUT_LOCKED)
//   2. Auto-ticks the world every 500ms (adds WaitIntent + world.tick)
//   3. Listens for ESC to cancel the channel
//   4. Cleans up on channeling:complete or channeling:cancelled

import { WaitIntent } from "../rules/components/Intents/WaitIntent.js";
import { Channeling } from "../rules/components/Channeling.js";

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

  function stopLoop() {
    if (_timerId !== null) {
      clearTimeout(_timerId);
      _timerId = null;
    }
    if (_escHandler) {
      try { window.removeEventListener('keydown', _escHandler); } catch {}
      _escHandler = null;
    }
    try { /** @type {any} */ (window).__JSHACK_INPUT_LOCKED = false; } catch {}
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
        stopLoop();
      }
    }, TICK_INTERVAL_MS);
  }

  function startLoop() {
    try { /** @type {any} */ (window).__JSHACK_INPUT_LOCKED = true; } catch {}

    // Install ESC handler for cancellation
    _escHandler = (ev) => {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        ev.preventDefault();
        ev.stopPropagation();
        cancelChanneling();
      }
    };
    try { window.addEventListener('keydown', _escHandler, true); } catch {}

    scheduleNextTick();
  }

  // Listen for channeling events on the player
  world.on('channeling:start', ({ actor }) => {
    const actorId = getActorId();
    if (actor !== actorId) return; // Only auto-tick for the player
    startLoop();
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
