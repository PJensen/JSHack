// data/items.js
// Item / equipment / affix definitions extracted from the reference implementation.
// Pure ES module exporting named definitions for easy import.
//
// Scripts: some item/effect entries may include executable functions instead of
// strings. Those functions receive a single `api` argument with the same helper
// bindings used by the original runtime: { game, level, player, rng, log, GL, heal, damageVisible }
// and should return either a human-readable message string (optional) or undefined.
//
// JSON vs functions: If you prefer pure JSON (e.g., for tooling or editing by non-JS tools),
// keep `effect` as a DSL string (existing mini-DSL is supported). Converting to executable
// functions trades portability for clarity and performance (no runtime eval). Use whichever
// style matches your workflow; the game runtime must call the appropriate handler when using items.

export const ITEM_DEFS = {
  potion_healing: { id:"potion_healing", name:"Healing Potion", short:"HealPot", glyph:"🧪", color:"#ff4d6d", kind:"potion", rarity:1, effect:"heal 8 12" },
  scroll_light:   { id:"scroll_light",   name:"Scroll of Light", short:"Light",   glyph:"📜", color:"#ffd166", kind:"scroll",  rarity:1, effect:"reveal all" },
  potion_minor:   { id:"potion_minor",   name:"Minor Potion",    short:"MinorHeal", glyph:"🧪", color:"#ff9aa2", kind:"potion", rarity:2, effect:"heal 4 6; status regen 4 2" },
  scroll_blast:   { id:"scroll_blast",   name:"Scroll of Blasting", short:"Blast",  glyph:"📜", color:"#ffa600", kind:"scroll", rarity:2,
    // Executable function variant of the original inline script. Receives `api` helpers and returns a message string.
    script: function(api){
      const { game, level, player } = api;
      const originX = player.x, originY = player.y;
      const dmg = 5;
      let hits = 0, kills = 0;
      try { game.spawnRipple(originX, originY, { maxR: 9, life: 0.7, color: '#ff9d1e' }); } catch(e){}
      for (const m of level.monsters){
        if (!m.dead && game.visibleNow && game.visibleNow.has(`${m.x},${m.y}`)){
          m.hp -= dmg; hits++;
          try { game.addFloatText(m.x, m.y, `-${dmg}`, { color:'#ffa94d', dmg }); } catch(e){}
          if (m.hp <= 0){ m.dead = true; kills++; try { game.addFloatText(m.x, m.y, '✖', { color:'#ffffff', life:0.9, scaleStart:1.2, scaleEnd:0.6 }); } catch(e){} }
        }
      }
      if (kills) return `A concussive wave annihilates ${kills} monster${kills>1?'s':''}!`;
      if (hits) return `A concussive wave batters ${hits} foe${hits>1?'s':''}.`;
      return 'A concussive wave ripples outward.';
    } },
  book_lightning: { id:"book_lightning", name:"Spellbook of Lightning", short:"BoltBook", glyph:"📖", color:"#80f7ff", kind:"book", rarity:2, effect:"learn lightning" },
  gold_coin: { id:'gold_coin', name:'Gold', short:'Gold', glyph:'$', color:'#ffd24d', kind:'gold', rarity:1, stackable:true, value:1 }
};

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

export const AFFIX_DEFS = {
  thorns1: { name:'Thorns I', slots:['armor'], triggers:['onDamaged'], script:(ctx)=>{ ctx.retaliate(2); }, weight:30 },
  vamp1:   { name:'Vampiric I', slots:['weapon'], triggers:['onHit'], script:(ctx)=>{ ctx.healAttacker(Math.max(1, Math.floor(ctx.damage/3))); }, weight:20 },
  fierce:  { name:'Fierce', slots:['weapon'], triggers:['onBeforeHit'], script:(ctx)=>{ ctx.damage += 1; }, weight:25 },
  guard1:  { name:'Guarded', slots:['armor'], passive:(ctx)=>{ ctx.addBonus('defense',1); }, triggers:[], weight:25 },
  life1:   { name:'Healthy', slots:['armor','ring'], passive:(ctx)=>{ ctx.addBonus('maxHp',5); }, triggers:[], weight:22 }
};

// Convenience map (id -> def)
export const itemDefs = new Map(Object.values(ITEM_DEFS).map(o=>[o.id,o]));
export const equipDefs = new Map(Object.values(EQUIP_DEFS).map(o=>[o.id,o]));

export default { ITEM_DEFS, EQUIP_DEFS, AFFIX_DEFS, itemDefs, equipDefs };
