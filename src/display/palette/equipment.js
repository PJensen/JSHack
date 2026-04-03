// display/palette/equipment.js
// Visual lookups for equipment identities. Display-only. Keep in sync with rules/data/equipment ids.

import { weapons } from './packs/weapons.js';
import { armor } from './packs/armor.js';
import { rings } from './packs/rings.js';

import { S_SHIELD, S_WEAPON_L } from './base.js';

export const equipmentPalette = {
  ...weapons,
  ...armor,
  ...rings,
  shield_wood:   { glyph:"[", fg:"#614116ff", glow:"#deb887", baseScale: S_SHIELD },
  iron_pickaxe:  { glyph:"⛏", fg:"#a0a0a0", glow:"#c0c0c0", baseScale: S_WEAPON_L }
};
