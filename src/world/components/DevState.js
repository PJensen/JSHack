import { defineComponent } from '../../lib/ecs/core.js';

// DevState: singleton component for developer/runtime toggles and flags
export const DevState = defineComponent('DevState', {
  effectQuality: 'high',
  effectDebugInit: false,
  fovOnlyRender: true,  // F6: Only render tiles within FOV (enabled by default)
  fogReset: false       // When set true, a system will clear MapView.seenMask once and reset this to false
});
