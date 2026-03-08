// display/palette/index.js
// Build the final palette from base + equipment + any optional packs

import { basePalette } from './base.js';
import { equipmentPalette } from './equipment.js';

// Non-creature entries in basePalette that should not get auto-generated corpse entries.
const _CORPSE_SKIP_PREFIXES = [
  'player', 'corpse_',
  'floor', 'grass', 'water', 'mountain', 'tree', 'wall', 'door', 'stair',
  'potion_', 'spellbook_', 'book_', 'scroll_', 'return_', 'ammo_',
  'food_', 'reagent_', 'ore_', 'gem_', 'trap_',
];
const _CORPSE_SKIP_KEYS = new Set([
  'gold', 'monster', 'bone', 'engraving', 'spawner', 'tombstone',
  'chest', 'bed_home', 'house_sign', 'alchemy_bench',
  'berry_bush', 'herb_patch', 'thorn_bramble', 'venom_fern', 'venom_spores',
  'anvil', 'furnace', 'furnace_unlit', 'cooking_fire',
  'crop_wheat', 'crop_turnip', 'crop_pumpkin',
  'well', 'scarecrow', 'tavern_keg', 'tavern_table',
  'tavern_bench', 'tavern_pillar', 'tavern_sign', 'millstone',
  'farmland', 'fence', 'roof_thatch_shadow', 'roof_thatch_lit',
  'roof_thatch_shadow_charred', 'roof_thatch_lit_charred',
  'fountain', 'altar', 'shrine', 'statue', 'sarcophagus',
  'pillar', 'weapon_rack', 'mushrooms', 'web', 'torch',
  'urn', 'ashes',
]);

export function buildPalette() {
  const merged = { ...basePalette, ...equipmentPalette };

  // Auto-generate corpse entries: any creature in basePalette gets a '%' entry
  // that inherits its fg/glow. New monsters are handled automatically.
  for (const [k, v] of Object.entries(basePalette)) {
    if (_CORPSE_SKIP_KEYS.has(k)) continue;
    if (_CORPSE_SKIP_PREFIXES.some(p => k.startsWith(p))) continue;
    if (!merged[`corpse_${k}`]) {
      merged[`corpse_${k}`] = { glyph: '%', fg: v.fg, glow: v.glow };
    }
  }

  return merged;
}
