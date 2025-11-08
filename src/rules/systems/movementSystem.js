// src/rules/systems/movementSystem.js
// Consumes MoveIntent and applies grid-aligned movement against the tile map.

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
import { getTileMap, isTileWalkable, tileKey } from "../environment/tileMap.js";

function clampStepComponent(value) {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function chooseGridStep(dx, dy) {
  const vx = Number.isFinite(dx) ? dx : 0;
  const vy = Number.isFinite(dy) ? dy : 0;
  if (vx === 0 && vy === 0) return { x: 0, y: 0 };
  const mag = Math.hypot(vx, vy);
  if (mag <= 1e-6) {
    return { x: clampStepComponent(vx), y: clampStepComponent(vy) };
  }
  let stepX = Math.round(vx / mag);
  let stepY = Math.round(vy / mag);
  if (stepX === 0 && vx !== 0) stepX = clampStepComponent(vx);
  if (stepY === 0 && vy !== 0) stepY = clampStepComponent(vy);
  return {
    x: clampStepComponent(stepX),
    y: clampStepComponent(stepY),
  };
}

function canEnterTile(tileMap, tileOccupants, actorId, x, y) {
  const walkable = tileMap ? isTileWalkable(tileMap, x, y) : true;
  const occ = tileOccupants.get(tileKey(x, y)) || null;
  if (!walkable) {
    return { ok: false, blocker: occ };
  }
  if (occ && occ.id !== actorId) {
    return { ok: false, blocker: occ };
  }
  return { ok: true, blocker: null };
}

function diagonalClear(tileMap, tileOccupants, actorId, fromX, fromY, stepX, stepY) {
  if (!tileMap || stepX === 0 || stepY === 0) {
    return { clear: true, blocker: null };
  }
  const horizX = fromX + stepX;
  const horizY = fromY;
  const vertX = fromX;
  const vertY = fromY + stepY;

  const horizWalkable = isTileWalkable(tileMap, horizX, horizY);
  const vertWalkable = isTileWalkable(tileMap, vertX, vertY);

  const horizOcc = tileOccupants.get(tileKey(horizX, horizY)) || null;
  const vertOcc = tileOccupants.get(tileKey(vertX, vertY)) || null;

  const horizBlocked = !horizWalkable || (horizOcc && horizOcc.id !== actorId);
  const vertBlocked = !vertWalkable || (vertOcc && vertOcc.id !== actorId);

  if (horizBlocked || vertBlocked) {
    const blocker =
      (horizBlocked && horizOcc && horizOcc.id !== actorId)
        ? horizOcc
        : (vertBlocked && vertOcc && vertOcc.id !== actorId)
          ? vertOcc
          : null;
    return { clear: false, blocker };
  }

  return { clear: true, blocker: null };
}

/** @param {import('../../lib/ecs-js').World} world */
export function movementSystem(world) {
  const tileMap = getTileMap(world);

  /** @type {Map<number, {id:number,x:number,y:number,tileX:number,tileY:number,radius:number,solid:boolean,interactable:boolean,alive:boolean}>} */
  const colliderMap = new Map();
  /** @type {Map<string, {id:number,x:number,y:number,tileX:number,tileY:number,radius:number,solid:boolean,interactable:boolean,alive:boolean}>} */
  const tileOccupants = new Map();

  for (const [id, pos] of world.query(Position)) {
    if (!pos) continue;
    const collider = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const alive = !!(vit && (vit.hp ?? 0) > 0);
    const solid = !!(collider?.solid) || alive;
    const radius = Math.max(0, world.get(id, BoundingCircle)?.radius ?? (solid ? 0.5 : 0));
    const tileX = Math.round(pos.x);
    const tileY = Math.round(pos.y);
    const record = {
      id,
      x: pos.x,
      y: pos.y,
      tileX,
      tileY,
      radius,
      solid,
      interactable: world.has(id, Interactable),
      alive,
    };
    colliderMap.set(id, record);
    if (solid) {
      const key = tileKey(tileX, tileY);
      const existing = tileOccupants.get(key);
      if (!existing || (!existing.interactable && record.interactable)) {
        tileOccupants.set(key, record);
      }
    }
  }

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const anatomy = world.get(actor, Anatomy);
      const actorData = colliderMap.get(actor) || {
        id: actor,
        x: pos.x,
        y: pos.y,
        tileX: Math.round(pos.x),
        tileY: Math.round(pos.y),
        radius: Math.max(0, world.get(actor, BoundingCircle)?.radius ?? 0.5),
        solid: true,
        interactable: world.has(actor, Interactable),
        alive: true,
      };
      actorData.x = pos.x;
      actorData.y = pos.y;
      actorData.tileX = Math.round(pos.x);
      actorData.tileY = Math.round(pos.y);
      actorData.radius = Math.max(0, world.get(actor, BoundingCircle)?.radius ?? 0.5);
      actorData.solid = true;
      colliderMap.set(actor, actorData);

      const rawDx = Number.isFinite(intent.dx) ? intent.dx : 0;
      const rawDy = Number.isFinite(intent.dy) ? intent.dy : 0;
      const step = chooseGridStep(rawDx, rawDy);
      if (step.x === 0 && step.y === 0) { world.remove(actor, MoveIntent); continue; }

      const requested = Number.isFinite(intent.distance) ? Math.max(1, Math.round(intent.distance)) : 1;
      const stride = Math.max(1, Math.round(anatomy?.strideDistance ?? 1));
      const stepsAllowed = Math.max(1, Math.min(requested, stride));

      const originKey = actorData.solid ? tileKey(actorData.tileX, actorData.tileY) : null;
      if (originKey) tileOccupants.delete(originKey);

      let currentX = actorData.tileX;
      let currentY = actorData.tileY;
      let stepsTaken = 0;
      let blockedBy = null;

      for (let i = 0; i < stepsAllowed; i++) {
        const nextX = currentX + step.x;
        const nextY = currentY + step.y;

        if (tileMap) {
          const diagStatus = diagonalClear(tileMap, tileOccupants, actor, currentX, currentY, step.x, step.y);
          if (!diagStatus.clear) {
            blockedBy = diagStatus.blocker;
            break;
          }
        }

        const { ok: canEnter, blocker } = canEnterTile(tileMap, tileOccupants, actor, nextX, nextY);
        if (!canEnter) {
          blockedBy = blocker;
          break;
        }
        currentX = nextX;
        currentY = nextY;
        stepsTaken += 1;
      }

      if (stepsTaken <= 0) {
        if (originKey && !tileOccupants.has(originKey) && actorData.solid) {
          tileOccupants.set(originKey, actorData);
        }

        const fx = world.get(actor, Facing);
        if (fx) {
          world.set(actor, Facing, { x: step.x, y: step.y });
        } else {
          try { world.add(actor, Facing, { x: step.x, y: step.y }); } catch {}
        }

        if (blockedBy) {
          if (blockedBy.interactable) {
            try { world.add(actor, InteractIntent, { targetId: blockedBy.id }); } catch {}
          } else if (blockedBy.alive) {
            const reach = Math.max(0, anatomy?.reachDistance ?? 1);
            const targetData = colliderMap.get(blockedBy.id) || blockedBy;
            const dist = Math.hypot((targetData?.x ?? currentX) - pos.x, (targetData?.y ?? currentY) - pos.y);
            const effectiveReach = reach + actorData.radius + (targetData?.radius ?? 0);
            if (dist <= effectiveReach + 1e-3) {
              try { world.add(actor, AttackIntent, { targetId: blockedBy.id }); } catch {}
            }
          }
        }

        world.remove(actor, MoveIntent);
        continue;
      }

      actorData.tileX = currentX;
      actorData.tileY = currentY;
      actorData.x = currentX;
      actorData.y = currentY;
      colliderMap.set(actor, actorData);

      if (actorData.solid) {
        tileOccupants.set(tileKey(currentX, currentY), actorData);
      }

      world.set(actor, Position, { x: currentX, y: currentY });
      world.emit?.("moved", { id: actor, from: { x: pos.x, y: pos.y }, to: { x: currentX, y: currentY } });

      const fx = world.get(actor, Facing);
      if (fx) {
        world.set(actor, Facing, { x: step.x, y: step.y });
      } else {
        try { world.add(actor, Facing, { x: step.x, y: step.y }); } catch {}
      }
    } catch {}
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
