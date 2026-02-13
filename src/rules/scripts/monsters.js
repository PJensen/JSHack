// Monster innate on-hit scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { mulberry32, rngInt } from "../../lib/ecs-js/rng.js";
import { degradeFloorMemory } from '../environment/dungeon/transition.js';
import { Brain } from '../components/Brain.js';

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

// Rat bite: 25% chance → disease (20 turns, potency 1, stacks)
// Disease doesn't deal damage — it weakens the victim (-1 attack, -1 defense per stack).
// Each subsequent bite has a chance to add another stack and refresh duration.
registerScript('monster:ratBite', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0001);
    if (rngInt(r, 1, 100) <= 25) {
      pushEffect(world, ctx.defender, { key: 'disease', turnsLeft: 20, potency: 1, stacks: 1 });
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

// Snake bite: 25% chance → poison (5 turns, potency 1, stacks)
registerScript('monster:snakeBite', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000f);
    if (rngInt(r, 1, 100) <= 25) {
      pushEffect(world, ctx.defender, { key: 'poison', turnsLeft: 5, potency: 1, stacks: 1 });
      try { world.emit('proc:poisoned', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Goblin shiv: 20% chance → bleed (3 turns, potency 1, stacks)
registerScript('monster:goblinShiv', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0005);
    if (rngInt(r, 1, 100) <= 20) {
      pushEffect(world, ctx.defender, { key: 'bleed', turnsLeft: 3, potency: 1, stacks: 1 });
      try { world.emit('proc:bleeding', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Bat screech: 15% chance → stun (1 turn)
registerScript('monster:batScreech', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0006);
    if (rngInt(r, 1, 100) <= 15) {
      pushEffect(world, ctx.defender, { key: 'stun', turnsLeft: 1, potency: 1, stacks: 1 });
      try { world.emit('proc:stunned', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Orc rage: 25% chance → +2 bonus damage (onBeforeHit)
registerScript('monster:orcRage', {
  [ScriptVerb.AffixOnBeforeHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0007);
    if (rngInt(r, 1, 100) <= 25) {
      ctx.damage += 2;
      try { world.emit('proc:rage', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Skeleton reassemble: 20% chance → self-heal 2 HP when damaged
registerScript('monster:skeletonReassemble', {
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0008);
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
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0009);
    if (rngInt(r, 1, 100) <= 30) {
      ctx.heal(ctx.defender, 1);
      try { world.emit('proc:regenerate', { actor: ctx.defender }); } catch {}
    }
  },
});

// Ogre crush: 25% chance → stun (2 turns)
registerScript('monster:ogreCrush', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000a);
    if (rngInt(r, 1, 100) <= 25) {
      pushEffect(world, ctx.defender, { key: 'stun', turnsLeft: 2, potency: 1, stacks: 1 });
      try { world.emit('proc:stunned', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Demon hellfire: onHit 30% burn + onDamaged fire retaliation
registerScript('monster:demonHellfire', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000b);
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
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000c);
    if (rngInt(r, 1, 100) <= 25) {
      const amt = Math.max(1, Math.floor(ctx.damage / 2));
      ctx.healAttacker(amt);
      try { world.emit('proc:drain', { actor: ctx.attacker, target: ctx.defender, amount: amt }); } catch {}
    }
  },
  [ScriptVerb.AffixOnDamaged]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000d);
    if (rngInt(r, 1, 100) <= 20) {
      pushEffect(world, ctx.defender, { key: 'regen', turnsLeft: 3, potency: 2, stacks: 1 });
      try { world.emit('proc:phylactery', { actor: ctx.defender }); } catch {}
    }
  },
});

// Grid bug zap: 30% chance → shock (2 turns, potency 1)
registerScript('monster:gridBugZap', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead0010);
    if (rngInt(r, 1, 100) <= 30) {
      pushEffect(world, ctx.defender, { key: 'shock', turnsLeft: 2, potency: 1, stacks: 1 });
      try { world.emit('proc:shocked', { actor: ctx.attacker, target: ctx.defender }); } catch {}
    }
  },
});

// Mind flayer blast: 20% chance → fragmentary map memory loss on a random floor
registerScript('monster:mindflayerBlast', {
  [ScriptVerb.AffixOnHit]: (world, ctx) => {
    const r = mulberry32(combatSeed(world, ctx) ^ 0xdead000e);
    if (rngInt(r, 1, 100) <= 20) {
      const { depth } = degradeFloorMemory(r, { fraction: 0.3 });
      const brain = world.get(ctx.defender, Brain);
      if (brain) brain.learnedSpellIds = [];
      pushEffect(world, ctx.defender, { key: 'mindwipe', turnsLeft: 2, potency: 1, stacks: 1 });
      try { world.emit('proc:mindwipe', { actor: ctx.attacker, target: ctx.defender, affectedDepth: depth }); } catch {}
    }
  },
});
