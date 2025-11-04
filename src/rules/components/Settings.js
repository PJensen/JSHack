import { defineComponent } from '../../lib/ecs-js/index.js';

// Player- or actor-level configurable settings that can influence systems.
// Defaults chosen to be conservative and predictable.
// Shape: { autoPickup: boolean, autoPickupKinds: string[], pickupRange: number }
export const Settings = defineComponent('Settings', {
  autoPickup: true,
  autoPickupKinds: ['currency'],
  // Max tile distance for manual pickups (e.g., via UI). 0 = same tile only.
  // Mobile-friendly default allows picking up adjacent tiles as well.
  pickupRange: 1
}, {
  validate(rec) {
    /** @type {any} */
    const r = /** @type any */ (rec);
    if (typeof r.autoPickup !== 'boolean') throw new Error('Settings.autoPickup must be boolean');
    if (!Array.isArray(r.autoPickupKinds)) throw new Error('Settings.autoPickupKinds must be an array');
    if (!Number.isFinite(r.pickupRange) || r.pickupRange < 0) throw new Error('Settings.pickupRange must be a non-negative number');
    return true;
  }
});
