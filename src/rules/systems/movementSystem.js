// src/rules/systems/movementSystem.js
// Consumes MoveIntent and applies analytic movement against the geometry kernel.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { Terrain } from "../components/Terrain.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Settings } from "../components/Settings.js";
import { InteractIntent } from "../components/Intents/InteractIntent.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Vitality } from "../components/Vitality.js";
import { BoundingCircle } from "../components/BoundingCircle.js";
import { Facing } from "../components/Facing.js";
import { Anatomy } from "../components/Anatomy.js";
import { getGeometryKernel } from "../environment/worldGeometry.js";

const EPS = 1e-4;

function key(x, y) {
  return `${x},${y}`;
}

function roundCoord(v) {
  return Math.round(v);
}

function approxEq(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

/** @param {import('../../lib/ecs-js').World} world */
export function movementSystem(world) {
  const kernel = getGeometryKernel(world);

  const blocking = new Map();
  const interactables = new Map();
  const occupants = new Map();

  for (const [id, pos] of world.query(Position)) {
    if (!pos) continue;
    const gx = roundCoord(pos.x);
    const gy = roundCoord(pos.y);
    const k = key(gx, gy);

    const terrain = world.get(id, Terrain);
    if (terrain && !terrain.walkable) {
      blocking.set(k, true);
    }
    const collider = world.get(id, Collider);
    if (collider && collider.solid) {
      blocking.set(k, true);
    }
    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) {
      blocking.set(k, true);
    }
    if (world.has(id, Interactable)) {
      interactables.set(k, id);
    }
    if (!occupants.has(k)) occupants.set(k, id);
  }

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const anatomy = world.get(actor, Anatomy);
      const stride = Number.isFinite(intent.distance)
        ? Math.max(0, intent.distance)
        : Math.max(0, anatomy?.strideDistance ?? 1);
      const radius = Math.max(0, world.get(actor, BoundingCircle)?.radius ?? 0.5);

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
        const sweep = kernel.sweepCapsule({ x: pos.x, y: pos.y }, desired, radius);
        dest = sweep.point;
        hitGeometry = !!sweep.hit;
      }

      const destCellX = roundCoord(dest.x);
      const destCellY = roundCoord(dest.y);
      const destKey = key(destCellX, destCellY);
      const startCellX = roundCoord(pos.x);
      const startCellY = roundCoord(pos.y);
      const sameCell = destCellX === startCellX && destCellY === startCellY;

      let blocked = false;
      let blockedById = 0;
      if (!sameCell && blocking.get(destKey)) {
        blocked = true;
        blockedById = occupants.get(destKey) || 0;
      }

      if (blocked) {
        const interactTarget = interactables.get(destKey);
        if (interactTarget) {
          try { world.add(actor, InteractIntent, { targetId: interactTarget }); } catch {}
        } else if (blockedById && blockedById !== actor) {
          const targetPos = world.get(blockedById, Position);
          if (targetPos) {
            const attackRadius = world.get(blockedById, BoundingCircle)?.radius ?? 0.5;
            const reach = Math.max(0, anatomy?.reachDistance ?? 1);
            const centerDist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y);
            const effectiveReach = reach + radius + attackRadius;
            if (centerDist <= effectiveReach + 1e-3) {
              try { world.add(actor, AttackIntent, { targetId: blockedById }); } catch {}
            }
          }
        }
      }

      let moved = false;
      if (!blocked) {
        const delta = Math.hypot(dest.x - pos.x, dest.y - pos.y);
        if (delta > EPS) {
          world.set(actor, Position, { x: dest.x, y: dest.y });
          world.emit?.("moved", { id: actor, from: { x: pos.x, y: pos.y }, to: { x: dest.x, y: dest.y } });
          blocking.set(destKey, true);
          moved = true;

          const fx = world.get(actor, Facing);
          if (fx) {
            world.set(actor, Facing, { x: dirx, y: diry });
          } else {
            try { world.add(actor, Facing, { x: dirx, y: diry }); } catch {}
          }
        } else if (hitGeometry) {
          // Update facing even when sliding into walls
          const fx = world.get(actor, Facing);
          if (fx) world.set(actor, Facing, { x: dirx, y: diry });
        }
      }

      if (moved) {
        const inv = world.get(actor, Inventory);
        const set = world.get(actor, Settings);
        const enablePickup = inv && (set?.autoPickup !== false);
        if (enablePickup) {
          const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length
            ? set.autoPickupKinds
            : ["currency"];
          const pickups = [];
          for (const [itemId] of world.query(Position)) {
            const ipos = world.get(itemId, Position);
            if (!ipos || !approxEq(ipos.x, dest.x) || !approxEq(ipos.y, dest.y)) continue;
            const info = world.get(itemId, ItemInfo);
            if (!info || !info.type || !kinds.includes(info.type)) continue;
            pickups.push(itemId);
          }
          for (const itemId of pickups) {
            const info = world.get(itemId, ItemInfo);
            if (!info) continue;
            const count = info.count || 1;
            const ident = world.get(itemId, NamedIdentity)?.identity;
            let stackTarget = 0;
            if (ident) {
              for (const id of inv.items) {
                const n = world.get(id, NamedIdentity);
                if (n && n.identity === ident) { stackTarget = id; break; }
              }
            }
            if (stackTarget) {
              world.mutate(stackTarget, ItemInfo, (r) => { r.count = (r.count || 1) + count; });
              world.destroy(itemId);
            } else {
              const ignoreCapacity = info.type === "currency";
              if (ignoreCapacity || inv.capacity == null || inv.items.length < inv.capacity) {
                try { world.remove(itemId, Position); } catch {}
                inv.items.push(itemId);
              }
            }
            try { world.emit && world.emit("item:pickup", { actor, itemId, count }); } catch {}
          }
        }
      }
    } catch {}
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
