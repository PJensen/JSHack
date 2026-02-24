// rules/data/spells.js
// Pure rules-side spell definitions. No visuals here.
/**
 * @typedef {Object} SpellDef
 * @property {string} id
 * @property {string} name
 * @property {string} [symbol]  // unicode glyph for UI display
 * @property {number} manaCost
 * @property {number} [minIntelligence]
 * @property {number} [range]   // max casting range in tiles
 * @property {string} [script]  // optional key for scripted behavior
 */

/** @type {Record<string, SpellDef>} */
export const SPELL_DEFS = {
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    symbol: '\u26A1',       // ⚡
    manaCost: 7,
    minIntelligence: 8,
    script: 'lightning',
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    symbol: '\u2604',       // ☄
    manaCost: 12,
    minIntelligence: 0,
    range: 12,
    script: 'meteor',
  },
  blastwave: {
    id: 'blastwave',
    name: 'Blast Wave',
    symbol: '\u25CE',       // ◎
    manaCost: 7,
    minIntelligence: 0,
    script: 'blastwave',
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    symbol: '\u{1F3C3}',   // 🏃
    manaCost: 6,
    minIntelligence: 0,
    range: 10,
    script: 'blink',
  },
  homecoming: {
    id: 'homecoming',
    name: 'Homecoming',
    symbol: '\u{1F3E0}',   // 🏠
    manaCost: 1,
    minIntelligence: 0,
    script: 'homecoming',
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    symbol: '\u2744',       // ❄
    manaCost: 5,
    minIntelligence: 0,
    script: 'frost',
  },
  heal: {
    id: 'heal',
    name: 'Heal',
    symbol: '\u2764',       // ❤
    manaCost: 8,
    minIntelligence: 0,
    range: 6,
    script: 'heal',
  },
  phase_strike: {
    id: 'phase_strike',
    name: 'Phase Strike',
    symbol: '\u2381',       // ⌁
    manaCost: 10,
    minIntelligence: 0,
    range: 4,
    script: 'phase_strike',
  },
};

/**
 * @param {string} id
 * @returns {SpellDef | null}
 */
export function getSpell(id) {
  return SPELL_DEFS[id] || null;
}

export function listSpells() {
  return Object.values(SPELL_DEFS);
}
