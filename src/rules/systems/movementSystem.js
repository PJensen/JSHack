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
const SLIDE_EPS = 1e-3;

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

      const desired = { x: pos.x + dirx * stride, y: pos.y + diry * stride };
      let dest = { ...desired };
      let hitGeometry = false;

      if (kernel) {
        const sweep = kernel.sweepCapsule({ x: pos.x, y: pos.y }, desired, actorRadius);
        dest = { ...sweep.point };
        hitGeometry = !!sweep.hit;

        if (sweep.hit && sweep.normal) {
          const nLen = Math.hypot(sweep.normal.x, sweep.normal.y);
          if (nLen > EPS) {
            const nx = sweep.normal.x / nLen;
            const ny = sweep.normal.y / nLen;
            const dirDot = dirx * nx + diry * ny;
            if (dirDot < -EPS) {
              const tangx = dirx - dirDot * nx;
              const tangy = diry - dirDot * ny;
              const tangLen = Math.hypot(tangx, tangy);
              const remainingFrac = 1 - Math.max(0, Math.min(1, sweep.t ?? 1));
              const remainingDist = stride * remainingFrac;
              if (tangLen > EPS && remainingDist > EPS) {
                const tx = tangx / tangLen;
                const ty = tangy / tangLen;
                const slideStart = {
                  x: dest.x + nx * SLIDE_EPS,
                  y: dest.y + ny * SLIDE_EPS,
                };
                const slideTarget = {
                  x: slideStart.x + tx * remainingDist,
                  y: slideStart.y + ty * remainingDist,
                };
                const slideSweep = kernel.sweepCapsule(slideStart, slideTarget, actorRadius);
                const candidate = { ...slideSweep.point };
                const movedPrev = Math.hypot(dest.x - pos.x, dest.y - pos.y);
                const movedCandidate = Math.hypot(candidate.x - pos.x, candidate.y - pos.y);
                if (movedCandidate > movedPrev + EPS) {
                  dest = candidate;
                  hitGeometry = hitGeometry || !!slideSweep.hit;
                }
              }
            }
          }
        }
      }

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

      const delta = Math.hypot(dest.x - pos.x, dest.y - pos.y);
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
