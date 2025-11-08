// src/rules/systems/rangedAttackSystem.js
// Processes RangedAttackIntent: orients actor, consumes ammo, resolves hits, emits VFX.

import { RangedAttackIntent } from '../components/Intents/RangedAttackIntent.js';
import { Equipment } from '../components/Equipment.js';
import { ItemInfo } from '../components/ItemInfo.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { Position } from '../components/Position.js';
import { Facing } from '../components/Facing.js';
import { Vitality } from '../components/Vitality.js';
import { ActiveEffects } from '../components/ActiveEffects.js';
import { Inventory } from '../components/Inventory.js';
import { mulberry32, rngInt } from '../../lib/ecs-js/rng.js';
import { DungeonGeometry } from '../components/DungeonGeometry.js';
import { GeometryKernel } from '../environment/GeometryKernel.js';

const DEFAULT_RANGE = 12;
const FOV_ANGLE = Math.PI * 0.75;
const HALF_FOV = FOV_ANGLE * 0.5;
const FOV_DOT = Math.cos(HALF_FOV);
const EPS = 1e-5;

/** @param {import('../../lib/ecs-js').World} world */
export function rangedAttackSystem(world) {
  for (const [actor, intent] of world.query(RangedAttackIntent)) {
    try {
      const eq = world.get(actor, Equipment);
      const weaponId = eq?.weapon || 0;
      const wName = weaponId ? /** @type any */(world.get(weaponId, NamedIdentity)) : null;
      const wInfo = weaponId ? /** @type any */(world.get(weaponId, ItemInfo)) : null;
      const isBow = !!(wName && typeof wName.identity === 'string' && wName.identity.startsWith('bow_'));
      if (!weaponId || !wInfo || !isBow) continue;

      const apos = world.get(actor, Position);
      if (!apos) continue;
      const facing = /** @type any */ (world.get(actor, Facing)) || { x: 1, y: 0 };

      const kernel = buildGeometryKernel(world);

      // Acquire explicit target (tap-target) if one exists and is valid within FOV.
      let target = resolveExplicitTarget(world, intent, actor, apos, facing, kernel);

      // Fallback: auto-acquire the nearest monster within the forward FOV arc.
      if (!target) {
        target = acquireForwardTarget(world, actor, apos, facing, kernel);
      }

      // Determine aim point for the shot.
      let desired = target ? { x: target.x, y: target.y } : null;
      if (!desired && Number.isFinite(intent.toX) && Number.isFinite(intent.toY)) {
        desired = { x: intent.toX, y: intent.toY };
      }
      if (!desired) {
        const dir = normalizeVec(facing.x || 1, facing.y || 0);
        desired = {
          x: apos.x + dir.x * DEFAULT_RANGE,
          y: apos.y + dir.y * DEFAULT_RANGE,
        };
      }

      const shotDir = { x: desired.x - apos.x, y: desired.y - apos.y };
      if (Math.hypot(shotDir.x, shotDir.y) > EPS) {
        applyFacing(world, actor, shotDir.x, shotDir.y);
      }

      const finalTo = clipShotToOcclusion(kernel, apos, desired, target);

      // Consume an arrow (equipped ammo takes priority). Abort if none.
      const ammoTemplate = consumeArrow(world, actor);
      if (!ammoTemplate) {
        try { world.emit && world.emit('status', { id: actor, kind: 'noammo', text: 'OUT OF ARROWS' }); } catch {}
        continue;
      }

      const vfxStyle = (ammoTemplate?.identity === 'ammo_arrows_flame') ? 'flame' : 'plain';
      try { world.emit && world.emit('ranged:shot', { from: { x: apos.x, y: apos.y }, to: finalTo, style: vfxStyle }); } catch {}

      if (!target) continue;

      if (isBlockedBeforeTarget(finalTo, target)) {
        continue;
      }

      const vit = world.get(target.id, Vitality);
      if (!vit || (vit.hp|0) <= 0) continue;

      const eqTarget = world.get(target.id, Equipment);
      const atkBonus = 1 + (eq?.attackDerived || 0);
      const armorClass = 10 + (eqTarget?.defenseDerived || 0);
      const seed = (world.seed >>> 0) ^ ((world.step|0) * 0x9e3779b9 >>> 0) ^ (actor >>> 0) ^ ((target.id << 16) >>> 0);
      const rng = mulberry32(seed >>> 0);
      const d20 = rngInt(rng, 1, 20);
      const totalToHit = d20 + atkBonus;
      const isCrit = d20 === 20;
      const isNat1 = d20 === 1;
      if (!isCrit && (isNat1 || totalToHit < armorClass)) {
        try { world.emit && world.emit('status', { id: target.id, kind: 'miss', text: 'MISS', source: actor }); } catch {}
        maybeReturnArrow(world, target.id, ammoTemplate, rng, false);
        continue;
      }

      const spec = (typeof wInfo.damageDice === 'string' && wInfo.damageDice) ? wInfo.damageDice : '1d4';
      const dmg = rollDice(spec, rng) + Math.max(0, Math.floor((eq?.attackDerived || 0) / 2));
      const finalDmg = Math.max(0, isCrit ? (dmg * 2) : dmg);

      vit.hp = Math.max(0, vit.hp - finalDmg);
      try { world.emit && world.emit('damaged', { target: target.id, amount: finalDmg, source: actor, critical: isCrit }); } catch {}
      if ((vit.hp|0) <= 0) {
        try { world.emit && world.emit('died', { id: target.id, killer: actor }); } catch {}
      } else {
        // Apply burning only if flaming arrows were used
        if (ammoTemplate?.identity === 'ammo_arrows_flame') {
          const ae = /** @type any */ (world.get(target.id, ActiveEffects));
          const eff = { key: 'burning', turnsLeft: 3, potency: 1 };
          if (ae && Array.isArray(ae.effects)) ae.effects.push(eff);
          else { try { world.add(target.id, ActiveEffects, { effects: [eff] }); } catch {} }
        }
      }

      maybeReturnArrow(world, target.id, ammoTemplate, rng, true);
    } finally {
      try { world.remove(actor, RangedAttackIntent); } catch {}
    }
  }
}

function buildGeometryKernel(world) {
  for (const [, geom] of world.query(DungeonGeometry)) {
    if (!geom) continue;
    const kernel = new GeometryKernel(geom.options || {});
    kernel.deserialize(geom);
    return kernel;
  }
  return null;
}

function resolveExplicitTarget(world, intent, actor, apos, facing, kernel) {
  const tid = intent?.targetId | 0;
  if (!tid) return null;
  const pos = world.get(tid, Position);
  const ni = world.get(tid, NamedIdentity);
  const vit = world.get(tid, Vitality);
  if (!pos || !ni || ni.identity !== 'monster' || !vit || (vit.hp|0) <= 0) return null;

  const dx = pos.x - apos.x;
  const dy = pos.y - apos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dot = (dx / dist) * (facing.x || 1) + (dy / dist) * (facing.y || 0);
  if (dot < FOV_DOT) return null;

  if (kernel) {
    const ray = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: dx, y: dy }, dist);
    if (ray && ray.hit && ray.t < dist - 1e-3) return null;
  }

  return { id: tid, x: pos.x, y: pos.y, dist2: dist * dist };
}

function acquireForwardTarget(world, actor, apos, facing, kernel) {
  let best = null;
  for (const [id, pos, ni, vit] of world.query(Position, NamedIdentity, Vitality)) {
    if (id === actor) continue;
    if (!pos || !ni || ni.identity !== 'monster') continue;
    if (!vit || (vit.hp|0) <= 0) continue;
    const dx = pos.x - apos.x;
    const dy = pos.y - apos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= EPS) continue;
    const dot = (dx / dist) * (facing.x || 1) + (dy / dist) * (facing.y || 0);
    if (dot < FOV_DOT) continue;
    if (kernel) {
      const ray = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: dx, y: dy }, dist);
      if (ray && ray.hit && ray.t < dist - 1e-3) continue;
    }
    const dist2 = dist * dist;
    if (!best || dist2 < best.dist2) {
      best = { id, x: pos.x, y: pos.y, dist2 };
    }
  }
  return best;
}

function clipShotToOcclusion(kernel, apos, desired, target) {
  if (!kernel) return { x: desired.x, y: desired.y };
  const dirx = desired.x - apos.x;
  const diry = desired.y - apos.y;
  const dist = Math.hypot(dirx, diry) || DEFAULT_RANGE;
  const maxT = target ? dist : Math.max(dist, 64);
  const ray = kernel.raycastOccl({ x: apos.x, y: apos.y }, { x: dirx, y: diry }, maxT);
  if (ray && ray.hit) {
    return { x: ray.point.x, y: ray.point.y };
  }
  return { x: desired.x, y: desired.y };
}

function isBlockedBeforeTarget(finalTo, target) {
  return (Math.abs(finalTo.x - target.x) > 1e-3) || (Math.abs(finalTo.y - target.y) > 1e-3);
}

function normalizeVec(x, y) {
  const mag = Math.hypot(x, y);
  if (mag <= EPS) return { x: 1, y: 0 };
  return { x: x / mag, y: y / mag };
}

function applyFacing(world, actor, dx, dy) {
  const mag = Math.hypot(dx, dy);
  if (mag <= EPS) return;
  const dir = { x: dx / mag, y: dy / mag };
  if (world.has(actor, Facing)) {
    world.set(actor, Facing, dir);
  } else {
    try { world.add(actor, Facing, dir); } catch {}
  }
}

function consumeArrow(world, actor) {
  const inv = world.get(actor, Inventory);
  const eq = world.get(actor, Equipment);
  // 1) Prefer equipped ammo slot
  if (eq && Number.isInteger(eq.ammo) && eq.ammo > 0) {
    const ammoId = eq.ammo;
    const ident = world.get(ammoId, NamedIdentity);
    const info = world.get(ammoId, ItemInfo);
    if (ident && info && (info.count|0) > 0 && typeof ident.identity === 'string' && ident.identity.startsWith('ammo_arrows')) {
      const template = { identity: ident.identity, name: ident.name || 'Arrows', info: { ...info, count: 1 } };
      if ((info.count | 0) > 1) {
        try { world.mutate(ammoId, ItemInfo, (rec) => { rec.count = Math.max(0, (rec.count || 1) - 1); }); } catch {}
      } else {
        // last arrow from the equipped stack — clear ammo slot, remove from inventory if present, and destroy entity
        try { world.mutate(actor, Equipment, (r) => { if (r.ammo === ammoId) r.ammo = null; }); } catch {}
        try { world.mutate(actor, Inventory, (rec) => { if (Array.isArray(rec.items)) rec.items = rec.items.filter((id) => id !== ammoId); }); } catch {}
        try { world.destroy(ammoId); } catch {}
      }
      return template;
    }
  }
  if (!inv || !Array.isArray(inv.items)) return null;
  // 2) Search inventory for any arrow stacks (prefer flaming first)
  const items = inv.items.slice();
  // Order: flaming first, then normal
  const order = (id) => {
    const i = world.get(id, NamedIdentity)?.identity;
    if (i === 'ammo_arrows_flame') return 0;
    if (i === 'ammo_arrows') return 1;
    return 2;
  };
  items.sort((a, b) => order(a) - order(b));
  for (const itemId of items) {
    const ident = world.get(itemId, NamedIdentity);
    if (!ident || (ident.identity !== 'ammo_arrows' && ident.identity !== 'ammo_arrows_flame')) continue;
    const info = world.get(itemId, ItemInfo);
    if (!info || (info.count|0) <= 0) continue;
    const template = {
      identity: ident.identity,
      name: ident.name || 'Arrows',
      info: { ...info, count: 1 },
    };
    if ((info.count || 1) > 1) {
      try { world.mutate(itemId, ItemInfo, (rec) => { rec.count = Math.max(0, (rec.count || 1) - 1); }); } catch {}
    } else {
      try { world.mutate(actor, Inventory, (rec) => { rec.items = rec.items.filter((id) => id !== itemId); }); } catch {}
      try { world.destroy(itemId); } catch {}
    }
    return template;
  }
  return null;
}

function maybeReturnArrow(world, targetId, template, rng, hit) {
  if (!template || typeof rng !== 'function' || !hit) return;
  if (rngInt(rng, 0, 1) !== 1) return;
  const inv = world.get(targetId, Inventory);
  const pos = world.get(targetId, Position);
  if (inv && Array.isArray(inv.items)) {
    const existing = inv.items.find((id) => (world.get(id, NamedIdentity)?.identity === template.identity));
    if (existing) {
      try { world.mutate(existing, ItemInfo, (rec) => { rec.count = (rec.count || 1) + 1; }); } catch {}
    } else {
      const newArrow = world.create();
      try { world.add(newArrow, NamedIdentity, { name: template.name, identity: template.identity }); } catch {}
      try { world.add(newArrow, ItemInfo, { ...template.info, count: 1 }); } catch {}
      try { world.mutate(targetId, Inventory, (rec) => { rec.items.push(newArrow); }); } catch {}
    }
  } else if (pos) {
    const newArrow = world.create();
    try { world.add(newArrow, NamedIdentity, { name: template.name, identity: template.identity }); } catch {}
    try { world.add(newArrow, ItemInfo, { ...template.info, count: 1 }); } catch {}
    try { world.add(newArrow, Position, { x: pos.x, y: pos.y }); } catch {}
  }
}

/** @param {string} spec @param {() => number} rng */
function rollDice(spec, rng) {
  const m = /^\s*(\d+)d(\d+)\s*$/i.exec(String(spec || ''));
  if (!m) return 1;
  const count = Math.max(1, (parseInt(m[1] || '1', 10) | 0));
  const sides = Math.max(2, (parseInt(m[2] || '2', 10) | 0));
  let sum = 0;
  for (let i = 0; i < count; i++) sum += rngInt(rng, 1, sides);
  return sum;
}
