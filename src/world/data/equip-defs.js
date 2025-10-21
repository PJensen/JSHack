// src/data/equip-defs.js
export const EQUIP_DEFS = {
  sword_plain:   { id:'sword_plain', name:'Short Sword', glyph:')', color:'#e8e2b0', kind:'equip', slot:'weapon', rarity:1, rarityName:'common', bonuses:{attack:2} },
  dagger_quick:  { id:'dagger_quick', name:'Dagger', glyph:')', color:'#f7d794', kind:'equip', slot:'weapon', rarity:1, rarityName:'common', bonuses:{attack:1} },
  axe_heavy:     { id:'axe_heavy', name:'Axe', glyph:')', color:'#e0c070', kind:'equip', slot:'weapon', rarity:2, rarityName:'magic', bonuses:{attack:3} },
  leather_armor: { id:'leather_armor', name:'Leather Armor', glyph:'[', color:'#c49c66', kind:'equip', slot:'armor', rarity:1, rarityName:'common', bonuses:{defense:1} },
  chain_armor:   { id:'chain_armor', name:'Chainmail', glyph:'[', color:'#b0c4de', kind:'equip', slot:'armor', rarity:2, rarityName:'magic', bonuses:{defense:2} },
  ring_health:   { id:'ring_health', name:'Ring of Health', glyph:'◌', color:'#ffb347', kind:'equip', slot:'ring', rarity:2, rarityName:'magic', bonuses:{maxHp:5} },
  ring_precision:{ id:'ring_precision', name:'Ring of Precision', glyph:'◌', color:'#b3e6ff', kind:'equip', slot:'ring', rarity:2, rarityName:'magic', bonuses:{critChance:0.08} },
  shield_wood:   { id:'shield_wood', name:'Wooden Shield', glyph:'🛡️', color:'#deb887', kind:'equip', slot:'shield', rarity:1, rarityName:'common', bonuses:{defense:1} }
};

export const equipDefs = new Map(Object.values(EQUIP_DEFS).map(o=>[o.id,o]));

export default { EQUIP_DEFS, equipDefs };
