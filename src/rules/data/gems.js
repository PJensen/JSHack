// rules/data/gems.js
// Gem definitions. Each gem has a true identity, an appearance (color), a value,
// weight, hardness, probability weight, and material.
// Future: unidentified gems show only their appearance ("white gem"), requiring
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
  gem_dilithium:   { id: 'gem_dilithium',   name: 'dilithium crystal',   appearance: 'white gem',           value: 4500, weight: 1, hardness: 'soft', prob: 2,   material: 'gemstone' },
  gem_diamond:     { id: 'gem_diamond',     name: 'diamond',             appearance: 'white gem',           value: 4000, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_ruby:        { id: 'gem_ruby',        name: 'ruby',               appearance: 'red gem',             value: 3500, weight: 1, hardness: 'hard', prob: 4,   material: 'gemstone' },
  gem_jacinth:     { id: 'gem_jacinth',     name: 'jacinth stone',       appearance: 'orange gem',          value: 3250, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_sapphire:    { id: 'gem_sapphire',    name: 'sapphire',           appearance: 'blue gem',            value: 3000, weight: 1, hardness: 'hard', prob: 4,   material: 'gemstone' },
  gem_black_opal:  { id: 'gem_black_opal',  name: 'black opal',         appearance: 'black gem',           value: 2500, weight: 1, hardness: 'hard', prob: 3,   material: 'gemstone' },
  gem_emerald:     { id: 'gem_emerald',     name: 'emerald',            appearance: 'green gem',           value: 2500, weight: 1, hardness: 'hard', prob: 5,   material: 'gemstone' },
  gem_turquoise:   { id: 'gem_turquoise',   name: 'turquoise stone',    appearance: 'green gem',           value: 2000, weight: 1, hardness: 'soft', prob: 6,   material: 'gemstone' },
  gem_citrine:     { id: 'gem_citrine',     name: 'citrine stone',      appearance: 'yellow gem',          value: 1500, weight: 1, hardness: 'soft', prob: 4,   material: 'gemstone' },
  gem_aquamarine:  { id: 'gem_aquamarine',  name: 'aquamarine stone',   appearance: 'green gem',           value: 1500, weight: 1, hardness: 'hard', prob: 6,   material: 'gemstone' },
  gem_amber:       { id: 'gem_amber',       name: 'amber stone',        appearance: 'yellowish brown gem', value: 1000, weight: 1, hardness: 'soft', prob: 8,   material: 'gemstone' },
  gem_topaz:       { id: 'gem_topaz',       name: 'topaz stone',        appearance: 'yellowish brown gem', value: 900,  weight: 1, hardness: 'hard', prob: 10,  material: 'gemstone' },
  gem_jet:         { id: 'gem_jet',         name: 'jet stone',          appearance: 'black gem',           value: 850,  weight: 1, hardness: 'soft', prob: 6,   material: 'gemstone' },
  gem_opal:        { id: 'gem_opal',        name: 'opal',               appearance: 'white gem',           value: 800,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },
  gem_chrysoberyl: { id: 'gem_chrysoberyl', name: 'chrysoberyl stone',  appearance: 'yellow gem',          value: 700,  weight: 1, hardness: 'soft', prob: 8,   material: 'gemstone' },
  gem_garnet:      { id: 'gem_garnet',      name: 'garnet stone',       appearance: 'red gem',             value: 700,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },
  gem_amethyst:    { id: 'gem_amethyst',    name: 'amethyst stone',     appearance: 'violet gem',          value: 600,  weight: 1, hardness: 'soft', prob: 14,  material: 'gemstone' },
  gem_jasper:      { id: 'gem_jasper',      name: 'jasper stone',       appearance: 'red gem',             value: 500,  weight: 1, hardness: 'soft', prob: 15,  material: 'gemstone' },
  gem_fluorite:    { id: 'gem_fluorite',    name: 'fluorite stone',     appearance: 'green gem',           value: 400,  weight: 1, hardness: 'soft', prob: 15,  material: 'gemstone' },
  gem_jade:        { id: 'gem_jade',        name: 'jade stone',         appearance: 'green gem',           value: 300,  weight: 1, hardness: 'soft', prob: 10,  material: 'gemstone' },
  gem_obsidian:    { id: 'gem_obsidian',    name: 'obsidian stone',     appearance: 'black gem',           value: 200,  weight: 1, hardness: 'soft', prob: 9,   material: 'gemstone' },
  gem_agate:       { id: 'gem_agate',       name: 'agate stone',        appearance: 'orange gem',          value: 200,  weight: 1, hardness: 'soft', prob: 12,  material: 'gemstone' },

  // ── Worthless glass (look like gems when unidentified) ─────────────
  glass_white:     { id: 'glass_white',     name: 'worthless piece of white glass',           appearance: 'white gem',           value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_blue:      { id: 'glass_blue',      name: 'worthless piece of blue glass',            appearance: 'blue gem',            value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_red:       { id: 'glass_red',       name: 'worthless piece of red glass',             appearance: 'red gem',             value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_brown:     { id: 'glass_brown',     name: 'worthless piece of yellowish brown glass', appearance: 'yellowish brown gem', value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_orange:    { id: 'glass_orange',    name: 'worthless piece of orange glass',          appearance: 'orange gem',          value: 0, weight: 1, hardness: 'soft', prob: 76, material: 'glass' },
  glass_yellow:    { id: 'glass_yellow',    name: 'worthless piece of yellow glass',          appearance: 'yellow gem',          value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_black:     { id: 'glass_black',     name: 'worthless piece of black glass',           appearance: 'black gem',           value: 0, weight: 1, hardness: 'soft', prob: 76, material: 'glass' },
  glass_green:     { id: 'glass_green',     name: 'worthless piece of green glass',           appearance: 'green gem',           value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },
  glass_violet:    { id: 'glass_violet',    name: 'worthless piece of violet glass',          appearance: 'violet gem',          value: 0, weight: 1, hardness: 'soft', prob: 77, material: 'glass' },

  // ── Gray stones ────────────────────────────────────────────────────
  stone_luckstone:  { id: 'stone_luckstone',  name: 'luckstone',  appearance: 'gray stone', value: 60,  weight: 10,  hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_loadstone:  { id: 'stone_loadstone',  name: 'loadstone',  appearance: 'gray stone', value: 1,   weight: 500, hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_touchstone: { id: 'stone_touchstone', name: 'touchstone', appearance: 'gray stone', value: 45,  weight: 10,  hardness: 'soft', prob: 8,   material: 'mineral' },
  stone_flint:      { id: 'stone_flint',      name: 'flint stone', appearance: 'gray stone', value: 1,   weight: 10,  hardness: 'soft', prob: 10,  material: 'mineral' },
  stone_rock:       { id: 'stone_rock',       name: 'rock',       appearance: 'rock',       value: 0,   weight: 10,  hardness: 'soft', prob: 100, material: 'mineral' },
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
