// display/palette/base.js
// Base palette for tiles, actors, and common symbols (display-only)

export const basePalette = {
  // Actors
  player: { glyph: "@", fg: "#e8f7ff", glow: "#66ccff" },
  monster: { glyph: "m", fg: "#ffb0a0", glow: "#ff6666" },

  // Tiles
  // Colors tuned to match display defaults in drawDungeon
  floor: { glyph: ".", fg: "#576072", glow: "#1c2029" },
  wall: { glyph: "#", fg: "#8e96ab", glow: "#1f232c" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7" },
  gold: { glyph: "$", fg: "#ffde5a", glow: "#ffcc66" },
  torch: { glyph: "t", fg: "#ffd8a8", glow: "#ffb347" },

  // Ammo
  ammo_arrows: { glyph: "/", fg: "#e0e0e0", glow: "#f0f0f0" },

  // Potions
  potion_health: { glyph: "!", fg: "#66ff99", glow: "#5cff9a" },

  // Spellbooks (display-only kinds used by glyph atlas)
  spellbook_fire: { glyph: "b", fg: "#ff704d", glow: "#ff704d" },
  spellbook_ice: { glyph: "b", fg: "#4da6ff", glow: "#4da6ff" },
  spellbook_lightning: { glyph: "b", fg: "#ffff66", glow: "#ffff66" },
  // Alias to match rules identity so it renders on the ground
  book_lightning: { glyph: "b", fg: "#ffff66", glow: "#ffff66" },
  spellbook_dark: { glyph: "b", fg: "#b366ff", glow: "#b366ff" },
  spellbook_healing: { glyph: "b", fg: "#66ff99", glow: "#66ff99" },
  spellbook_summoning: { glyph: "b", fg: "#ff66ff", glow: "#ff66ff" },
  spellbook_earth: { glyph: "b", fg: "#cc9966", glow: "#cc9966" },

  // Fallback
  default: { glyph: "?", fg: "#cfe8ff", glow: "#66ccff" },
};
