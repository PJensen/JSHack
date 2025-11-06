// src/rules/systems/movementSystem.js
// Consumes MoveIntent and applies analytic movement against the geometry kernel.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Vitality } from "../components/Vitality.js";
import { BoundingCircle } from "../components/BoundingCircle.js";
import { Facing } from "../components/Facing.js";
import { Anatomy } from "../components/Anatomy.js";
import { getGeometryKernel } from "../environment/worldGeometry.js";

const EPS = 1e-4;

/** @param {import('../../lib/ecs-js').World} world */
export function movementSystem(world) {
  const kernel = getGeometryKernel(world);

  /** @type {Map<number, {id:number,x:number,y:number,radius:number,solid:boolean,interactable:boolean,alive:boolean}>} */
  const colliderMap = new Map();

  for (const [id, pos] of world.query(Position)) {
    if (!pos) continue;
    const collider = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const alive = !!(vit && (vit.hp ?? 0) > 0);
    const solid = !!(collider?.solid) || alive;
    const radius = Math.max(0, world.get(id, BoundingCircle)?.radius ?? (solid ? 0.5 : 0));
    colliderMap.set(id, {
      id,
      x: pos.x,
      y: pos.y,
      radius,
      solid,
      interactable: world.has(id, Interactable),
      alive,
    });
  }

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const anatomy = world.get(actor, Anatomy);
      const stride = Number.isFinite(intent.distance)
        ? Math.max(0, intent.distance)
        : Math.max(0, anatomy?.strideDistance ?? 1);
      const actorRadius = Math.max(0, world.get(actor, BoundingCircle)?.radius ?? 0.5);

      const dx = Number.isFinite(intent.dx) ? intent.dx : 0;
      const dy = Number.isFinite(intent.dy) ? intent.dy : 0;
      const mag = Math.hypot(dx, dy);
      if (mag <= EPS || stride <= EPS) {
        world.remove(actor, MoveIntent);
        continue;
      }
      const dirx = dx / mag;
      const diry = dy / mag;

      const applySweep = (target) => {
        if (!kernel) {
          return { point: { x: target.x, y: target.y }, hit: false };
        }
        const sweep = kernel.sweepCapsule({ x: pos.x, y: pos.y }, target, actorRadius);
        return { point: sweep.point, hit: !!sweep.hit };
      };

      const desired = { x: pos.x + dirx * stride, y: pos.y + diry * stride };
      let sweepResult = applySweep(desired);
      let dest = { ...sweepResult.point };
      let hitGeometry = sweepResult.hit;

      const actorData = colliderMap.get(actor) || {
        id: actor,
        x: pos.x,
        y: pos.y,
        radius: actorRadius,
        solid: true,
        interactable: world.has(actor, Interactable),
        alive: true,
      };
      actorData.radius = actorRadius;
      actorData.x = pos.x;
      actorData.y = pos.y;
      actorData.solid = true;
      colliderMap.set(actor, actorData);

      let delta = Math.hypot(dest.x - pos.x, dest.y - pos.y);
      if (delta <= EPS && hitGeometry) {
        const axisDirs = [];
        if (Math.abs(dirx) > EPS) axisDirs.push({ x: dirx, y: 0 });
        if (Math.abs(diry) > EPS) axisDirs.push({ x: 0, y: diry });
        axisDirs.sort((a, b) => Math.abs(b.x || b.y) - Math.abs(a.x || a.y));
        for (const axis of axisDirs) {
          const axisMag = Math.hypot(axis.x, axis.y);
          if (axisMag <= EPS) continue;
          const axisStride = stride * axisMag;
          const axisDirx = axisMag > 0 ? axis.x / axisMag : 0;
          const axisDiry = axisMag > 0 ? axis.y / axisMag : 0;
          const axisTarget = { x: pos.x + axisDirx * axisStride, y: pos.y + axisDiry * axisStride };
          sweepResult = applySweep(axisTarget);
          const candidate = sweepResult.point;
          const candidateDelta = Math.hypot(candidate.x - pos.x, candidate.y - pos.y);
          if (candidateDelta > EPS) {
            dest = { ...candidate };
            hitGeometry = sweepResult.hit;
            delta = candidateDelta;
            break;
          }
        }
      }

      let blockedBy = null;
      for (const other of colliderMap.values()) {
        if (other.id === actor) continue;
        if (!other.solid) continue;
        const minDist = actorRadius + other.radius;
        if (minDist <= 0) continue;
        const dist = Math.hypot(dest.x - other.x, dest.y - other.y);
        if (dist < minDist - EPS) {
          blockedBy = other;
          break;
        }
      }

      if (blockedBy) {
        const fx = world.get(actor, Facing);
        if (fx) {
          world.set(actor, Facing, { x: dirx, y: diry });
        } else {
          try { world.add(actor, Facing, { x: dirx, y: diry }); } catch {}
        }

        if (blockedBy.interactable) {
          try { world.add(actor, InteractIntent, { targetId: blockedBy.id }); } catch {}
        } else if (blockedBy.alive) {
          const reach = Math.max(0, anatomy?.reachDistance ?? 1);
          const centerDist = Math.hypot(blockedBy.x - pos.x, blockedBy.y - pos.y);
          const effectiveReach = reach + actorRadius + blockedBy.radius;
          if (centerDist <= effectiveReach + 1e-3) {
            try { world.add(actor, AttackIntent, { targetId: blockedBy.id }); } catch {}
          }
        }

        world.remove(actor, MoveIntent);
        continue;
      }

      if (delta <= EPS) {
        if (hitGeometry) {
          const fx = world.get(actor, Facing);
          if (fx) world.set(actor, Facing, { x: dirx, y: diry });
        }
        world.remove(actor, MoveIntent);
        continue;
      }

      world.set(actor, Position, { x: dest.x, y: dest.y });
      world.emit?.("moved", { id: actor, from: { x: pos.x, y: pos.y }, to: { x: dest.x, y: dest.y } });
      actorData.x = dest.x;
      actorData.y = dest.y;
      colliderMap.set(actor, actorData);

      const fx = world.get(actor, Facing);
      if (fx) {
        world.set(actor, Facing, { x: dirx, y: diry });
      } else {
        try { world.add(actor, Facing, { x: dirx, y: diry }); } catch {}
      }
    } catch {}
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
