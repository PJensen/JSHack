// Affix definitions: triggers can be onBeforeHit, onHit, onDamaged, onKill, onEquip, onUnequip
// Scripts are registered via the central scripting router.
import { mulberry32, rngInt, combatSeed } from "../utils/rng.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { registerScript, ScriptVerb } from "../scripting.js";

const AFFIX_THORNS = "affix:thorns1";
const AFFIX_VAMP = "affix:vamp1";
const AFFIX_FIERCE = "affix:fierce";
const AFFIX_GUARD = "affix:guard1";
const AFFIX_LIFE = "affix:life1";
const AFFIX_ATTUNED = "affix:attuned1";

registerScript(AFFIX_THORNS, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    try {
      const attacker = (ctx && ctx.attacker) | 0;
      const defender = (ctx && ctx.defender) | 0;
      const step = (world && world.step) | 0;
      const seed = combatSeed(world?.seed ?? 0, step, attacker, defender, 0xc0ffee01);
      const r = mulberry32(seed);
      const roll = rngInt(r, 1, 100);
      if (roll <= 20) {
        ctx.retaliate(2);
        try { world.emit && world.emit('proc:thorns', { actor: ctx.defender, target: ctx.attacker }); } catch {}
        try {
          const ae = world.get(defender, ActiveEffects);
          if (ae && Array.isArray(ae.effects)) {
            ae.effects.push({ key: "thorns", turnsLeft: 3, potency: 1 });
          } else {
            world.add(defender, ActiveEffects, { effects: [{ key: "thorns", turnsLeft: 3, potency: 1 }] });
          }
        } catch {}
      }
    } catch {
      ctx.retaliate(2);
    }
  },
});

registerScript(AFFIX_VAMP, {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const amt = Math.max(1, Math.floor(ctx.damage / 3));
    ctx.healAttacker(amt);
    try { world.emit && world.emit('proc:vampiric', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch {}
  },
});

registerScript(AFFIX_FIERCE, {
  [ScriptVerb.AffixOnBeforeHit]: (world, ctx) => {
    ctx.damage += 1;
    try { world.emit && world.emit('proc:fierce', { actor: ctx.attacker, target: ctx.defender }); } catch {}
  },
});

registerScript(AFFIX_GUARD, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("defense", 1);
  },
});

registerScript(AFFIX_LIFE, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("maxHp", 5);
  },
});

registerScript(AFFIX_ATTUNED, {
  [ScriptVerb.AffixPassive]: (_world, ctx) => {
    ctx.addBonus("manaRegen", 0.25);
  },
});

export const AFFIX_DEFS = {
  thorns1: { name: "Thorns I", slots: ["armor"], triggers: ["onHit"], script: AFFIX_THORNS, weight: 30 },
  vamp1: { name: "Vampiric I", slots: ["weapon"], triggers: ["onHit"], script: AFFIX_VAMP, weight: 20 },
  fierce: { name: "Fierce", slots: ["weapon"], triggers: ["onBeforeHit"], script: AFFIX_FIERCE, weight: 25 },
  guard1: { name: "Guarded", slots: ["armor"], passive: AFFIX_GUARD, triggers: [], weight: 25 },
  life1: { name: "Healthy", slots: ["armor", "ring"], passive: AFFIX_LIFE, triggers: [], weight: 22 },
  attuned1: { name: "Attuned", slots: ["ring"], passive: AFFIX_ATTUNED, triggers: [], weight: 20 },
};

export function listAffixes() { return Object.entries(AFFIX_DEFS).map(([id, rec]) => ({ id, ...rec })); }
export function getAffix(id) { return AFFIX_DEFS[id] || null; }
