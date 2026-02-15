import { registerScript, ScriptVerb } from "../scripting.js";
import { Vitality } from "../components/Vitality.js";
import { Position } from "../components/Position.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Monster } from "../archetypes/Creatures.js";
import { getMonster } from "../data/monsters.js";
import { dealDamage } from "../utils/dealDamage.js";

// Spike trap: deals percentage of max HP as damage.
// Params: { percent?: number } // 0..1
registerScript('trap_spike', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const target = Number(ctx?.targetId || 0) || 0;
    if (!world.isAlive(target)) return;
    const vit = world.get(target, Vitality);
    if (!vit) return;
    const pos = world.get(target, Position);
    const pct = Math.max(0, Math.min(1, Number(ctx?.params?.percent ?? 0.2)));
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

// Snake trap: spawns a cluster of snakes around the trigger point.
// Params: { count?: number } — number of snakes (default 3)
registerScript('trap_snake', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const trapId = Number(ctx?.trapId || 0) || 0;
    const trapPos = world.get(trapId, Position);
    if (!trapPos) return;

    const snakeDef = getMonster('snake');
    if (!snakeDef) return;

    const count = Number(ctx?.params?.count ?? 3);
    // Offsets for adjacent tiles (cardinal + diagonal)
    const offsets = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
    for (let i = 0; i < count && i < offsets.length; i++) {
      const [dx, dy] = offsets[i];
      createFrom(world, Monster, {
        x: trapPos.x + dx,
        y: trapPos.y + dy,
        name: snakeDef.name,
        identity: snakeDef.id,
        maxHp: snakeDef.baseHp,
        faction: 'enemy',
        attackDerived: snakeDef.attack,
        defenseDerived: snakeDef.defense,
        naturalDamageDice: snakeDef.damageDice,
        sizeClass: snakeDef.sizeClass,
        massKg: snakeDef.massKg,
        resistances: snakeDef.resistances,
        speed: snakeDef.speed,
      });
    }
  }
});
