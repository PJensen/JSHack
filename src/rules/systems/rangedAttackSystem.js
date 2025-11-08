// src/rules/systems/rangedAttackSystem.js
// Processes RangedAttackIntent: finds a forward target, applies hit/damage, emits instant VFX.

import { RangedAttackIntent } from '../components/Intents/RangedAttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Position } from '../components/Position.js';
import { Facing } from '../components/Facing.js';
import { Vitality } from '../components/Vitality.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { mulberry32, rngInt } from '../../lib/ecs-js/rng.js';
import { DungeonGeometry } from '../components/DungeonGeometry.js';
import { GeometryKernel } from '../environment/GeometryKernel.js';

/** @param {import('../../lib/ecs-js').World} world */
export function rangedAttackSystem(world) {
  for (const [actor, intent] of world.query(RangedAttackIntent)) {
    // Require equipped bow-like weapon
    const eq = world.get(actor, Equipment);
    const weaponId = eq?.weapon || 0;
    const wName = weaponId ? /** @type any */(world.get(weaponId, NamedIdentity)) : null;
    const wInfo = weaponId ? /** @type any */(world.get(weaponId, ItemInfo)) : null;
    const isBow = !!(wName && typeof wName.identity === 'string' && wName.identity.startsWith('bow_'));
    if (!weaponId || !wInfo || !isBow) { world.remove(actor, RangedAttackIntent); continue; }

    const apos = world.get(actor, Position);
    const facing = /** @type any */ (world.get(actor, Facing)) || { x: 1, y: 0 };
    if (!apos) { world.remove(actor, RangedAttackIntent); continue; }

    const RANGE = 12;
    const CONE_DOT = Math.cos(Math.PI / 10); // ~18° facing acceptance
    const d2 = (x0,y0,x1,y1)=>{ const dx=x1-x0, dy=y1-y0; return dx*dx+dy*dy; };

    // Build occlusion kernel from DungeonGeometry snapshot
    let kernel = null;
    for (const [, geom] of world.query(DungeonGeometry)) { if (geom) { kernel = new GeometryKernel(geom.options || {}); kernel.deserialize(geom); break; } }

    // Targeted shot: validate LOS and facing; otherwise default to impact in facing
    let target = null;
    if ((intent.targetId|0) > 0) {
      const tid = intent.targetId | 0;
      const p = world.get(tid, Position);
      const ni = world.get(tid, NamedIdentity);
      const vit = world.get(tid, Vitality);
      if (p && ni && ni.identity === 'monster' && vit && (vit.hp|0) > 0) {
        // Verify in front (facing), and not occluded (distance unconstrained)
        const ddx = p.x - apos.x, ddy = p.y - apos.y; const dist = Math.hypot(ddx, ddy) || 1;
        const dot = (ddx / dist) * (facing.x||1) + (ddy / dist) * (facing.y||0);
        if (dot >= CONE_DOT) {
          let clear = true;
          if (kernel) {
            const ray = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: ddx, y: ddy }, dist);
            if (ray && ray.hit && ray.t < dist - 1e-3) clear = false;
          }
          if (clear) target = { id: tid, x: p.x, y: p.y, dist2: dist*dist };
        }
      }
    }
    // Desired aim: target pos if provided; otherwise strict forward centerline from current facing
    let desired = target ? { x: target.x, y: target.y } : null;
    if (!desired) {
      const fmag = Math.hypot(facing.x || 0, facing.y || 0) || 1;
      const fx = (facing.x || 0) / fmag;
      const fy = (facing.y || 0) / fmag;
      desired = { x: apos.x + fx * RANGE, y: apos.y + fy * RANGE };
    }

    // Clip to occlusion
    let finalTo = { x: desired.x, y: desired.y };
    if (kernel) {
      const dirx = desired.x - apos.x;
      const diry = desired.y - apos.y;
      const dist = Math.hypot(dirx, diry) || RANGE;
      // For forward shots, extend ray long so it properly finds far walls
      const maxT = target ? dist : Math.max(dist, 64);
      const ray = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: dirx, y: diry }, maxT);
      if (ray && ray.hit) {
        finalTo = { x: ray.point.x, y: ray.point.y };
      }
    }

    // Emit shot VFX (display handles style)
    try { world.emit && world.emit('ranged:shot', { from: { x: apos.x, y: apos.y }, to: finalTo, style: 'flame' }); } catch {}

    if (target) {
      // If occluded path shortened before target, do impact spark and finish (no damage)
      if ((Math.abs(finalTo.x - target.x) > 1e-3) || (Math.abs(finalTo.y - target.y) > 1e-3)) {
        try { world.emit && world.emit('ranged:impact', { at: { x: finalTo.x, y: finalTo.y }, style: 'flame' }); } catch {}
        world.remove(actor, RangedAttackIntent);
        continue;
      }
      // To-hit resolution similar to melee (deterministic RNG)
      const atkBonus = 1 + (eq?.attackDerived || 0);
      const defEq = world.get(target.id, Equipment);
      const armorClass = 10 + (defEq?.defenseDerived || 0);
      const seed = (world.seed >>> 0) ^ ((world.step|0) * 0x9e3779b9 >>> 0) ^ (actor >>> 0) ^ ((target.id << 16) >>> 0);
      const r = mulberry32(seed >>> 0);
      const d20 = rngInt(r, 1, 20);
      const totalToHit = d20 + atkBonus;
      const isCrit = d20 === 20;
      const isNat1 = d20 === 1;
      if (!isCrit && (isNat1 || totalToHit < armorClass)) {
        // Miss feedback (display logs/status)
        try { world.emit && world.emit('status', { id: target.id, kind: 'miss', text: 'MISS', source: actor }); } catch {}
        try { world.emit && world.emit('ranged:impact', { at: { x: finalTo.x, y: finalTo.y }, style: 'flame' }); } catch {}
        world.remove(actor, RangedAttackIntent);
        continue;
      }

      // Roll bow damage; default to 1d4 if unspecified
      const spec = (typeof wInfo.damageDice === 'string' && wInfo.damageDice) ? wInfo.damageDice : '1d4';
      const dmg = rollDice(spec, r) + Math.max(0, Math.floor((eq?.attackDerived || 0) / 2));
      const finalDmg = Math.max(0, isCrit ? (dmg * 2) : dmg);

      const tv = world.get(target.id, Vitality);
      if (tv) {
        tv.hp = Math.max(0, tv.hp - finalDmg);
        try { world.emit && world.emit('damaged', { target: target.id, amount: finalDmg, source: actor, critical: isCrit }); } catch {}
        try { world.emit && world.emit('ranged:impact', { at: { x: finalTo.x, y: finalTo.y }, style: 'flame' }); } catch {}
        if ((tv.hp|0) <= 0) { try { world.emit && world.emit('died', { id: target.id, killer: actor }); } catch {} }
        else {
          // Add a small burning DoT for flaming arrow flavor
          const ae = /** @type any */ (world.get(target.id, ActiveEffects));
          const eff = { key: 'burning', turnsLeft: 2, potency: 1 };
          if (ae && Array.isArray(ae.effects)) ae.effects.push(eff);
          else { try { world.add(target.id, ActiveEffects, { effects: [eff] }); } catch {} }
        }
      }
    } else {
      // No target: if we clipped on geometry, add impact spark at final point
      try { world.emit && world.emit('ranged:impact', { at: { x: finalTo.x, y: finalTo.y }, style: 'flame' }); } catch {}
    }

    world.remove(actor, RangedAttackIntent);
  }
}

// Dice helpers (copy from combatSystem for consistency)
/** @param {string} spec @param {() => number} rng */
function rollDice(spec, rng) {
  const m = /^\s*(\d+)d(\d+)\s*$/i.exec(String(spec||''));
  if (!m) return 1;
  const cStr = m[1] || '1';
  const sStr = m[2] || '2';
  const count = Math.max(1, (parseInt(cStr,10)|0));
  const sides = Math.max(2, (parseInt(sStr,10)|0));
  let sum = 0;
  for (let i=0;i<count;i++) sum += rngInt(rng, 1, sides);
  return sum;
}
