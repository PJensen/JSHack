// display/palette/base.js
// Base palette for tiles, actors, and common symbols (display-only)

export const basePalette = {
  // Actors
  player: { glyph: "@", fg: "#e8f7ff", glow: "#6cf" },
  monster: { glyph: "m", fg: "#ffb0a0", glow: "#f66" },
  // Tiles
  floor: { glyph: ".", fg: "#446", glow: "#224" },
  wall: { glyph: "#", fg: "#99a", glow: "#667" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7" },
  gold: { glyph: "$", fg: "#ffde5a", glow: "#fc6" },
  // Potions
  potion_health: { glyph: "🧪", fg: "#66ff99", glow: "#5cff9a" },
  // Spellbooks
  spellbook_fire: { glyph: "📕", fg: "#ff704d", glow: "#ff704d" },
  spellbook_ice: { glyph: "📘", fg: "#4da6ff", glow: "#4da6ff" },
  spellbook_lightning: { glyph: "📓", fg: "#ffff66", glow: "#ffff66" },
  // Alias to match rules identity so it renders on the ground
  book_lightning: { glyph: "📓", fg: "#ffff66", glow: "#ffff66" },
  spellbook_dark: { glyph: "📙", fg: "#b366ff", glow: "#b366ff" },
  spellbook_healing: { glyph: "📒", fg: "#66ff99", glow: "#66ff99" },
  spellbook_summoning: { glyph: "📓", fg: "#ff66ff", glow: "#ff66ff" },
  spellbook_earth: { glyph: "📔", fg: "#cc9966", glow: "#cc9966" },

  // Fallback
  default: { glyph: "•", fg: "#cfe8ff", glow: "#6cf" }
};
