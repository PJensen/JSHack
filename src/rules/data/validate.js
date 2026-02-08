// rules/data/validate.js
// Assert that equipment and affix data conform to expected shapes.

export function validateEquipment(EQUIP_DEFS) {
  if (typeof EQUIP_DEFS !== 'object' || !EQUIP_DEFS) throw new Error('EQUIP_DEFS must be an object');
  for (const [id, rec] of Object.entries(EQUIP_DEFS)) {
    if (rec.id !== id) throw new Error(`equip ${id}: id mismatch`);
    if (rec.kind !== 'equip') throw new Error(`equip ${id}: kind must be 'equip'`);
    if (typeof rec.name !== 'string' || !rec.name) throw new Error(`equip ${id}: name required`);
    if (typeof rec.slot !== 'string' || !rec.slot) throw new Error(`equip ${id}: slot required`);
    if (typeof rec.rarity !== 'number' || rec.rarity < 1) throw new Error(`equip ${id}: rarity >= 1`);
    if (typeof rec.rarityName !== 'string' || !rec.rarityName) throw new Error(`equip ${id}: rarityName required`);
    if (rec.bonuses && typeof rec.bonuses !== 'object') throw new Error(`equip ${id}: bonuses must be object`);
    if (rec.bonuses) {
      for (const [k, v] of Object.entries(rec.bonuses)) {
        if (typeof v !== 'number') throw new Error(`equip ${id}: bonus ${k} must be number`);
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

export function validateAll({ EQUIP_DEFS, AFFIX_DEFS }) {
  return validateEquipment(EQUIP_DEFS) && validateAffixes(AFFIX_DEFS);
}
