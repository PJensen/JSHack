// src/rules/systems/movementSystem.js
// Consumes MoveIntent and applies grid-aligned movement against the geometry kernel.

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
const DIR_EPS = 1e-3;
const CLEARANCE_EPS = 1e-3;
const GRID_STEP = 1;

function clampStep(v) {
  if (!Number.isFinite(v)) return 0;
  if (Math.abs(v) < DIR_EPS) return 0;
  return v > 0 ? 1 : (v < 0 ? -1 : 0);
}

function snapToGrid(value) {
  if (!Number.isFinite(value)) return 0;
  const base = Math.floor(value);
  const frac = value - base;
  if (frac < 0.25) return base;
  if (frac > 0.75) return base + 1;
  return base + 0.5;
}

function normalizeDir(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len < DIR_EPS) {
    return { x: 0, y: 0 };
  }
  return { x: dx / len, y: dy / len };
}

function updateFacing(world, actor, dirx, diry) {
  const vec = normalizeDir(dirx, diry);
  if (Math.abs(vec.x) < DIR_EPS && Math.abs(vec.y) < DIR_EPS) {
    return;
  }
  const fx = world.get(actor, Facing);
  if (fx) {
    world.set(actor, Facing, { x: vec.x, y: vec.y });
  } else {
    try { world.add(actor, Facing, { x: vec.x, y: vec.y }); } catch { }
  }
}

/** @param {import('../../lib/ecs-js').World} world */
export function movementSystem(world) {
  const kernel = getGeometryKernel(world);

  /** @type {Map<number, {id:number,x:number,y:number,gridX:number,gridY:number,radius:number,solid:boolean,interactable:boolean,alive:boolean}>} */
  const colliderMap = new Map();

  for (const [id, pos] of world.query(Position)) {
    if (!pos) continue;
    const collider = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const alive = !!(vit && (vit.hp ?? 0) > 0);
    const solid = !!(collider?.solid) || alive;
    const radius = Math.max(0, world.get(id, BoundingCircle)?.radius ?? (solid ? 0.5 : 0));
    const gridX = snapToGrid(pos.x);
    const gridY = snapToGrid(pos.y);
    colliderMap.set(id, {
      id,
      x: pos.x,
      y: pos.y,
      gridX,
      gridY,
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
      const actorRadius = Math.max(0, world.get(actor, BoundingCircle)?.radius ?? 0.5);

      const stepX = clampStep(Number.isFinite(intent.dx) ? intent.dx : 0);
      const stepY = clampStep(Number.isFinite(intent.dy) ? intent.dy : 0);
      if (stepX === 0 && stepY === 0) {
        world.remove(actor, MoveIntent);
        continue;
      }
      const originX = snapToGrid(pos.x);
      const originY = snapToGrid(pos.y);
      const dest = {
        x: originX + stepX * GRID_STEP,
        y: originY + stepY * GRID_STEP,
      };

      let hitGeometry = false;
      if (kernel) {
        const clearance = kernel.distanceMove(dest.x, dest.y) - actorRadius;
        if (clearance < CLEARANCE_EPS) {
          hitGeometry = true;
        }
      }

      const actorData = colliderMap.get(actor) || {
        id: actor,
        x: originX,
        y: originY,
        gridX: originX,
        gridY: originY,
        radius: actorRadius,
        solid: true,
        interactable: world.has(actor, Interactable),
        alive: true,
      };
      actorData.radius = actorRadius;
      actorData.x = originX;
      actorData.y = originY;
      actorData.gridX = originX;
      actorData.gridY = originY;
      actorData.solid = true;
      colliderMap.set(actor, actorData);

      let blockedBy = null;
      if (!hitGeometry) {
        for (const other of colliderMap.values()) {
          if (other.id === actor) continue;
          if (!other.solid) continue;
          const otherX = other.gridX ?? snapToGrid(other.x);
          const otherY = other.gridY ?? snapToGrid(other.y);
          const minDist = actorRadius + other.radius;
          if (minDist <= 0) continue;
          const dist = Math.hypot(dest.x - otherX, dest.y - otherY);
          if (dist < minDist - EPS) {
            blockedBy = other;
            break;
          }
        }
      }

      const dirVec = normalizeDir(stepX, stepY);

      if (hitGeometry || blockedBy) {
        updateFacing(world, actor, dirVec.x, dirVec.y);

        if (blockedBy?.interactable) {
          try { world.add(actor, InteractIntent, { targetId: blockedBy.id }); } catch {}
        } else if (blockedBy?.alive) {
          const reach = Math.max(0, anatomy?.reachDistance ?? 1);
          const otherX = blockedBy.gridX ?? snapToGrid(blockedBy.x);
          const otherY = blockedBy.gridY ?? snapToGrid(blockedBy.y);
          const centerDist = Math.hypot(otherX - originX, otherY - originY);
          const effectiveReach = reach + actorRadius + blockedBy.radius;
          if (centerDist <= effectiveReach + 1e-3) {
            try { world.add(actor, AttackIntent, { targetId: blockedBy.id }); } catch {}
          }
        }

        world.remove(actor, MoveIntent);
        continue;
      }

      world.set(actor, Position, { x: dest.x, y: dest.y });
      world.emit?.("moved", { id: actor, from: { x: originX, y: originY }, to: { x: dest.x, y: dest.y } });
      actorData.x = dest.x;
      actorData.y = dest.y;
      actorData.gridX = dest.x;
      actorData.gridY = dest.y;
      colliderMap.set(actor, actorData);

      updateFacing(world, actor, dirVec.x, dirVec.y);
    } catch {}
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
