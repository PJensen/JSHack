// display/palette/base.js
// Base palette for tiles, actors, and common symbols (display-only)

export const basePalette = {
  // Actors
  player: { glyph: "@", fg: "#e8f7ff", glow: "#6cf" },
  monster: { glyph: "m", fg: "#ffb0a0", glow: "#f66" },  // fallback
  // Tier 0
  rat:      { glyph: "r", fg: "#b89070", glow: "#a06030" },
  goblin:   { glyph: "g", fg: "#7ecc5a", glow: "#4a9030" },
  bat:      { glyph: "b", fg: "#9080b0", glow: "#605080" },
  grid_bug: { glyph: "x", fg: "#bb66ff", glow: "#44ccff" },
  // Tier 1
  orc:      { glyph: "o", fg: "#cc6644", glow: "#993320" },
  skeleton: { glyph: "s", fg: "#ddd8c8", glow: "#aaa590" },
  spider:   { glyph: "x", fg: "#55bb55", glow: "#338833" },
  // Tier 2
  troll:    { glyph: "T", fg: "#66aa66", glow: "#448844" },
  wraith:   { glyph: "W", fg: "#aabbff", glow: "#7799dd" },
  ogre:     { glyph: "O", fg: "#cc9966", glow: "#996633" },
  floating_eye: { glyph: "e", fg: "#dd55ff", glow: "#9922cc" },
  // Tier 3
  demon:    { glyph: "&", fg: "#ff4444", glow: "#cc0000" },
  dragon:   { glyph: "D", fg: "#ffcc33", glow: "#dd9900" },
  lich:     { glyph: "L", fg: "#cc88ff", glow: "#9955cc" },
  // Tiles
  floor: { glyph: ".", fg: "#446", glow: "#224" },
  wall: { glyph: "#", fg: "#99a", glow: "#667" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7" },
  stair_down: { glyph: ">", fg: "#ccc", glow: "#888" },
  stair_up:   { glyph: "<", fg: "#ccc", glow: "#888" },
  gold: { glyph: "$", fg: "#ffde5a", glow: "#fc6" },
  // Potions
  potion_health: { glyph: "🧪", fg: "#66ff99", glow: "#5cff9a" },
  // Spellbooks
  spellbook_fire: { glyph: "📕", fg: "#ff704d", glow: "#ff704d" },
  spellbook_ice: { glyph: "📘", fg: "#4da6ff", glow: "#4da6ff" },
  spellbook_lightning: { glyph: "📓", fg: "#ffff66", glow: "#ffff66" },
  // Scrolls
  scroll_mapping: { glyph: "?", fg: "#eeddaa", glow: "#ccbb88" },
  scroll_blastwave: { glyph: "?", fg: "#ffa333", glow: "#dd8811" },
  // Aliases to match rules identity so they render on the ground
  book_lightning: { glyph: "📓", fg: "#ffff66", glow: "#ffff66" },
  book_meteor: { glyph: "📕", fg: "#ff704d", glow: "#ff704d" },
  book_blastwave: { glyph: "📙", fg: "#ffa333", glow: "#ffa333" },
  spellbook_dark: { glyph: "📙", fg: "#b366ff", glow: "#b366ff" },
  spellbook_healing: { glyph: "📒", fg: "#66ff99", glow: "#66ff99" },
  spellbook_summoning: { glyph: "📓", fg: "#ff66ff", glow: "#ff66ff" },
  spellbook_earth: { glyph: "📔", fg: "#cc9966", glow: "#cc9966" },

  // Ammo
  ammo_arrows: { glyph: "/", fg: "#c4a46c", glow: "#a08050" },
  ammo_fire_arrows: { glyph: "/", fg: "#ff6a33", glow: "#ff4400" },

  // Pets
  kitty: { glyph: "f", fg: "#ffcc88", glow: "#cc9955" },

  // NPCs
  shopkeeper: { glyph: "@", fg: "#c47bff", glow: "#9955cc" },

  // Containers
  chest: { glyph: "]", fg: "#c8a050", glow: "#a07830" },

  // Tombstones (player death markers)
  tombstone: { glyph: "†", fg: "#888888", glow: "#444444" },

  // Traps (revealed after triggering)
  trap_spike: { glyph: "^", fg: "#a84000", glow: "#d65d1f" },
  trap_snake: { glyph: "^", fg: "#55aa44", glow: "#338822" },
  // Tier 0 (snake — spawned by snake traps)
  snake:    { glyph: "S", fg: "#55aa44", glow: "#338822" },

  // Spawners (monster nests)
  spawner: { glyph: "%", fg: "#8b4513", glow: "#663311" },

  // Food & Rations
  food_ration:      { glyph: "%", fg: "#c4a46c", glow: "#a08050" },
  food_iron_ration: { glyph: "%", fg: "#d4b87c", glow: "#b09860" },

  // Corpses (inherit monster color, traditional '%' glyph)
  corpse_rat:          { glyph: "%", fg: "#b89070", glow: "#a06030" },
  corpse_goblin:       { glyph: "%", fg: "#7ecc5a", glow: "#4a9030" },
  corpse_bat:          { glyph: "%", fg: "#9080b0", glow: "#605080" },
  corpse_grid_bug:     { glyph: "%", fg: "#bb66ff", glow: "#44ccff" },
  corpse_snake:        { glyph: "%", fg: "#55aa44", glow: "#338822" },
  corpse_orc:          { glyph: "%", fg: "#cc6644", glow: "#993320" },
  corpse_skeleton:     { glyph: "%", fg: "#ddd8c8", glow: "#aaa590" },
  corpse_spider:       { glyph: "%", fg: "#55bb55", glow: "#338833" },
  corpse_troll:        { glyph: "%", fg: "#66aa66", glow: "#448844" },
  corpse_wraith:       { glyph: "%", fg: "#aabbff", glow: "#7799dd" },
  corpse_ogre:         { glyph: "%", fg: "#cc9966", glow: "#996633" },
  corpse_floating_eye: { glyph: "%", fg: "#dd55ff", glow: "#9922cc" },
  corpse_demon:        { glyph: "%", fg: "#ff4444", glow: "#cc0000" },
  corpse_dragon:       { glyph: "%", fg: "#ffcc33", glow: "#dd9900" },
  corpse_lich:         { glyph: "%", fg: "#cc88ff", glow: "#9955cc" },

  // Engravings
  engraving: { glyph: "~", fg: "#8899aa", glow: "#556677" },

  // Fallback
  default: { glyph: "•", fg: "#cfe8ff", glow: "#6cf" }
};
