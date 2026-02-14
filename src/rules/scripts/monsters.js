// Monster innate on-hit scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { mulberry32, rngInt, combatSeed } from "../utils/rng.js";
import { degradeFloorMemory } from '../environment/dungeon/transition.js';
import { Brain } from '../components/Brain.js';
import { MONSTER_COMBAT_PROC_DEFS } from "../data/monsterCombatProcs.js";
import { MONSTER_STATUS_PROC_DEFS } from "../data/monsterStatusProcs.js";


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

const TRIGGER_TO_VERB = Object.freeze({
  onHit: ScriptVerb.AffixOnHit,
  onBeforeHit: ScriptVerb.AffixOnBeforeHit,
  onDamaged: ScriptVerb.AffixOnDamaged,
});

for (let i = 0; i < MONSTER_STATUS_PROC_DEFS.length; i++) {
  const def = MONSTER_STATUS_PROC_DEFS[i];
  const verb = TRIGGER_TO_VERB[def.trigger];
  if (!verb || !def.script) continue;

  registerScript(def.script, {
    [verb]: (world, ctx) => {
      const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, def.seedSalt));
      if (rngInt(r, 1, 100) <= def.chancePct) {
        pushEffect(world, ctx.defender, { ...def.effect });
        if (def.emitEvent) {
          try { world.emit(def.emitEvent, { actor: ctx.attacker, target: ctx.defender }); } catch {}
        }
      }
    },
  });
}

/**
 * @param {any} action
 * @param {any} ctx
 */
function executeCombatProcAction(action, ctx) {
  const kind = String(action?.kind || '');
  if (!kind) return { ok: false, amount: 0 };

  if (kind === 'add_damage_flat') {
    const amount = Number(action.amount || 0) | 0;
    ctx.damage += amount;
    return { ok: true, amount };
  }

  if (kind === 'heal_attacker_fraction_damage') {
    const numerator = Math.max(1, Number(action.numerator || 1) | 0);
    const denominator = Math.max(1, Number(action.denominator || 1) | 0);
    const minAmount = Math.max(0, Number(action.minAmount || 0) | 0);
    const amount = Math.max(minAmount, Math.floor((Number(ctx.damage || 0) * numerator) / denominator));
    if (typeof ctx.healAttacker === 'function') ctx.healAttacker(amount);
    return { ok: true, amount };
  }

  if (kind === 'heal_defender_flat') {
    const amount = Math.max(0, Number(action.amount || 0) | 0);
    if (typeof ctx.heal === 'function') ctx.heal(ctx.defender, amount);
    return { ok: true, amount };
  }

  if (kind === 'retaliate_flat') {
    const amount = Math.max(0, Number(action.amount || 0) | 0);
    if (typeof ctx.retaliate === 'function') ctx.retaliate(amount);
    return { ok: true, amount };
  }

  return { ok: false, amount: 0 };
}

/**
 * @param {any} world
 * @param {any} ctx
 * @param {any} def
 * @param {number} amount
 */
function emitCombatProc(world, ctx, def, amount) {
  if (!def.emitEvent) return;
  const payloadMode = String(def.eventSchema || 'attacker_defender');
  const payload = {};

  if (payloadMode === 'defender_only') {
    payload.actor = ctx.defender;
  } else {
    payload.actor = ctx.attacker;
    payload.target = ctx.defender;
  }
  if (def.includeAmount) payload.amount = amount;

  try { world.emit(def.emitEvent, payload); } catch {}
}

for (let i = 0; i < MONSTER_COMBAT_PROC_DEFS.length; i++) {
  const def = MONSTER_COMBAT_PROC_DEFS[i];
  const verb = TRIGGER_TO_VERB[def.trigger];
  if (!verb || !def.script) continue;

  registerScript(def.script, {
    [verb]: (world, ctx) => {
      const chance = Number(def.chancePct || 0) | 0;
      if (chance < 100) {
        const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, def.seedSalt));
        if (rngInt(r, 1, 100) > chance) return;
      }
      const result = executeCombatProcAction(def.action, ctx);
      if (!result.ok) return;
      emitCombatProc(world, ctx, def, result.amount);
    },
  });
}

// Troll smash: onHit self-apply regen + onDamaged 30% instant self-heal
registerScript('monster:trollSmash', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    pushEffect(world, ctx.attacker, { key: 'regen', turnsLeft: 3, potency: 2, stacks: 1 });
  },
});


// Demon hellfire: onHit 30% burn + onDamaged fire retaliation
registerScript('monster:demonHellfire', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead000b));
    if (rngInt(r, 1, 100) <= 30) {
      pushEffect(world, ctx.defender, { key: 'burn', turnsLeft: 4, potency: 3, stacks: 1 });
      try { world.emit('proc:burning', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Lich drain: onHit 25% life drain + onDamaged 20% phylactery regen
registerScript('monster:lichDrain', {
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead000d));
    if (rngInt(r, 1, 100) <= 20) {
      pushEffect(world, ctx.defender, { key: 'regen', turnsLeft: 3, potency: 2, stacks: 1 });
      try { world.emit('proc:phylactery', { actor: ctx.defender }); } catch {}
    }
  },
});

// Mind flayer blast: 20% chance → fragmentary map memory loss on a random floor
registerScript('monster:mindflayerBlast', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead000e));
    if (rngInt(r, 1, 100) <= 20) {
      const { depth } = degradeFloorMemory(r, { fraction: 0.3 });
      const brain = world.get(ctx.defender, Brain);
      if (brain) brain.learnedSpellIds = [];
      pushEffect(world, ctx.defender, { key: 'mindwipe', turnsLeft: 2, potency: 1, stacks: 1 });
      try { world.emit('proc:mindwipe', { actor: ctx.attacker, target: ctx.defender, affectedDepth: depth }); } catch {}
    }
  },
});
