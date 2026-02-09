// Monster innate on-hit scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { mulberry32, rngInt } from "../../lib/ecs-js/rng.js";

function combatSeed(world, ctx) {
  return ((world.seed >>> 0) ^ ((world.step * 0x9e3779b9) >>> 0)
    ^ (ctx.attacker >>> 0) ^ ((ctx.defender << 16) >>> 0)) >>> 0;
}

function pushEffect(world, entityId, effect) {
  const ae = world.get(entityId, ActiveEffects);
  if (ae && Array.isArray(ae.effects)) {
    // Stack: if an effect with the same key exists, bump stacks instead of adding duplicate
    const existing = ae.effects.find(e => e.key === effect.key);
    if (existing) {
      existing.stacks = (existing.stacks || 1) + 1;
      existing.turnsLeft = Math.max(existing.turnsLeft, effect.turnsLeft);
      return;
    }
    ae.effects.push(effect);
  } else {
    try { world.add(entityId, ActiveEffects, { effects: [effect] }); } catch {}
  }
}

// Rat bite: 25% chance → disease (8 turns, potency 1, stacks)
registerScript('monster:ratBite', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0001);
    if (rngInt(r, 1, 100) <= 25) {
      pushEffect(world, ctx.defender, { key: 'disease', turnsLeft: 8, potency: 1, stacks: 1 });
      try { world.emit('proc:diseased', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Spider bite: 30% chance → poison (5 turns, potency 2, stacks)
registerScript('monster:spiderBite', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0002);
    if (rngInt(r, 1, 100) <= 30) {
      pushEffect(world, ctx.defender, { key: 'poison', turnsLeft: 5, potency: 2, stacks: 1 });
      try { world.emit('proc:poisoned', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Wraith touch: 20% chance → drain life (heal self for 1/3 of damage dealt)
registerScript('monster:wraithTouch', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0003);
    if (rngInt(r, 1, 100) <= 20) {
      const amt = Math.max(1, Math.floor(ctx.damage / 3));
      ctx.healAttacker(amt);
      try { world.emit('proc:drain', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch {}
    }
  },
});

// Dragon claw: 20% chance → burn (5 turns, potency 4)
registerScript('monster:dragonClaw', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0004);
    if (rngInt(r, 1, 100) <= 20) {
      pushEffect(world, ctx.defender, { key: 'burn', turnsLeft: 5, potency: 4, stacks: 1 });
      try { world.emit('proc:burning', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});
