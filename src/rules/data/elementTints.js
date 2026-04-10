// Canonical element-tint identifiers.
// Rules-side data (affixes, coatings, effect defs) reference these keys.
// Display-side VFX maps each key to an RGB colour.
export const ELEMENT_TINT_FIRE     = 'fire';
export const ELEMENT_TINT_POISON   = 'poison';
export const ELEMENT_TINT_FROST    = 'frost';
export const ELEMENT_TINT_ACID     = 'acid';
export const ELEMENT_TINT_ELECTRIC = 'electric';

// Every valid tint key in one set, for quick membership checks.
export const ELEMENT_TINT_KEYS = Object.freeze([
  ELEMENT_TINT_FIRE,
  ELEMENT_TINT_POISON,
  ELEMENT_TINT_FROST,
  ELEMENT_TINT_ACID,
  ELEMENT_TINT_ELECTRIC,
]);
