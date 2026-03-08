export { neonPulse }    from './neonPulse.js';
export { aegisWard }   from './aegisWard.js';
export { poisonPulse } from './poisonPulse.js';
export { frozenCrystal } from './frozenCrystal.js';
export { shockArc }    from './shockArc.js';
export { bleedPulse }  from './bleedPulse.js';
export { dragonBreath } from './dragonBreath.js';

import { neonPulse as _neonPulse }         from './neonPulse.js';
import { aegisWard as _aegisWard }         from './aegisWard.js';
import { poisonPulse as _poisonPulse }     from './poisonPulse.js';
import { frozenCrystal as _frozenCrystal } from './frozenCrystal.js';
import { shockArc as _shockArc }           from './shockArc.js';
import { bleedPulse as _bleedPulse }       from './bleedPulse.js';
import { dragonBreath as _dragonBreath }   from './dragonBreath.js';

// Optional registry mapping logical effect keys to FX functions
export const GLYPH_VFX_REGISTRY = {
  glow:    { fn: _neonPulse },
  shield:  { fn: _aegisWard },
  ward:    { fn: _aegisWard },
  poison:  { fn: _poisonPulse },
  frozen:  { fn: _frozenCrystal },
  shock:   { fn: _shockArc },
  bleed:   { fn: _bleedPulse },
  bleeding: { fn: _bleedPulse },
  dragon_breath: { fn: _dragonBreath },
};
