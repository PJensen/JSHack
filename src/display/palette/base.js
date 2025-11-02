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
  // Fallback
  default: { glyph: "•", fg: "#cfe8ff", glow: "#6cf" }
};
