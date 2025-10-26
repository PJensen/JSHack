// combatSystem.js
// Processes MeleeAttack intents to resolve melee combat.
// Calculation pulls from CombatStats and optionally Equipment-derived bonuses.
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Player } from '../components/Player.js';
import { Monster } from '../components/Monster.js';
import { Equipment } from '../components/Equipment.js';
import { Dead } from '../components/Dead.js';
import { Glyph } from '../components/Glyph.js';
import { Collider } from '../components/Collider.js';
import { CombatStats } from '../components/CombatStats.js';
import { MeleeAttack } from '../components/MeleeAttack.js';
import { spawnFloatText, spawnParticleBurst } from './effects/spawner.js';
import { ftPreset } from './effects/floatTextPresets.js';

function rand01(world){
  try { return typeof world.rand === 'function' ? world.rand() : Math.random(); }
  catch(_) { return Math.random(); }
}

function computeAttackRoll(world, attackerId){
  // Defaults
  let atkMin = 3, atkMax = 6, critChance = 0.1, critMult = 1.5;
  // Pull CombatStats if present
  const cs = world.get(attackerId, CombatStats);
  if (cs){
    if (typeof cs.atkMin === 'number') atkMin = cs.atkMin;
    if (typeof cs.atkMax === 'number') atkMax = cs.atkMax;
    if (typeof cs.critChance === 'number') critChance = cs.critChance;
    if (typeof cs.critMult === 'number') critMult = cs.critMult;
  }
  // Add equipment-derived attack bonuses
  const eq = world.get(attackerId, Equipment);
  if (eq && typeof eq.attackDerived === 'number'){
    atkMin += eq.attackDerived|0;
    atkMax += eq.attackDerived|0;
  }
  // Ensure sane bounds
  if (atkMax < atkMin) atkMax = atkMin;
  const base = atkMin + ((rand01(world) * (atkMax - atkMin + 1)) | 0);
  const isCrit = rand01(world) < Math.max(0, Math.min(1, critChance));
  const dmg = Math.max(0, Math.floor(isCrit ? base * critMult : base));
  return { dmg, isCrit };
}

function computeDefenseMitigation(world, targetId){
  let def = 0;
  const cs = world.get(targetId, CombatStats);
  if (cs && typeof cs.defense === 'number') def += cs.defense;
  const eq = world.get(targetId, Equipment);
  if (eq && typeof eq.defenseDerived === 'number') def += eq.defenseDerived;
  return Math.max(0, def|0);
}

function applyDeath(world, targetId){
  // Mark dead; lighten up collider; optionally change glyph
  try { if (!world.has(targetId, Dead)) world.add(targetId, Dead, { dead: true }); else world.set(targetId, Dead, { dead: true }); } catch(_){}
  try { const col = world.get(targetId, Collider); if (col && col.solid) world.set(targetId, Collider, { solid: false }); } catch(_){}
  try {
    const g = world.get(targetId, Glyph);
    if (g){
      // Soft tombstone marker
      if (!g.char || g.char === '🧟' || g.char === '@'){
        world.set(targetId, Glyph, { char: '†', fg: '#777' });
      }
    }
  } catch(_){}
}

export function combatSystem(world){
  const pending = [];
  for (const [eid, atk] of world.query(MeleeAttack)){
    pending.push([eid, atk]);
  }
  for (const [eid, atk] of pending){
    const attacker = atk.attacker; const target = atk.target;
    if (attacker == null || target == null){ try{ world.destroy(eid); }catch(_){ } continue; }
    const tHealth = world.get(target, Health);
    if (!tHealth){ try{ world.destroy(eid); }catch(_){ } continue; }
    const tPos = world.get(target, Position) || { x: atk.x ?? 0, y: atk.y ?? 0 };

    const { dmg, isCrit } = computeAttackRoll(world, attacker);
    const mitigation = computeDefenseMitigation(world, target);
    const finalDmg = Math.max(1, dmg - mitigation);

    // Apply damage
    const newHp = Math.max(0, (tHealth.hp|0) - finalDmg);
    world.set(target, Health, { hp: newHp });

    // Spawn float text for damage
    try {
      const color = isCrit ? '#ffd1a1' : '#ff6e6e';
      const presetName = isCrit ? 'Shatter' : 'Feather';
      spawnFloatText(world, tPos.x, tPos.y, ftPreset(presetName, { text: `-${finalDmg}`, color }));
      // Optional subtle particles on crit
      if (isCrit){
        spawnParticleBurst(world, { x: tPos.x, y: tPos.y, count: 12, speed: 0.8, life: 0.4, color: '#ffa07a', size: 0.8, sizeEnd: 0.1, ay: -0.4 });
      }
    } catch(_){ /* effects optional */ }

    // Emit event for other systems/UI
    try{
      world.emit('combat:hit', {
        attacker, target,
        damage: finalDmg,
        crit: isCrit,
        targetHp: newHp
      });
    } catch(_){ }

    if (newHp <= 0){
      applyDeath(world, target);
      try{
        world.emit('combat:kill', { attacker, target });
      } catch(_){ }
    }

    // Consume the intent entity
    try{ world.destroy(eid); }catch(_){ }
  }
}

export default combatSystem;
