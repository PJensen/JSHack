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
  goblin_archer: { glyph: "g", fg: "#5eaa3a", glow: "#3a7020" },
  bat:      { glyph: "b", fg: "#9080b0", glow: "#605080" }, // 🦇
  grid_bug: { glyph: "x", fg: "#bb66ff", glow: "#44ccff" },
  cave_snake: { glyph: "S", fg: "#88aa66", glow: "#667744" },
  cave_spider: { glyph: "x", fg: "#88bb88", glow: "#558855" },
  floating_eye: { glyph: "e", fg: "#dd55ff", glow: "#9922cc" },
  centipede: { glyph: "c", fg: "#cc7744", glow: "#884422" },
  pit_viper: { glyph: "S", fg: "#44dd44", glow: "#22aa22" },
  dragon_whelp: { glyph: "D", fg: "#ff8a2b", glow: "#ff5a12" },
  cave_bear: { glyph: "B", fg: "#8b6040", glow: "#5a3a20" },
  skeleton_archer: { glyph: "s", fg: "#c8c4b0", glow: "#908870" },
  kobold_shaman: { glyph: "k", fg: "#ffdd44", glow: "#ccaa22" },
  // Tier 1
  bone_bowman: { glyph: "s", fg: "#d8d4c0", glow: "#a8a490" },
  orc:      { glyph: "o", fg: "#cc6644", glow: "#993320" },
  orc_shaman: { glyph: "o", fg: "#88bbdd", glow: "#557799" },
  hobgoblin: { glyph: "H", fg: "#cc8844", glow: "#995522" },
  phase_spider: { glyph: "x", fg: "#aa66dd", glow: "#7733aa" },
  wight:    { glyph: "w", fg: "#88aacc", glow: "#557799" },
  skeleton: { glyph: "s", fg: "#ddd8c8", glow: "#aaa590" }, // 💀
  spider:   { glyph: "x", fg: "#55bb55", glow: "#338833" }, // 🕷
  // Tier 2
  dark_acolyte: { glyph: "p", fg: "#9966cc", glow: "#663399" },
  orc_warchief: { glyph: "O", fg: "#dd6644", glow: "#aa3322" },
  skeletal_shadow_caster: { glyph: "s", fg: "#a088c8", glow: "#6a5098" },
  carrion_shade: { glyph: "C", fg: "#886688", glow: "#553355" },
  skeletal_marksman: { glyph: "s", fg: "#e0c8a0", glow: "#b89060" },
  skeletal_agony_warlock: { glyph: "s", fg: "#b88ccf", glow: "#7a4f9a" },
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
  lichen:       { glyph: "F", fg: "#88aa66", glow: "#557744" },
  nymph:        { glyph: "n", fg: "#88ddaa", glow: "#55aa77" },
  rust_monster: { glyph: "R", fg: "#cc7744", glow: "#884422" },
  stone_taunter: { glyph: "G", fg: "#aaa8a0", glow: "#706e66" },
  // Tiles
  floor: { glyph: ".", fg: "#446", glow: "#224", bg: "#1a1c28" },
  grass_a:  { glyph: "'", fg: "#cce07a", glow: "#8ab850", bg: "#2a3a1a" },  // sparse/bare
  grass:    { glyph: ",", fg: "#90c858", glow: "#5a9038", bg: "#1e3214" },  // light
  grass_c:  { glyph: ";", fg: "#6aaa42", glow: "#447828", bg: "#182c10" },  // medium
  grass_d:  { glyph: "`", fg: "#94c04e", glow: "#5a8030", bg: "#223616" },  // thick/lush
  water:      { glyph: "~", fg: "#5ea8d4", glow: "#3a6a90", bg: "#0e2a3a" },  // shallow
  water_deep: { glyph: "≈", fg: "#3a6fa0", glow: "#1e3f60", bg: "#0a1828" },  // open/deep
  lava:       { glyph: "≈", fg: "#ff8b36", glow: "#8f2e10", bg: "#3a1008" },
  mountain:   { glyph: "⛰", fg: "#9da0a4", glow: "#5a5d61", bg: "#2a2c2e" },  // foothills
  mountain_b: { glyph: "∧", fg: "#bec1c4", glow: "#6e7174", bg: "#343638" },  // mid-peak
  mountain_c: { glyph: "▲", fg: "#e0e3e6", glow: "#969ea4", bg: "#3e4042" },  // high-peak
  tree: { glyph: "🌲", fg: "#3f7b3d", glow: "#275026", bg: "#142610" },
  farmland:  { glyph: "░", fg: "#8b7355", glow: "#5a4a38", bg: "#302818" },
  fence:     { glyph: "f", fg: "#a08050", glow: "#6b5530", bg: "#1e3214" },
  roof_thatch_shadow: { glyph: "▓", fg: "#9c7f2c", glow: "#6b5418", bg: "#4a3c14" },
  roof_thatch_lit:    { glyph: "▓", fg: "#d8bf5a", glow: "#9d8221", bg: "#6b5418" },
  roof_thatch_shadow_charred: { glyph: "▓", fg: "#6c5530", glow: "#3b2410", bg: "#3a2a14" },
  roof_thatch_lit_charred:    { glyph: "▓", fg: "#b98642", glow: "#6f3210", bg: "#5a3c18" },
  wall: { glyph: "#", fg: "#99a", glow: "#667", bg: "#222328" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7", bg: "#1a1c28" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7", bg: "#1a1c28" },
  stair_down: { glyph: ">", fg: "#ccc", glow: "#888", bg: "#1a1c28" },
  stair_up:   { glyph: "<", fg: "#ccc", glow: "#888", bg: "#1a1c28" },
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
  potion_paralysis:       { glyph: "!", fg: "#ccaa88", glow: "#997744" },
  potion_hallucination:   { glyph: "!", fg: "#dd77dd", glow: "#aa44aa" },
  potion_blindness:       { glyph: "!", fg: "#555566", glow: "#333344" },
  potion_weakness:        { glyph: "!", fg: "#99887a", glow: "#665544" },
  potion_confusion:       { glyph: "!", fg: "#ddaa55", glow: "#aa7722" },
  // Spellbooks
  spellbook_fire: { glyph: "?", fg: "#ff704d", glow: "#ff704d" },
  spellbook_ice: { glyph: "?", fg: "#4da6ff", glow: "#4da6ff" },
  spellbook_lightning: { glyph: "?", fg: "#ffff66", glow: "#ffff66" },
  // Scrolls
  scroll_mapping: { glyph: "?", fg: "#eeddaa", glow: "#ccbb88" },
  scroll_blastwave: { glyph: "?", fg: "#ffa333", glow: "#dd8811" },
  scroll_homecoming: { glyph: "?", fg: "#9fe8ff", glow: "#62b7d5" },
  scroll_heal: { glyph: "?", fg: "#66ff99", glow: "#44bb66" },
  scroll_summon_skeleton: { glyph: "?", fg: "#ddd8c8", glow: "#aaa590" },
  scroll_identify: { glyph: "?", fg: "#ccddff", glow: "#99aacc" },
  scroll_remove_curse: { glyph: "?", fg: "#ffe066", glow: "#ccb844" },
  scroll_amnesia: { glyph: "?", fg: "#bb77dd", glow: "#8844aa" },
  scroll_cursing: { glyph: "?", fg: "#884444", glow: "#662222" },
  scroll_summoning: { glyph: "?", fg: "#ff66ff", glow: "#cc33cc" },
  scroll_decay: { glyph: "?", fg: "#8a7a5a", glow: "#5a4a32" },
  scroll_fire: { glyph: "?", fg: "#ff4444", glow: "#cc0000" },
  scroll_aggravation: { glyph: "?", fg: "#ff6655", glow: "#cc3322" },
  scroll_genocide: { glyph: "?", fg: "#cc2244", glow: "#991133" },
  scroll_teleportation: { glyph: "?", fg: "#66eeff", glow: "#33bbcc" },
  scroll_polymorph: { glyph: "?", fg: "#dd77ff", glow: "#aa44cc" },
  return_portal: { glyph: "O", fg: "#7bd6ff", glow: "#3f98bb" },
  // Aliases to match rules identity so they render on the ground
  book_lightning: { glyph: "?", fg: "#ffff66", glow: "#ffff66" },
  book_meteor: { glyph: "?", fg: "#ff704d", glow: "#ff704d" },
  book_blastwave: { glyph: "?", fg: "#ffa333", glow: "#ffa333" },
  book_frost: { glyph: "?", fg: "#4da6ff", glow: "#4da6ff" },
  book_blizzard: { glyph: "?", fg: "#8fd6ff", glow: "#8fd6ff" },
  book_firestorm: { glyph: "?", fg: "#ff8a3d", glow: "#ff8a3d" },
  spellbook_dark: { glyph: "?", fg: "#b366ff", glow: "#b366ff" },
  spellbook_healing: { glyph: "?", fg: "#66ff99", glow: "#66ff99" },
  spellbook_summoning: { glyph: "?", fg: "#ff66ff", glow: "#ff66ff" },
  spellbook_earth: { glyph: "?", fg: "#cc9966", glow: "#cc9966" },
  book_blink: { glyph: "?", fg: "#66eeff", glow: "#33bbcc" },
  book_earthshatter: { glyph: "?", fg: "#cc9966", glow: "#996633" },
  book_heal: { glyph: "?", fg: "#66ff99", glow: "#44bb66" },
  book_blind: { glyph: "?", fg: "#9966cc", glow: "#663399" },
  book_verdant_ward: { glyph: "⁂", fg: "#9ee486", glow: "#5ca94a" },
  book_harmony_ward: { glyph: "☯", fg: "#d8d38a", glow: "#7aa8e0" },
  book_shadow_veil: { glyph: "⌇", fg: "#b78cff", glow: "#6b4ab2" },
  book_flash_heal:      { glyph: "?", fg: "#ffffff", glow: "#cceecc" },
  book_smite:           { glyph: "?", fg: "#ffe080", glow: "#ccaa40" },
  book_summon_skeleton: { glyph: "?", fg: "#c8c8ff", glow: "#8888cc" },
  book_shadow_bolt:     { glyph: "?", fg: "#cc66ff", glow: "#8833cc" },
  book_agony:           { glyph: "?", fg: "#aa33cc", glow: "#660088" },
  book_drain_life:      { glyph: "?", fg: "#e05a76", glow: "#8b2538" },
  book_rampage:         { glyph: "?", fg: "#ff4444", glow: "#cc2222" },
  book_phase_strike:    { glyph: "?", fg: "#66ccff", glow: "#2299cc" },
  book_scorch:          { glyph: "?", fg: "#ff7700", glow: "#cc4400" },
  book_homecoming:      { glyph: "?", fg: "#88aaff", glow: "#4466cc" },
  book_hearthstone:     { glyph: "?", fg: "#bb8855", glow: "#885522" },
  book_dead: { glyph: "?", fg: "#888888", glow: "#555555" },

  // Wands
  wand_lightning: { glyph: "/", fg: "#ffff66", glow: "#cccc33" },
  wand_meteor: { glyph: "/", fg: "#ff704d", glow: "#cc3322" },
  wand_frost: { glyph: "/", fg: "#4da6ff", glow: "#2277cc" },
  wand_heal: { glyph: "/", fg: "#66ff99", glow: "#44bb66" },

  // Ammo
  ammo_arrows: { glyph: "/", fg: "#c4a46c", glow: "#a08050" },
  ammo_fire_arrows: { glyph: "/", fg: "#ff6a33", glow: "#ff4400" },
  ammo_piercing_arrows: { glyph: "/", fg: "#bfc8d6", glow: "#6d7685" },
  ammo_bodkin_arrows: { glyph: "/", fg: "#d0d4db", glow: "#8b929d" },
  ammo_blunt_arrows: { glyph: "/", fg: "#b89b72", glow: "#8f6f45" },

  // Pets
  kitty: { glyph: "f", fg: "#ffcc88", glow: "#cc9955" },
  familiar: { glyph: "f", fg: "#b366ff", glow: "#8833cc" },

  // NPCs
  shopkeeper:          { glyph: "@", fg: "#c47bff", glow: "#9955cc" },
  townfolk_farmer:     { glyph: "@", fg: "#8bc34a", glow: "#558b2f" },
  townfolk_woodcutter: { glyph: "@", fg: "#a1887f", glow: "#6d4c41" },
  townfolk_miner:      { glyph: "@", fg: "#90a4ae", glow: "#546e7a" },
  townfolk_smith:      { glyph: "@", fg: "#ff8a65", glow: "#d84315" },
  townfolk_priest:     { glyph: "@", fg: "#ce93d8", glow: "#8e24aa" },
  townfolk_barkeep:    { glyph: "@", fg: "#ffb74d", glow: "#e65100" },
  townfolk_villager:   { glyph: "@", fg: "#a5d6a7", glow: "#388e3c" },
  townfolk_mason:      { glyph: "@", fg: "#bcaaa4", glow: "#795548" },
  townfolk_herbalist:  { glyph: "@", fg: "#81c784", glow: "#2e7d32" },
  townfolk_alchemist:  { glyph: "@", fg: "#80deea", glow: "#00838f" },
  townfolk_gem_vendor: { glyph: "@", fg: "#8fdcff", glow: "#3ea0d4" },
  townfolk_book_vendor: { glyph: "@", fg: "#d4a76a", glow: "#8b6914" },

  // Containers
  chest:            { glyph: "]", fg: "#c8a050", glow: "#a07830" },
  basic_chest:      { glyph: "]", fg: "#c8a050", glow: "#a07830" },
  magic_chest:      { glyph: "]", fg: "#b070e8", glow: "#7030c0" },
  epic_chest:       { glyph: "]", fg: "#d672ff", glow: "#9a42c7" },
  legendary_chest:  { glyph: "]", fg: "#ffd040", glow: "#e08010" },
  mill_chest:      { glyph: "]", fg: "#d9b55a", glow: "#9f6c1d" },
  smithy_chest:    { glyph: "]", fg: "#caa27a", glow: "#8a5e34" },
  lumber_chest:    { glyph: "]", fg: "#b88752", glow: "#7c4f22" },
  bed_home: {
    layers: [
      { glyph: "▬", fg: "#7b6345", glow: "#5a4a3a" },                           // frame
      { glyph: "▪", fg: "#d4c9b0", glow: "#a09080", dx: -0.14, dy: -0.06, scale: 0.5 }, // pillow
    ]
  },
  house_sign: { glyph: "!", fg: "#d8c08a", glow: "#8b6f3f" },
  alchemy_bench: { glyph: "⚗", fg: "#93def6", glow: "#4f7fa1" },
  potion_shelf:  { glyph: "=", fg: "#7986cb", glow: "#3949ab" },
  herb_chest:    { glyph: "]", fg: "#66bb6a", glow: "#2e7d32" },
  tavern_chest:   { glyph: "]", fg: "#d7a15d", glow: "#8f5225" },
  apothecary_sign: { glyph: "⚗", fg: "#b39ddb", glow: "#7e57c2" },
  gem_shop_sign: { glyph: "💎", fg: "#bdefff", glow: "#68bde2" },
  book_shop_sign: { glyph: "📖", fg: "#d4a76a", glow: "#8b6914" },
  gem_display_case: { glyph: "◇", fg: "#d7f3ff", glow: "#75b8d2" },
  message_board: { glyph: "🪧", fg: "#d8c08a", glow: "#8b6f3f" },
  berry_bush: { glyph: "❀", fg: "#8b4ea9", glow: "#5a2d75" },
  herb_patch: { glyph: "✿", fg: "#63a85f", glow: "#3e6b3c" },
  thorn_bramble: { glyph: "☘", fg: "#7ea157", glow: "#415b2e" },
  venom_fern: { glyph: "☣", fg: "#a5d95c", glow: "#648431" },
  moonleaf_cluster: {
    layers: [
    { glyph: ")", fg: "#0f3e36", glow: "#aaaaaa", dx: 0.03, dy: 0.4, scale: 0.45 },
    { glyph: "✺", fg: "#165f8d", glow: "#aaaaaa", dx: -0.01, dy: 0.05 },
    { glyph: "●", fg: "#5b5393", glow: "#aaaaaa", dx: -0.01, dy: 0.03, scale: 0.2 },
    ]
  },

  ember_root_patch: { glyph: "♨", fg: "#d57b3a", glow: "#9a3f14" },
  venom_spores: { glyph: "◌", fg: "#9dd46f", glow: "#5f8d3c" },
  // Mining nodes
  ore_vein_iron:  { glyph: "◈", fg: "#c0754a", glow: "#8a3e1e" },
  ore_vein_coal:  { glyph: "◆", fg: "#3a3a3a", glow: "#1a1a1a" },
  ore_vein_stone: { glyph: "◇", fg: "#8a8e93", glow: "#555a5e" },
  // Crafting stations
  anvil:        { glyph: "⚒", fg: "#9aacba", glow: "#4a6070" },
  anvil_active: { glyph: "⚒", fg: "#ffd08a", glow: "#ff7a18" },
  furnace:       { glyph: "🫕", fg: "#ff8533", glow: "#cc4400" },
  furnace_unlit: { glyph: "🫕", fg: "#8a6040", glow: "#553320" },
  cooking_fire: { glyph: "♨", fg: "#ff9944", glow: "#dd5500" },
  // Tree harvest stages
  tree_stump:    { glyph: ".", fg: "#8b6914", glow: "#5a4a10" },
  tree_sapling:  { glyph: "🌱", fg: "#5a9040", glow: "#3a6020" },
  tree_harvest:  { glyph: "🌳", fg: "#2d8b2d", glow: "#1a5a1a" },
  // Growth stage glyphs
  farmland_tilled: { glyph: "⁙", fg: "#8b7355", glow: "#5a4a38" },
  seedling:      { glyph: "🌱", fg: "#7ecc5a", glow: "#4a9030" },
  herb_growing:  { glyph: "🌿", fg: "#63a85f", glow: "#3e6b3c" },
  // Overworld structures
  crop_wheat:    { glyph: "🌾", fg: "#d4a830", glow: "#a07820" },
  crop_carrot:   { glyph: "🥕", fg: "#7ecc5a", glow: "#4a9030" },
  crop_corn:     { glyph: "🌽", fg: "#e8c820", glow: "#b89a10" },
  well:          { glyph: "O", fg: "#7799bb", glow: "#445566" },
  scarecrow:     { glyph: "T", fg: "#b89070", glow: "#7a5a3a" },
  tavern_keg:    { glyph: "o", fg: "#8b5a2b", glow: "#5a3a1a" },
  tavern_table:  { glyph: "═", fg: "#a08050", glow: "#6b5530" },
  tavern_bench:  { glyph: "▭", fg: "#9a7040", glow: "#6a4a28" },
  tavern_pillar: { glyph: "□", fg: "#8a7a6a", glow: "#5a4a3a" },
  tavern_sign:   { glyph: "🍺", fg: "#d4a830", glow: "#a07820" },
  millstone:     { glyph: "◎", fg: "#9a9a9a", glow: "#5a5a5a" },
  millstone_active: { glyph: "◉", fg: "#d8d2b0", glow: "#b08a3a" },
  cobblestone:   { glyph: "·", fg: "#8a8e93", glow: "#555a5e", bg: "#2a2c30" },
  // Church
  church_altar:  { glyph: "⛩", fg: "#cc99ff", glow: "#9966cc" },
  church_pew:    { glyph: "▭", fg: "#8a6040", glow: "#5a3a28" },
  church_sign:   { glyph: "†", fg: "#d8c08a", glow: "#8b6f3f" },
  smithy_sign:   { glyph: "⚒", fg: "#d8c08a", glow: "#8b6f3f" },
  church_font:   { glyph: "⛲", fg: "#88bbff", glow: "#4477cc" },
  church_window: { glyph: "✦", fg: "#ff88cc", glow: "#cc44aa" },
  window_arched:     { glyph: "⌐", fg: "#aabbcc", glow: "#667799" },
  window_iron_grate: { glyph: "⊞", fg: "#8899aa", glow: "#556677" },
  window_shuttered:  { glyph: "⊟", fg: "#b89060", glow: "#7a5a38" },
  window_round:      { glyph: "◎", fg: "#99bbdd", glow: "#5588aa" },
  window_rect:       { glyph: "█", fg: "#88bbee", glow: "#5588bb" },
  bell:          { glyph: "🔔", fg: "#d4a017", glow: "#8b6914" },
  // Garden flowers (full-color emoji)
  flower_rose:       { glyph: "🌹", fg: "#ff3344", glow: "#cc1122" },
  flower_sunflower:  { glyph: "🌻", fg: "#ffdd33", glow: "#ccaa11" },
  flower_tulip:      { glyph: "🌷", fg: "#ff66aa", glow: "#cc3388" },
  flower_daisy:      { glyph: "🌼", fg: "#ffeeaa", glow: "#ccbb77" },
  flower_bluebell:   { glyph: "🌸", fg: "#7799ff", glow: "#4466cc" },
  // Town decorations
  barrel:        { glyph: "o", fg: "#a07040", glow: "#6a4828" },
  crate:         { glyph: "▪", fg: "#9a7a50", glow: "#6a5030" },
  woodpile:      { glyph: "≡", fg: "#8b6840", glow: "#5a4028" },
  hay_bale:      { glyph: "▓", fg: "#d4b44a", glow: "#a08828" },
  lantern_post:  { glyph: "♦", fg: "#ffcc55", glow: "#cc9922" },
  lantern_post_unlit: { glyph: "♦", fg: "#665533", glow: "#332211" },
  rain_barrel:   { glyph: "U", fg: "#7a8a94", glow: "#4a5a64" },
  wheelbarrow: {
    layers: [
    { glyph: "-", fg: "#120707", glow: "#aaaaaa", dx: -0.27, scale: 0.96 },
    { glyph: "-", fg: "#000000", glow: "#aaaaaa", dx: 0.35, dy: 0.23, scale: 0.6 },
    { glyph: "-", fg: "#000000", glow: "#aaaaaa", dx: 0.34, dy: -0.24, scale: 0.6 },
    { glyph: "■", fg: "#702929", glow: "#aaaaaa", dx: 0.01, dy: -0.03, scale: 0.72 },
    { glyph: "⊂", fg: "#b84c4c", glow: "#aaaaaa", dx: 0.01, dy: 0.04, scale: 1.39 },
    ]
  },
  market_stall:  { glyph: "⌂", fg: "#c4a060", glow: "#8a6830" },
  bench:         { glyph: "▬", fg: "#9a7850", glow: "#6a5030" },
  // Natural features
  boulder:       { glyph: "●", fg: "#8a8e93", glow: "#5a5e63" },
  fallen_log:    { glyph: "═", fg: "#6a5a3a", glow: "#3a2a18" },
  lily_pad:      { glyph: "◌", fg: "#5aaa4a", glow: "#3a7a2a" },
  cattail:       { glyph: "|", fg: "#7a9a5a", glow: "#4a6a32" },
  // Garden features
  birdbath:      { glyph: "⊙", fg: "#99aabb", glow: "#667788" },
  trellis:       { glyph: "⊞", fg: "#7a9a5a", glow: "#4a6a32" },

  // Room features
  fountain:    { glyph: "⛲", fg: "#66bbee", glow: "#3388aa" },
  altar:       { glyph: "⛩", fg: "#cc99ff", glow: "#9966cc" },
  shrine:      { glyph: "⛫", fg: "#ffdd66", glow: "#ccaa33" },
  statue:      { glyph: "🗿", fg: "#ccccdd", glow: "#9999ab" },
  sarcophagus: { glyph: "⚰", fg: "#aaa8a0", glow: "#777570" },
  pillar:      { glyph: "#", fg: "#b0a8c0",  glow: "#706880" },
  weapon_rack: { glyph: "⚔", fg: "#bbbbcc", glow: "#888899" },
  mushrooms:   { glyph: "🍄", fg: "#88cc88", glow: "#558855" },
  web:         { glyph: "🕸", fg: "#c8c8c8", glow: "#888888" },
  torch:       { glyph: "🕯", fg: "#ffaa44", glow: "#ff6600" },
  urn:         { glyph: "⚱", fg: "#c8a060", glow: "#8a6030" },
  flayed_man:  { glyph: "╳", fg: "#3a2213", glow: "#aaaaaa" },
  hanging_chains: { glyph: "⛓", fg: "#8f9299", glow: "#aaaaaa" },

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
  trap_pit: { glyph: "^", fg: "#8a6a52", glow: "#5a4333" },
  trap_siphon: { glyph: "^", fg: "#8a7dff", glow: "#5345bb" },
  trap_rust: { glyph: "^", fg: "#c7793d", glow: "#864824" },
  trap_swarm: { glyph: "^", fg: "#8dbb55", glow: "#527a2d" },
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
  reagent_moonleaf: { glyph: "❋", fg: "#d7e3ff", glow: "#8292c4" },
  reagent_ember_root: { glyph: "♢", fg: "#e09a54", glow: "#9a4f1d" },
  food_wheat:    { glyph: "%", fg: "#d4a830", glow: "#a07820" },
  food_carrot:   { glyph: "%", fg: "#7ecc5a", glow: "#4a9030" },
  food_corn:     { glyph: "%", fg: "#e8c820", glow: "#b89a10" },
  // Ore items (dropped from mining nodes)
  ore_iron:  { glyph: "≡", fg: "#b86840", glow: "#7a3a18" },
  ore_coal:  { glyph: "■", fg: "#404040", glow: "#202020" },
  material_iron: { glyph: "▬", fg: "#bfc7cf", glow: "#6d7c89" },
  ore_stone: { glyph: "▪", fg: "#878b90", glow: "#50565c" },
  // Town economy goods
  food_flour:      { glyph: "%", fg: "#e8dcc0", glow: "#b8ac90" },
  food_stew:       { glyph: "%", fg: "#c88a4a", glow: "#8a5a2a" },
  fuel_firewood:   { glyph: "≡", fg: "#a07040", glow: "#6a4828" },
  material_lumber: { glyph: "≡", fg: "#b88a52", glow: "#7c5222" },
  water_bucket:    { glyph: "U", fg: "#6a9ab4", glow: "#3a6a84" },
  tool_hatchet:    { glyph: ")", fg: "#a0a0a0", glow: "#707070" },
  tool_kitchen_knife: { glyph: ")", fg: "#c0c0c0", glow: "#888888" },

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
