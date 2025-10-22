import { defineComponent } from '../../lib/ecs/core.js';

// DevState: singleton component for developer/runtime toggles and flags
export const DevState = defineComponent('DevState', {
  effectQuality: 'high',
  effectDebugInit: false
});
