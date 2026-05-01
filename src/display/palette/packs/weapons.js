import { S_WEAPON_L, S_WEAPON_S } from '../base.js';

export const weapons = {
  // Ranged weapons (not yet migrated to content DSL)
  bow_short:          { glyph:"}",  fg:"#c4a46c", glow:"#a08050", baseScale: S_WEAPON_L },
  bow_recurve:        { glyph:"}",  fg:"#c8b37a", glow:"#8b7245", baseScale: S_WEAPON_L },
  bow_long:           { glyph:"}",  fg:"#b09060", glow:"#887050", baseScale: S_WEAPON_L },
  bow_flaming:        { glyph:"}",  fg:"#ff8a3c", glow:"#ff4a1f", baseScale: S_WEAPON_L },
  bow_composite:      { glyph:"}",  fg:"#d4a8e0", glow:"#a070b8", baseScale: S_WEAPON_L },
  bow_shadow:         { glyph:"}",  fg:"#7088cc", glow:"#4060a8", baseScale: S_WEAPON_L },
  bow_mirror:         { glyph:"}",  fg:"#d0d8e8", glow:"#a0a8b8", baseScale: S_WEAPON_L },
  goblin_barbed_shortbow: { glyph:"}", fg:"#8a7a50", glow:"#5a4a30", baseScale: S_WEAPON_L },
  predator_stakebow:  { glyph:"}",  fg:"#9bcf68", glow:"#67943c", baseScale: S_WEAPON_L },
  doom_crossbow:      { glyph:"}",  fg:"#7f6aa8", glow:"#524079", baseScale: S_WEAPON_L },
  // Palette aliases (alternate display IDs for migrated items)
  venomfang:          { glyph:")",  fg:"#98e070", glow:"#63c44c", baseScale: S_WEAPON_S },
  nightfang:          { glyph:")",  fg:"#8df0a8", glow:"#52d57a", baseScale: S_WEAPON_S },
};
