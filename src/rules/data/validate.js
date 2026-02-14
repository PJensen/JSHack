// rules/data/validate.js
// Assert that item-catalog and affix data conform to expected shapes.

export function validateItemCatalog(ITEM_CATALOG) {
  if (typeof ITEM_CATALOG !== 'object' || !ITEM_CATALOG) throw new Error('ITEM_CATALOG must be an object');
  for (const [id, rec] of Object.entries(ITEM_CATALOG)) {
    if (rec.id !== id) throw new Error(`item ${id}: id mismatch`);
    if (typeof rec.name !== 'string' || !rec.name) throw new Error(`item ${id}: name required`);
    if (typeof rec.type !== 'string' || !rec.type) throw new Error(`item ${id}: type required`);
    if (typeof rec.catalogKind !== 'string' || !rec.catalogKind) throw new Error(`item ${id}: catalogKind required`);
    if (typeof rec.rarity !== 'number' || rec.rarity < 1) throw new Error(`item ${id}: rarity >= 1`);
    if (typeof rec.rarityName !== 'string' || !rec.rarityName) throw new Error(`item ${id}: rarityName required`);

    if (rec.catalogKind === 'equipment') {
      if (rec.type !== 'equip') throw new Error(`item ${id}: equipment must have type 'equip'`);
      if (typeof rec.slot !== 'string' || !rec.slot) throw new Error(`item ${id}: equipment slot required`);
      if (rec.bonuses && typeof rec.bonuses !== 'object') throw new Error(`item ${id}: bonuses must be object`);
      if (rec.bonuses) {
        for (const [k, v] of Object.entries(rec.bonuses)) {
          if (typeof v !== 'number') throw new Error(`item ${id}: bonus ${k} must be number`);
        }
      }
    }
  }
  return true;
}

export function validateAffixes(AFFIX_DEFS) {
  if (typeof AFFIX_DEFS !== 'object' || !AFFIX_DEFS) throw new Error('AFFIX_DEFS must be an object');
  for (const [id, rec] of Object.entries(AFFIX_DEFS)) {
    if (typeof rec.name !== 'string' || !rec.name) throw new Error(`affix ${id}: name required`);
    if (!Array.isArray(rec.slots) || rec.slots.length === 0) throw new Error(`affix ${id}: slots required`);
    if (!Array.isArray(rec.triggers)) throw new Error(`affix ${id}: triggers must be array`);
    if (rec.script && typeof rec.script !== 'string' && typeof rec.script !== 'function') throw new Error(`affix ${id}: script must be string or function`);
    if (rec.passive && typeof rec.passive !== 'string' && typeof rec.passive !== 'function') throw new Error(`affix ${id}: passive must be string or function`);
  }
  return true;
}

export function validateAll({ ITEM_CATALOG, AFFIX_DEFS }) {
  return validateItemCatalog(ITEM_CATALOG) && validateAffixes(AFFIX_DEFS);
}
