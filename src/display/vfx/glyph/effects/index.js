export { neonPulse } from './neonPulse.js';
export { aegisWard } from './aegisWard.js';

import { neonPulse as _neonPulse } from './neonPulse.js';
import { aegisWard as _aegisWard } from './aegisWard.js';

// Optional registry mapping logical effect keys to FX functions
export const GLYPH_VFX_REGISTRY = {
  glow:   { fn: _neonPulse },
  shield: { fn: _aegisWard },
  ward:   { fn: _aegisWard },
};
