// display/palette/base.js
// Base palette for tiles, actors, and common symbols (display-only)

export const basePalette = {
  // Actors
  player:         { glyph: "@", fg: "#e8f7ff", glow: "#6cf" },
  player_druid:   { glyph: "@", fg: "#7ecc5a", glow: "#4a9030" },
  player_warden:  { glyph: "@", fg: "#e85050", glow: "#a03030" },
  player_outlaw:  { glyph: "@", fg: "#d4a0ff", glow: "#9060cc" },
  player_cleric:  { glyph: "@", fg: "#ffe066", glow: "#cca830" },
  player_archeologist: { glyph: "@", fg: "#d2a064", glow: "#8a6030" },
  player_warlock:  { glyph: "@", fg: "#b366ff", glow: "#8833cc" },
  monster: { glyph: "m", fg: "#ffb0a0", glow: "#f66" },  // fallback
  // Tier 0
  rat:      { glyph: "r", fg: "#b89070", glow: "#a06030" }, // 🐀
  goblin:   { glyph: "g", fg: "#7ecc5a", glow: "#4a9030" },
  bat:      { glyph: "b", fg: "#9080b0", glow: "#605080" }, // 🦇
  grid_bug: { glyph: "x", fg: "#bb66ff", glow: "#44ccff" },
  cave_snake: { glyph: "S", fg: "#88aa66", glow: "#667744" },
  cave_spider: { glyph: "x", fg: "#88bb88", glow: "#558855" },
  floating_eye: { glyph: "e", fg: "#dd55ff", glow: "#9922cc" },
  pit_viper: { glyph: "S", fg: "#44dd44", glow: "#22aa22" },
  skeleton_archer: { glyph: "s", fg: "#c8c4b0", glow: "#908870" },
  // Tier 1
  bone_bowman: { glyph: "s", fg: "#d8d4c0", glow: "#a8a490" },
  orc:      { glyph: "o", fg: "#cc6644", glow: "#993320" },
  skeleton: { glyph: "s", fg: "#ddd8c8", glow: "#aaa590" }, // 💀
  spider:   { glyph: "x", fg: "#55bb55", glow: "#338833" }, // 🕷
  // Tier 2
  skeletal_marksman: { glyph: "s", fg: "#e0c8a0", glow: "#b89060" },
  skeleton_sharpshooter: { glyph: "s", fg: "#c0bca8", glow: "#807c68" },
  troll:    { glyph: "T", fg: "#66aa66", glow: "#448844" },
  wraith:   { glyph: "W", fg: "#aabbff", glow: "#7799dd" },
  ogre:     { glyph: "O", fg: "#cc9966", glow: "#996633" },
  // Tier 3
  death_archer: { glyph: "s", fg: "#a0a8b0", glow: "#6070a0" },
  demon:    { glyph: "&", fg: "#ff4444", glow: "#cc0000" },
  dragon:   { glyph: "D", fg: "#ffcc33", glow: "#dd9900" },
  lich:     { glyph: "L", fg: "#cc88ff", glow: "#9955cc" },
  mimic:    { glyph: "M", fg: "#b07a3f", glow: "#7a4d1f" },
  // Tiles
  floor: { glyph: ".", fg: "#446", glow: "#224" },
  grass_a:  { glyph: "'", fg: "#cce07a", glow: "#8ab850" },  // sparse/bare
  grass:    { glyph: ",", fg: "#90c858", glow: "#5a9038" },  // light
  grass_c:  { glyph: ";", fg: "#6aaa42", glow: "#447828" },  // medium
  grass_d:  { glyph: "`", fg: "#94c04e", glow: "#5a8030" },  // thick/lush
  water:      { glyph: "~", fg: "#5ea8d4", glow: "#3a6a90" },  // shallow
  water_deep: { glyph: "≈", fg: "#3a6fa0", glow: "#1e3f60" },  // open/deep
  mountain:   { glyph: "⛰", fg: "#9da0a4", glow: "#5a5d61" },  // foothills
  mountain_b: { glyph: "∧", fg: "#bec1c4", glow: "#6e7174" },  // mid-peak
  mountain_c: { glyph: "▲", fg: "#e0e3e6", glow: "#969ea4" },  // high-peak
  tree: { glyph: "🌲", fg: "#3f7b3d", glow: "#275026" },
  wall: { glyph: "#", fg: "#99a", glow: "#667" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7" },
  stair_down: { glyph: ">", fg: "#ccc", glow: "#888" },
  stair_up:   { glyph: "<", fg: "#ccc", glow: "#888" },
  gold: { glyph: "$", fg: "#ffde5a", glow: "#fc6" },
  // Potions
  potion:             { glyph: "!", fg: "#8fd7ff", glow: "#6bc7ff" },
  potion_health:      { glyph: "!", fg: "#66ff99", glow: "#5cff9a" },
  potion_vigor:       { glyph: "!", fg: "#ff4466", glow: "#cc2244" },
  potion_endurance:   { glyph: "!", fg: "#ffcc33", glow: "#cc9900" },
  potion_second_wind: { glyph: "!", fg: "#44ddee", glow: "#22aacc" },
  potion_adrenaline:  { glyph: "!", fg: "#ff8822", glow: "#cc5500" },
  potion_mana:        { glyph: "!", fg: "#6fa7ff", glow: "#4872d1" },
  potion_poison:      { glyph: "!", fg: "#84d26d", glow: "#4a8f3f" },
  potion_water:       { glyph: "!", fg: "#8fd7ff", glow: "#4f97be" },
  potion_holy_water:  { glyph: "!", fg: "#fff2b0", glow: "#d7b457" },
  potion_stoneskin:   { glyph: "!", fg: "#b0b3be", glow: "#6f7485" },
  potion_resist_fire:     { glyph: "!", fg: "#ff9a5c", glow: "#cc5a2e" },
  potion_resist_poison:   { glyph: "!", fg: "#9bdc7a", glow: "#6ca84f" },
  potion_anti_venom:      { glyph: "!", fg: "#c2f28d", glow: "#7eb34a" },
  potion_resist_electric: { glyph: "!", fg: "#8fd0f2", glow: "#5d97b7" },
  potion_resist_acid:     { glyph: "!", fg: "#d4f06c", glow: "#94b33f" },
  potion_sickness:        { glyph: "!", fg: "#b89a66", glow: "#7d6440" },
  // Spellbooks
  spellbook_fire: { glyph: "📕", fg: "#ff704d", glow: "#ff704d" },
  spellbook_ice: { glyph: "📘", fg: "#4da6ff", glow: "#4da6ff" },
  spellbook_lightning: { glyph: "📓", fg: "#ffff66", glow: "#ffff66" },
  // Scrolls
  scroll_mapping: { glyph: "?", fg: "#eeddaa", glow: "#ccbb88" },
  scroll_blastwave: { glyph: "?", fg: "#ffa333", glow: "#dd8811" },
  scroll_homecoming: { glyph: "?", fg: "#9fe8ff", glow: "#62b7d5" },
  return_portal: { glyph: "O", fg: "#7bd6ff", glow: "#3f98bb" },
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
  familiar: { glyph: "f", fg: "#b366ff", glow: "#8833cc" },

  // NPCs
  shopkeeper: { glyph: "@", fg: "#c47bff", glow: "#9955cc" },

  // Containers
  chest: { glyph: "]", fg: "#c8a050", glow: "#a07830" },
  bed_home: { glyph: "=", fg: "#9fc4d6", glow: "#5c7f90" },
  house_sign: { glyph: "!", fg: "#d8c08a", glow: "#8b6f3f" },
  alchemy_bench: { glyph: "⚗", fg: "#93def6", glow: "#4f7fa1" },
  berry_bush: { glyph: "❀", fg: "#8b4ea9", glow: "#5a2d75" },
  herb_patch: { glyph: "✿", fg: "#63a85f", glow: "#3e6b3c" },
  thorn_bramble: { glyph: "☘", fg: "#7ea157", glow: "#415b2e" },
  venom_fern: { glyph: "☣", fg: "#a5d95c", glow: "#648431" },
  venom_spores: { glyph: "◌", fg: "#9dd46f", glow: "#5f8d3c" },
  // Mining nodes
  ore_vein_iron:  { glyph: "◈", fg: "#c0754a", glow: "#8a3e1e" },
  ore_vein_coal:  { glyph: "◆", fg: "#3a3a3a", glow: "#1a1a1a" },
  ore_vein_stone: { glyph: "◇", fg: "#8a8e93", glow: "#555a5e" },
  // Crafting stations
  anvil:        { glyph: "⚒", fg: "#9aacba", glow: "#4a6070" },
  furnace:       { glyph: "🫕", fg: "#ff8533", glow: "#cc4400" },
  furnace_unlit: { glyph: "🫕", fg: "#8a6040", glow: "#553320" },
  cooking_fire: { glyph: "♨", fg: "#ff9944", glow: "#dd5500" },

  // Room features
  fountain:    { glyph: "⛲", fg: "#66bbee", glow: "#3388aa" },
  altar:       { glyph: "⛩", fg: "#cc99ff", glow: "#9966cc" },
  shrine:      { glyph: "⛫", fg: "#ffdd66", glow: "#ccaa33" },
  statue:      { glyph: "🗿", fg: "#ccccdd", glow: "#9999ab" },
  sarcophagus: { glyph: "⚰", fg: "#aaa8a0", glow: "#777570" },
  pillar:      { glyph: "╥", fg: "#99a",    glow: "#667"    },
  weapon_rack: { glyph: "⚔", fg: "#bbbbcc", glow: "#888899" },
  mushrooms:   { glyph: "🍄", fg: "#88cc88", glow: "#558855" },
  web:         { glyph: "🕸", fg: "#c8c8c8", glow: "#888888" },
  torch:       { glyph: "🕯", fg: "#ffaa44", glow: "#ff6600" },
  urn:         { glyph: "⚱", fg: "#c8a060", glow: "#8a6030" },

  // Tombstones (player death markers)
  tombstone: { glyph: "†", fg: "#888888", glow: "#444444" },

  // Decorative dungeon books
  book_kitty:      { glyph: "📖", fg: "#ffcc88", glow: "#cc9955" },
  book_snakes:     { glyph: "📖", fg: "#55aa44", glow: "#338822" },
  book_spikes:     { glyph: "📖", fg: "#a84000", glow: "#d65d1f" },
  book_touchstone: { glyph: "📖", fg: "#aaaaaa", glow: "#888888" },
  book_corpses:    { glyph: "📖", fg: "#b89070", glow: "#a06030" },
  book_gridbugs:   { glyph: "📖", fg: "#bb66ff", glow: "#44ccff" },

  // Traps (revealed after triggering)
  trap_spike: { glyph: "^", fg: "#a84000", glow: "#d65d1f" },
  trap_snake: { glyph: "^", fg: "#55aa44", glow: "#338822" },
  trap_shock: { glyph: "^", fg: "#66ddff", glow: "#2299cc" },
  // Tier 0 (snake — spawned by snake traps)
  snake:    { glyph: "S", fg: "#55aa44", glow: "#338822" },

  // Spawners (monster nests)
  spawner: { glyph: "◍", fg: "#8b4513", glow: "#663311" },

  // Food & Rations
  food_ration:      { glyph: "%", fg: "#c4a46c", glow: "#a08050" },
  food_iron_ration: { glyph: "%", fg: "#d4b87c", glow: "#b09860" },
  food_wild_berries: { glyph: ":", fg: "#b476d7", glow: "#7a4c96" },
  food_wild_herbs:   { glyph: ";", fg: "#73c56f", glow: "#4f8b4c" },
  food_mushrooms:    { glyph: "🍄", fg: "#c8b898", glow: "#8a7a5a" },
  reagent_thorn_pod: { glyph: "✶", fg: "#a08f63", glow: "#6f6242" },
  reagent_venom_frond: { glyph: "☤", fg: "#9ccc69", glow: "#5f8d3c" },
  // Ore items (dropped from mining nodes)
  ore_iron:  { glyph: "≡", fg: "#b86840", glow: "#7a3a18" },
  ore_coal:  { glyph: "■", fg: "#404040", glow: "#202020" },
  ore_stone: { glyph: "▪", fg: "#878b90", glow: "#50565c" },

  // Corpses: auto-generated by buildPalette() — all monsters inherit their fg/glow with '%' glyph.
  bone:                { glyph: "(", fg: "#e8e4d4", glow: "#b0a890" },
  ashes:               { glyph: "∴", fg: "#888888", glow: "#555555" },
  corpse_pet:          { glyph: "%", fg: "#ffcc88", glow: "#cc9955" }, // fallback for pets without a monster def

  // Engravings
  engraving: { glyph: "~", fg: "#8899aa", glow: "#556677" },

  // ── Gems (gemstones) ────────────────────────────────────────────
  gem_dilithium:   { glyph: "*", fg: "#ffffff", glow: "#ccccff" },
  gem_diamond:     { glyph: "*", fg: "#ffffff", glow: "#eeeeff" },
  gem_ruby:        { glyph: "*", fg: "#ff3333", glow: "#cc1111" },
  gem_jacinth:     { glyph: "*", fg: "#ff8833", glow: "#dd6611" },
  gem_sapphire:    { glyph: "*", fg: "#3366ff", glow: "#2244cc" },
  gem_black_opal:  { glyph: "*", fg: "#333344", glow: "#5555aa" },
  gem_emerald:     { glyph: "*", fg: "#33dd33", glow: "#22aa22" },
  gem_turquoise:   { glyph: "*", fg: "#44ccaa", glow: "#339988" },
  gem_citrine:     { glyph: "*", fg: "#ffee44", glow: "#ddcc22" },
  gem_aquamarine:  { glyph: "*", fg: "#44ddff", glow: "#22bbdd" },
  gem_amber:       { glyph: "*", fg: "#cc8833", glow: "#aa6622" },
  gem_topaz:       { glyph: "*", fg: "#cc9933", glow: "#aa7722" },
  gem_jet:         { glyph: "*", fg: "#222233", glow: "#444466" },
  gem_opal:        { glyph: "*", fg: "#eeddff", glow: "#ccbbdd" },
  gem_chrysoberyl: { glyph: "*", fg: "#dddd44", glow: "#bbbb22" },
  gem_garnet:      { glyph: "*", fg: "#cc3344", glow: "#aa2233" },
  gem_amethyst:    { glyph: "*", fg: "#aa44ff", glow: "#8822dd" },
  gem_jasper:      { glyph: "*", fg: "#cc4433", glow: "#aa3322" },
  gem_fluorite:    { glyph: "*", fg: "#88ff88", glow: "#66dd66" },
  gem_jade:        { glyph: "*", fg: "#55bb55", glow: "#449944" },
  gem_obsidian:    { glyph: "*", fg: "#222222", glow: "#555577" },
  gem_agate:       { glyph: "*", fg: "#ee8844", glow: "#cc6633" },

  // ── Worthless glass ─────────────────────────────────────────────
  glass_white:     { glyph: "*", fg: "#dddddd", glow: "#aaaaaa" },
  glass_blue:      { glyph: "*", fg: "#3366dd", glow: "#2244aa" },
  glass_red:       { glyph: "*", fg: "#dd3333", glow: "#aa1111" },
  glass_brown:     { glyph: "*", fg: "#aa7733", glow: "#885522" },
  glass_orange:    { glyph: "*", fg: "#dd7733", glow: "#bb5522" },
  glass_yellow:    { glyph: "*", fg: "#dddd33", glow: "#bbbb22" },
  glass_black:     { glyph: "*", fg: "#333333", glow: "#555555" },
  glass_green:     { glyph: "*", fg: "#33bb33", glow: "#229922" },
  glass_violet:    { glyph: "*", fg: "#9933dd", glow: "#7722bb" },

  // ── Gray stones & rocks ─────────────────────────────────────────
  stone_luckstone:  { glyph: "`", fg: "#999999", glow: "#777777" },
  stone_loadstone:  { glyph: "`", fg: "#888888", glow: "#666666" },
  stone_touchstone: { glyph: "`", fg: "#aaaaaa", glow: "#888888" },
  stone_flint:      { glyph: "`", fg: "#777777", glow: "#555555" },
  stone_rock:       { glyph: "`", fg: "#666666", glow: "#444444" },

  // Fallback
  default: { glyph: "•", fg: "#cfe8ff", glow: "#6cf" }
};
