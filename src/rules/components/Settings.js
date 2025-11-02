import { defineComponent } from '../../lib/ecs-js/index.js';

// Player- or actor-level configurable settings that can influence systems.
// Defaults chosen to be conservative and predictable.
// Shape: { autoPickup: boolean, autoPickupKinds: string[] }
export const Settings = defineComponent('Settings', {
  autoPickup: true,
  autoPickupKinds: ['currency']
}, {
  validate(rec) {
    if (typeof rec.autoPickup !== 'boolean') throw new Error('Settings.autoPickup must be boolean');
    if (!Array.isArray(rec.autoPickupKinds)) throw new Error('Settings.autoPickupKinds must be an array');
    return true;
  }
});
