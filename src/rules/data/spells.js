// rules/data/spells.js
// Pure rules-side spell definitions. No visuals here.
/**
 * @typedef {Object} SpellDef
 * @property {string} id
 * @property {string} name
 * @property {number} manaCost
 * @property {number} [minIntelligence]
 * @property {string} [script]  // optional key for scripted behavior
 */

/** @type {Record<string, SpellDef>} */
export const SPELL_DEFS = {
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    manaCost: 7,
    minIntelligence: 8,
    script: 'lightning',
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    manaCost: 12,
    minIntelligence: 0,
    range: 12,
    script: 'meteor',
  },
  blastwave: {
    id: 'blastwave',
    name: 'Blast Wave',
    manaCost: 7,
    minIntelligence: 0,
    script: 'blastwave',
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    manaCost: 6,
    minIntelligence: 0,
    range: 10,
    script: 'blink',
  },
  homecoming: {
    id: 'homecoming',
    name: 'Homecoming',
    manaCost: 1,
    minIntelligence: 0,
    script: 'homecoming',
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    manaCost: 5,
    minIntelligence: 0,
    script: 'frost',
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
