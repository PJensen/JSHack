// src/data/affix-defs.js
export const AFFIX_DEFS = {
  thorns1: { name:'Thorns I', slots:['armor'], triggers:['onDamaged'], script:(ctx)=>{ ctx.retaliate(2); }, weight:30 },
  vamp1:   { name:'Vampiric I', slots:['weapon'], triggers:['onHit'], script:(ctx)=>{ ctx.healAttacker(Math.max(1, Math.floor(ctx.damage/3))); }, weight:20 },
  fierce:  { name:'Fierce', slots:['weapon'], triggers:['onBeforeHit'], script:(ctx)=>{ ctx.damage += 1; }, weight:25 },
  guard1:  { name:'Guarded', slots:['armor'], passive:(ctx)=>{ ctx.addBonus('defense',1); }, triggers:[], weight:25 },
  life1:   { name:'Healthy', slots:['armor','ring'], passive:(ctx)=>{ ctx.addBonus('maxHp',5); }, triggers:[], weight:22 }
};

export default AFFIX_DEFS;
