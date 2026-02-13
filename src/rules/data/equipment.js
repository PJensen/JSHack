// Equipment base definitions (rarity weight managed later). rarity: numeric base chance divisor; rarityName used for affix counts.
export const EQUIP_DEFS = {
  sword_plain:   { id:'sword_plain', name:'Short Sword', kind:'equip', slot:'weapon', rarity:1, rarityName:'common', bonuses:{attack:2}, damageDice:'1d6', staminaCost:8 },
  dagger_quick:  { id:'dagger_quick', name:'Dagger', kind:'equip', slot:'weapon', rarity:1, rarityName:'common', bonuses:{attack:1}, damageDice:'1d4', staminaCost:5 },
  axe_heavy:     { id:'axe_heavy', name:'Axe', kind:'equip', slot:'weapon', rarity:2, rarityName:'magic', bonuses:{attack:3}, damageDice:'1d8', staminaCost:12 },
  leather_armor: { id:'leather_armor', name:'Leather Armor', kind:'equip', slot:'armor', rarity:1, rarityName:'common', bonuses:{defense:1} },
  chain_armor:   { id:'chain_armor', name:'Chainmail', kind:'equip', slot:'armor', rarity:2, rarityName:'magic', bonuses:{defense:2} },
  ring_health:   { id:'ring_health', name:'Ring of Health', kind:'equip', slot:'ring', rarity:2, rarityName:'magic', bonuses:{maxHp:5} },
  ring_precision:{ id:'ring_precision', name:'Ring of Precision', kind:'equip', slot:'ring', rarity:2, rarityName:'magic', bonuses:{critChance:0.08} },
  ring_arcana:   { id:'ring_arcana', name:'Ring of Arcana', kind:'equip', slot:'ring', rarity:3, rarityName:'rare', bonuses:{manaRegen:0.5} },
  shield_wood:   { id:'shield_wood', name:'Wooden Shield', kind:'equip', slot:'shield', rarity:1, rarityName:'common', bonuses:{defense:1} },
  shield_iron:   { id:'shield_iron', name:'Iron Shield', kind:'equip', slot:'shield', rarity:2, rarityName:'magic', bonuses:{defense:2} },
  iron_pickaxe:  { id:'iron_pickaxe', name:'Iron Pickaxe', kind:'equip', slot:'weapon', rarity:1, rarityName:'common', bonuses:{dig:1}, damageDice:'1d4', staminaCost:5 },
  bow_short:     { id:'bow_short', name:'Short Bow', kind:'equip', slot:'weapon', subtype:'bow', rarity:1, rarityName:'common', bonuses:{attack:1}, damageDice:'1d6', range:8, staminaCost:6 },
};

// Helpers (rules-side, data only)
export function listEquipmentDefs() { return Object.values(EQUIP_DEFS); }
export function getEquipmentDef(id) { return EQUIP_DEFS[id] || null; }