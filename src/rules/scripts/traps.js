import { registerScript, ScriptVerb } from "../scripting.js";
import { Vitality } from "../components/Vitality.js";
import { Position } from "../components/Position.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";
import { getMonster } from "../data/monsters.js";
import { dealDamage } from "../utils/dealDamage.js";
import { attach } from "../../lib/ecs-js/hierarchy.js";

// Spike trap: deals percentage of max HP as damage.
// Params: { percent?: number } // 0..1
registerScript('trap_spike', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const target = Number(ctx?.targetId || 0) || 0;
    if (!world.isAlive(target)) return;
    const vit = world.get(target, Vitality);
    if (!vit) return;
    const pos = world.get(target, Position);
    const pct = Math.max(0, Math.min(1, Number(ctx?.params?.percent ?? 0.5)));
    const amount = Math.max(1, Math.floor(vit.maxHp * pct));
    dealDamage(world, {
      target,
      amount,
      source: Number(ctx?.trapId || 0) || 0,
      type: 'pierce',
      cause: 'spike_trap',
      at: pos ? { x: pos.x, y: pos.y } : undefined,
    });
  }
});

// Shock trap: deals electric damage and applies the 'shocked' status for 2 turns.
// Params: { percent?: number } // 0..1 fraction of max HP
registerScript('trap_shock', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const target = Number(ctx?.targetId || 0) || 0;
    if (!world.isAlive(target)) return;
    const vit = world.get(target, Vitality);
    if (!vit) return;
    const pos = world.get(target, Position);
    const pct = Math.max(0, Math.min(1, Number(ctx?.params?.percent ?? 0.30)));
    const amount = Math.max(1, Math.floor(vit.maxHp * pct));
    dealDamage(world, {
      target,
      amount,
      source: Number(ctx?.trapId || 0) || 0,
      type: 'lightning',
      cause: 'shock_trap',
      at: pos ? { x: pos.x, y: pos.y } : undefined,
    });
    // Apply shocked via ActiveEffects so effectSystem picks it up
    const _ae = world.get(target, ActiveEffects);
    if (_ae && Array.isArray(_ae.effects)) {
      // ~8% maxHp per tick for 3 ticks — brutal follow-on jolt
      _ae.effects.push({ key: 'shock', turnsLeft: 3, potency: Math.max(3, Math.floor(vit.maxHp * 0.08)) });
    }
  }
});

// Snake trap: spawns a cluster of snakes around the trigger point.
// Params: { count?: number } — number of snakes (default 3)
registerScript('trap_snake', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const trapId = Number(ctx?.trapId || 0) || 0;
    const trapPos = world.get(trapId, Position);
    if (!trapPos) return;

    const snakeDef = getMonster('snake');
    if (!snakeDef) return;

    const count = Number(ctx?.params?.count ?? 4);
    // Offsets for adjacent tiles (cardinal + diagonal)
    const offsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (let i = 0; i < count && i < offsets.length; i++) {
      const [dx, dy] = offsets[i];
      const child = createFrom(world, Monster, {
        x: trapPos.x + dx,
        y: trapPos.y + dy,
        name: snakeDef.name,
        identity: snakeDef.id,
        maxHp: snakeDef.baseHp,
        faction: 'enemy',
        accuracyDerived: snakeDef.attack,
        damagePowerDerived: snakeDef.attack,
        evadeDerived: snakeDef.defense,
        naturalDamageDice: snakeDef.damageDice,
        sizeClass: snakeDef.sizeClass,
        massKg: snakeDef.massKg,
        resistances: snakeDef.resistances,
        speed: snakeDef.speed,
      });
      // Attach to the trap entity so destroySubtree cleans up on floor transition.
      try { attach(world, child, trapId); } catch (e) { console.error('[traps] hierarchy attach failed:', e); }
    }
  }
});
