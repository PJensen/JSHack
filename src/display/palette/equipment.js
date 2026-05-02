// display/palette/equipment.js
// Visual lookups for equipment identities. Display-only. Keep in sync with rules/data/equipment ids.

import { weapons } from './packs/weapons.js';
import { armor } from './packs/armor.js';
import { rings } from './packs/rings.js';

export const equipmentPalette = {
  ...weapons,
  ...armor,
  ...rings,
};
