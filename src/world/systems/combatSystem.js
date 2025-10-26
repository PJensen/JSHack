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
import { Hallucination } from '../components/Hallucination.js';

function rand01(world){
  try { return typeof world.rand === 'function' ? world.rand() : Math.random(); }
  catch(_) { return Math.random(); }
}

function rollD20(world){ return 1 + ((rand01(world) * 20) | 0); }

function computeHitAndDamage(world, attackerId, targetId){
  // Defaults
  let atkMin = 3, atkMax = 6, attackBonus = 0, critChance = 0.1, critMult = 1.5;
  let targetAC = 10;
  // Pull attacker stats
  const a = world.get(attackerId, CombatStats);
  if (a){
    if (typeof a.atkMin === 'number') atkMin = a.atkMin;
    if (typeof a.atkMax === 'number') atkMax = a.atkMax;
    if (typeof a.attackBonus === 'number') attackBonus = a.attackBonus;
    if (typeof a.critChance === 'number') critChance = a.critChance;
    if (typeof a.critMult === 'number') critMult = a.critMult;
  }
  // Pull defender stats
  const d = world.get(targetId, CombatStats);
  if (d){
    if (typeof d.armorClass === 'number') targetAC = d.armorClass;
  }
  // Equipment-derived adjustments
  const eqA = world.get(attackerId, Equipment);
  if (eqA && typeof eqA.attackDerived === 'number'){
    atkMin += eqA.attackDerived|0;
    atkMax += eqA.attackDerived|0;
  }
  // Ensure sane bounds
  if (atkMax < atkMin) atkMax = atkMin;

  const d20 = rollD20(world);
  const natural = d20;
  const total = d20 + (attackBonus|0);
  // Critical: natural 20 always hits and crits; natural 1 always misses
  let hit = false, crit = false;
  if (natural === 1) { hit = false; }
  else if (natural === 20) { hit = true; crit = true; }
  else { hit = total >= (targetAC|0); }

  if (!hit) return { hit:false, crit:false, damage:0, d20:natural, total, targetAC };

  const base = atkMin + ((rand01(world) * (atkMax - atkMin + 1)) | 0);
  const rolledCrit = !crit && (rand01(world) < Math.max(0, Math.min(1, critChance)));
  crit = crit || rolledCrit;
  const dmg = Math.max(0, Math.floor(crit ? base * critMult : base));
  return { hit:true, crit, damage:dmg, d20:natural, total, targetAC };
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

    const hit = computeHitAndDamage(world, attacker, target);
    if (!hit.hit){
      // Miss feedback (subtle)
      try {
        spawnFloatText(world, tPos.x, tPos.y, ftPreset('Pop', { text: 'miss', color: '#aaa' }));
      } catch(_){}
      try{ world.emit('combat:miss', { attacker, target, d20: hit.d20, total: hit.total, targetAC: hit.targetAC }); }catch(_){ }
      try{ world.destroy(eid); }catch(_){ }
      continue;
    }

    // // Additional fumble chance when the attacker is hallucinating: scales with intensity.
    // // This increases the chance to miss while hallucinating, as requested.
    // try {
    //   const h = world.get(attacker, Hallucination);
    //   if (h){
    //     const intensity = Math.max(0, Math.min(1, (typeof h.intensity === 'number' ? h.intensity : (typeof h.strength === 'number' ? h.strength : 0))));
    //     const extraMissAtFull = 0.35; // 35% extra miss chance at full intensity (tunable)
    //     if (intensity > 0 && hit.d20 !== 20){
    //       const p = intensity * extraMissAtFull;
    //       if (rand01(world) < p){
    //         // Treat as miss due to hallucination
    //         try { spawnFloatText(world, tPos.x, tPos.y, ftPreset('Pop', { text: 'miss', color: '#aa8' })); } catch(_){ }
    //         try { world.emit('combat:miss', { attacker, target, reason: 'hallucination', d20: hit.d20, total: hit.total, targetAC: hit.targetAC }); } catch(_){ }
    //         try { world.destroy(eid); } catch(_){ }
    //         continue;
    //       }
    //     }
    //   }
    // } catch(_){ }

    const mitigation = computeDefenseMitigation(world, target);
    const finalDmg = Math.max(1, hit.damage - mitigation);

    // Apply damage
    const newHp = Math.max(0, (tHealth.hp|0) - finalDmg);
    world.set(target, Health, { hp: newHp });

    // Spawn float text for damage
    try {
      const color = hit.crit ? '#ff0000ff' : '#981e1eff';
      const presetName = hit.crit ? 'Arc' : 'Arc';
      const value = hit.crit ? finalDmg * 2 : finalDmg;
      // Provide numeric value so base size scales with damage (spawner applies diminishing returns)
      spawnFloatText(world, tPos.x, tPos.y, 
        ftPreset(presetName, { text: `-${finalDmg}`, color, value: value }));
      // Optional subtle particles on crit
      // if (isCrit){
      //   spawnParticleBurst(world, { x: tPos.x, y: tPos.y, count: 12, speed: 0.8, life: 0.4, color: '#ffa07a', size: 0.8, sizeEnd: 0.1, ay: -0.4 });
      // }
    } catch(_){ /* effects optional */ }

    // Emit event for other systems/UI
    try{
      world.emit('combat:hit', {
        attacker, target,
        damage: finalDmg,
        crit: hit.crit,
        targetHp: newHp
      });
    } catch(_){ }

    // Extensible on-hit callback: if the attacker has Monster.onHit, invoke it
    try {
      const mon = world.get(attacker, Monster);
      if (mon && typeof mon.onHit === 'function'){
        mon.onHit(world, attacker, target);
      }
    } catch(_){ /* ignore proc application errors */ }

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
