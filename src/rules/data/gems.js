// rules/data/gems.js
// Gem definitions. Each gem has a true identity, an appearance (color), a value,
// weight, hardness, probability weight, and material.
// Future: unidentified gems show only their appearance ("White Gem"), requiring
// identification (touchstone, scroll) to reveal their true name.

/**
 * @typedef {Object} GemDef
 * @property {string} id
 * @property {string} name         - true name
 * @property {string} appearance   - color-based description (for future ID system)
 * @property {number} value        - sale value in gold
 * @property {number} weight
 * @property {'hard'|'soft'} hardness
 * @property {number} prob         - relative probability weight
 * @property {'gemstone'|'glass'|'mineral'} material
 */

/** @type {Record<string, GemDef>} */
export const GEM_DEFS = {
  // ── Precious gemstones ─────────────────────────────────────────────
  gem_dilithium:   { id: 'gem_dilithium',   name: 'Dilithium Crystal',   appearance: 'White Gem',           value: 4500, weight: 1, hardness: 'soft', prob: 2,   material: 'gemstone' },
  gem_diamond:     { id: 'gem_diamond',     name: 'Diamond',             appearance: 'White Gem',           value: 4000, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_ruby:        { id: 'gem_ruby',        name: 'Ruby',                appearance: 'Red Gem',             value: 3500, weight: 1, hardness: 'hard', prob: 4,   material: 'gemstone' },
  gem_jacinth:     { id: 'gem_jacinth',     name: 'Jacinth Stone',       appearance: 'Orange Gem',          value: 3250, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_sapphire:    { id: 'gem_sapphire',    name: 'Sapphire',            appearance: 'Blue Gem',            value: 3000, weight: 1, hardness: 'hard', prob: 4,   material: 'gemstone' },
  gem_black_opal:  { id: 'gem_black_opal',  name: 'Black Opal',          appearance: 'Black Gem',           value: 2500, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_emerald:     { id: 'gem_emerald',     name: 'Emerald',             appearance: 'Green Gem',           value: 2500, weight: 1, hardness: 'hard', prob: 5,   material: 'gemstone' },
  gem_turquoise:   { id: 'gem_turquoise',   name: 'Turquoise Stone',     appearance: 'Green Gem',           value: 2000, weight: 1, hardness: 'soft', prob: 6,   material: 'gemstone' },
  gem_citrine:     { id: 'gem_citrine',     name: 'Citrine Stone',       appearance: 'Yellow Gem',          value: 1500, weight: 1, hardness: 'soft', prob: 4,   material: 'gemstone' },
  gem_aquamarine:  { id: 'gem_aquamarine',  name: 'Aquamarine Stone',    appearance: 'Green Gem',           value: 1500, weight: 1, hardness: 'hard', prob: 6,   material: 'gemstone' },
  gem_amber:       { id: 'gem_amber',       name: 'Amber Stone',         appearance: 'Yellowish Brown Gem', value: 1000, weight: 1, hardness: 'soft', prob: 8,   material: 'gemstone' },
  gem_topaz:       { id: 'gem_topaz',       name: 'Topaz Stone',         appearance: 'Yellowish Brown Gem', value: 900,  weight: 1, hardness: 'hard', prob: 10,  material: 'gemstone' },
  gem_jet:         { id: 'gem_jet',         name: 'Jet Stone',           appearance: 'Black Gem',           value: 850,  weight: 1, hardness: 'soft', prob: 6,   material: 'gemstone' },
  gem_opal:        { id: 'gem_opal',        name: 'Opal',                appearance: 'White Gem',           value: 800,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },
  gem_chrysoberyl: { id: 'gem_chrysoberyl', name: 'Chrysoberyl Stone',   appearance: 'Yellow Gem',          value: 700,  weight: 1, hardness: 'soft', prob: 8,   material: 'gemstone' },
  gem_garnet:      { id: 'gem_garnet',      name: 'Garnet Stone',        appearance: 'Red Gem',             value: 700,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },
  gem_amethyst:    { id: 'gem_amethyst',    name: 'Amethyst Stone',      appearance: 'Violet Gem',          value: 600,  weight: 1, hardness: 'soft', prob: 14,  material: 'gemstone' },
  gem_jasper:      { id: 'gem_jasper',      name: 'Jasper Stone',        appearance: 'Red Gem',             value: 500,  weight: 1, hardness: 'soft', prob: 15,  material: 'gemstone' },
  gem_fluorite:    { id: 'gem_fluorite',    name: 'Fluorite Stone',      appearance: 'Green Gem',           value: 400,  weight: 1, hardness: 'soft', prob: 15,  material: 'gemstone' },
  gem_jade:        { id: 'gem_jade',        name: 'Jade Stone',          appearance: 'Green Gem',           value: 300,  weight: 1, hardness: 'soft', prob: 10,  material: 'gemstone' },
  gem_obsidian:    { id: 'gem_obsidian',    name: 'Obsidian Stone',      appearance: 'Black Gem',           value: 200,  weight: 1, hardness: 'soft', prob: 9,   material: 'gemstone' },
  gem_agate:       { id: 'gem_agate',       name: 'Agate Stone',         appearance: 'Orange Gem',          value: 200,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },

  // ── Worthless glass (look like gems when unidentified) ─────────────
  glass_white:     { id: 'glass_white',     name: 'Worthless Piece of White Glass',           appearance: 'White Gem',           value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_blue:      { id: 'glass_blue',      name: 'Worthless Piece of Blue Glass',            appearance: 'Blue Gem',            value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_red:       { id: 'glass_red',       name: 'Worthless Piece of Red Glass',             appearance: 'Red Gem',             value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_brown:     { id: 'glass_brown',     name: 'Worthless Piece of Yellowish Brown Glass', appearance: 'Yellowish Brown Gem', value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_orange:    { id: 'glass_orange',    name: 'Worthless Piece of Orange Glass',          appearance: 'Orange Gem',          value: 0, weight: 1, hardness: 'soft', prob: 76, material: 'glass' },
  glass_yellow:    { id: 'glass_yellow',    name: 'Worthless Piece of Yellow Glass',          appearance: 'Yellow Gem',          value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_black:     { id: 'glass_black',     name: 'Worthless Piece of Black Glass',           appearance: 'Black Gem',           value: 0, weight: 1, hardness: 'soft', prob: 76, material: 'glass' },
  glass_green:     { id: 'glass_green',     name: 'Worthless Piece of Green Glass',           appearance: 'Green Gem',           value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_violet:    { id: 'glass_violet',    name: 'Worthless Piece of Violet Glass',          appearance: 'Violet Gem',          value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },

  // ── Gray stones ────────────────────────────────────────────────────
  stone_luckstone:  { id: 'stone_luckstone',  name: 'Luckstone',    appearance: 'Gray Stone', value: 60,  weight: 10,  hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_loadstone:  { id: 'stone_loadstone',  name: 'Loadstone',    appearance: 'Gray Stone', value: 1,   weight: 500, hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_touchstone: { id: 'stone_touchstone', name: 'Touchstone',   appearance: 'Gray Stone', value: 45,  weight: 10,  hardness: 'soft', prob: 8,   material: 'mineral' },
  stone_flint:      { id: 'stone_flint',      name: 'Flint Stone',  appearance: 'Gray Stone', value: 1,   weight: 10,  hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_rock:       { id: 'stone_rock',       name: 'Rock',         appearance: 'Rock',       value: 0,   weight: 10,  hardness: 'soft', prob: 100, material: 'mineral' },
};

export function getGem(id) { return GEM_DEFS[id] || null; }
export function listGems() { return Object.values(GEM_DEFS); }
export function listGemIds() { return Object.keys(GEM_DEFS); }

/**
 * Pick a random gem using probability weights.
 * @param {Object} rng - createRng() instance
 * @param {Object} [opts]
 * @param {string[]} [opts.materials] - restrict to these materials (e.g. ['gemstone'])
 * @returns {GemDef}
 */
export function pickGem(rng, opts = {}) {
  let pool = Object.values(GEM_DEFS);
  if (opts.materials) pool = pool.filter(g => opts.materials.includes(g.material));
  const total = pool.reduce((s, g) => s + g.prob, 0);
  let roll = rng.float(0, total);
  for (const gem of pool) {
    roll -= gem.prob;
    if (roll <= 0) return gem;
  }
  return pool[pool.length - 1];
}
