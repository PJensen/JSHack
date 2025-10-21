// src/data/item-defs.js
// Exports ITEM_DEFS and convenience map itemDefs
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

export const itemDefs = new Map(Object.values(ITEM_DEFS).map(o=>[o.id,o]));

export default { ITEM_DEFS, itemDefs };
