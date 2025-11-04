// Affix definitions: triggers can be onBeforeHit, onHit, onDamaged, onKill, onEquip, onUnequip
// passive(ctx) executed during derived stat recalculation.
import { mulberry32, rngInt } from "../../lib/ecs-js/rng.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
export const AFFIX_DEFS = {
  // 20% chance to retaliate for 2 on successful hit (defender-side), shown in HUD for 3 turns
  thorns1: { name:'Thorns I', slots:['armor'], triggers:['onHit'], script:(ctx)=>{
    try {
      const w = ctx && ctx.world;
      const attacker = (ctx && ctx.attacker) | 0;
      const defender = (ctx && ctx.defender) | 0;
      const step = (w && w.step) | 0;
      // Deterministic seed derived from world seed, step, participants, and a constant salt
      const seed = ((w?.seed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^ (attacker >>> 0) ^ ((defender << 16) >>> 0) ^ 0xc0ffee01) >>> 0;
      const r = mulberry32(seed);
      const roll = rngInt(r, 1, 100);
      if (roll <= 20) {
        // Apply retaliation damage to attacker
        ctx.retaliate(2);
        // Display-only status for HUD/overlay this turn
        try {
          const ae = w.get(defender, ActiveEffects);
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push({ key: 'thorns', turnsLeft: 3, potency: 1 });
          } else {
            w.add(defender, ActiveEffects, { effects: [{ key: 'thorns', turnsLeft: 3, potency: 1 }] });
          }
        } catch {}
      }
    } catch {
      // Fail-safe: if rng fails for any reason, default to proc (keeps gameplay feedback), but don't crash
      ctx.retaliate(2);
    }
  }, weight:30 },
  vamp1:   { name:'Vampiric I', slots:['weapon'], triggers:['onHit'], script:(ctx)=>{ ctx.healAttacker(Math.max(1, Math.floor(ctx.damage/3))); }, weight:20 },
  fierce:  { name:'Fierce', slots:['weapon'], triggers:['onBeforeHit'], script:(ctx)=>{ ctx.damage += 1; }, weight:25 },
  guard1:  { name:'Guarded', slots:['armor'], passive:(ctx)=>{ ctx.addBonus('defense',1); }, triggers:[], weight:25 },
  life1:   { name:'Healthy', slots:['armor','ring'], passive:(ctx)=>{ ctx.addBonus('maxHp',5); }, triggers:[], weight:22 }
};

export function listAffixes() { return Object.entries(AFFIX_DEFS).map(([id, rec]) => ({ id, ...rec })); }
export function getAffix(id) { return AFFIX_DEFS[id] || null; }