// data/status.js
// Minimal STATUS_DEFS exported for compatibility. Copied from reference implementation.
export const STATUS_DEFS = {
  poison: {
    id:'poison', name:'Poison', kind:'debuff', stackMode:'refresh',
    onTick:(ent, game, s)=>{
      if (ent.dead) return null;
      const dmg = s.potency || 2;
      const floor = dmg>=999 ? 0 : 1;
      const before = ent.hp;
      ent.hp = Math.max(floor, ent.hp - dmg);
      if (ent === game.player) game.updateHUD();
      if (before !== ent.hp) return `${ent===game.player? 'Poison':'The '+ent.name.toLowerCase()+' is poisoned'} for ${before-ent.hp}.`;
      return null;
    },
    onExpire:(ent, game)=> ent.dead ? null : (ent===game.player? 'The poison fades.' : `The ${ent.name.toLowerCase()} recovers from poison.`)
  },
  regen: {
    id:'regen', name:'Regen', kind:'buff', stackMode:'refresh',
    onTick:(ent, game, s)=>{
      if (ent.dead) return null;
      const amt = s.potency || 2;
      const before = ent.hp;
      ent.hp = Math.min(ent.maxHp, ent.hp + amt);
      if (ent === game.player && before!==ent.hp) game.updateHUD();
      if (before!==ent.hp) return `${ent===game.player? 'Regeneration':'The '+ent.name.toLowerCase()+' regenerates'} ${ent.hp-before} HP.`;
      return null;
    },
    onExpire:(ent, game)=> ent===game.player? 'Your vitality returns to normal.' : null
  }
};

export default STATUS_DEFS;
