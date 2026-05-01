// display/palette/equipment.js
// Visual lookups for equipment identities. Display-only. Keep in sync with rules/data/equipment ids.

import { weapons } from './packs/weapons.js';
import { armor } from './packs/armor.js';
import { rings } from './packs/rings.js';

import { S_SHIELD } from './base.js';

export const equipmentPalette = {
  ...weapons,
  ...armor,
  ...rings,
  shield_wood:   { glyph:"[", fg:"#614116ff", glow:"#deb887", baseScale: S_SHIELD },
};
