// src/display/ui/wiring/petUiBridge.js
// Dispatches browser-level UI events when pet state changes.

/**
 * Install pet UI bridge: notifies the outer UI shell when a pet dies.
 * @param {{
 *   world: import('../../../lib/ecs-js/index.js').World,
 *   isPet: (id: number) => boolean,
 * }} deps
 */
export function installPetUiBridge({ world, isPet }) {
  world.on('died', ({ id }) => {
    if (isPet(Number(id || 0))) {
      window.dispatchEvent(new CustomEvent('ui:petExists', {
        detail: { exists: false }
      }));
    }
  });
}
