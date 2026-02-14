// Monster innate on-hit scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { mulberry32, rngInt, combatSeed } from "../utils/rng.js";
import { degradeFloorMemory } from '../environment/dungeon/transition.js';
import { Brain } from '../components/Brain.js';
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

// Wraith touch: 20% chance → drain life (heal self for 1/3 of damage dealt)
registerScript('monster:wraithTouch', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead0003));
    if (rngInt(r, 1, 100) <= 20) {
      const amt = Math.max(1, Math.floor(ctx.damage / 3));
      ctx.healAttacker(amt);
      try { world.emit('proc:drain', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch {}
    }
  },
});


// Orc rage: 25% chance → +2 bonus damage (onBeforeHit)
registerScript('monster:orcRage', {
  [ScriptVerb.AffixOnBeforeHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead0007));
    if (rngInt(r, 1, 100) <= 25) {
      ctx.damage += 2;
      try { world.emit('proc:rage', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Skeleton reassemble: 20% chance → self-heal 2 HP when damaged
registerScript('monster:skeletonReassemble', {
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead0008));
    if (rngInt(r, 1, 100) <= 20) {
      ctx.heal(ctx.defender, 2);
      try { world.emit('proc:reassemble', { actor: ctx.defender }); } catch {}
    }
  },
});

// Troll smash: onHit self-apply regen + onDamaged 30% instant self-heal
registerScript('monster:trollSmash', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    pushEffect(world, ctx.attacker, { key: 'regen', turnsLeft: 3, potency: 2, stacks: 1 });
  },
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead0009));
    if (rngInt(r, 1, 100) <= 30) {
      ctx.heal(ctx.defender, 1);
      try { world.emit('proc:regenerate', { actor: ctx.defender }); } catch {}
    }
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
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    ctx.retaliate(2);
    try { world.emit('proc:hellfire', { actor: ctx.defender }); } catch {}
  },
});

// Lich drain: onHit 25% life drain + onDamaged 20% phylactery regen
registerScript('monster:lichDrain', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world.seed, world.step, ctx.attacker, ctx.defender, 0xdead000c));
    if (rngInt(r, 1, 100) <= 25) {
      const amt = Math.max(1, Math.floor(ctx.damage / 2));
      ctx.healAttacker(amt);
      try { world.emit('proc:drain', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch {}
    }
  },
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
