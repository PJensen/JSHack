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
