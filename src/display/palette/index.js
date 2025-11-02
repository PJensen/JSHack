// display/palette/index.js
// Build the final palette from base + equipment + any optional packs

import { basePalette } from './base.js';
import { equipmentPalette } from './equipment.js';

export function buildPalette() {
  return { ...basePalette, ...equipmentPalette };
}
