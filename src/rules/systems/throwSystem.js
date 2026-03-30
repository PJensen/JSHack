import { Facing } from "../components/Facing.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Position } from "../components/Position.js";
import { ThrowIntent } from "../components/Intents/ThrowIntent.js";
import { executeInteraction } from "../interaction/runtime/actionRuntime.js";
import { throwPipeline } from "../interaction/verbs/throwPipeline.js";
import { emitSafe } from "../utils/emitSafe.js";
import { chebyshevScalar } from "../utils/distance.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * Lightweight base throw range model:
 * - lighter items travel farther
 * - heavy items still throw at least 1 tile
 * @param {number} weight
 */
function computeBaseThrowRange(weight) {
  const w = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const range = Math.round(6 - Math.log2(w + 1));
  return Math.max(1, Math.min(8, range | 0));
}

/**
 * Project a point toward a target along an integer grid line by up to `maxSteps`.
 * Uses Bresenham stepping so off-axis throws preserve the selected slope.
 * @param {number} fromX
 * @param {number} fromY
 * @param {number} toX
 * @param {number} toY
 * @param {number} maxSteps
 */
function projectTowardTarget(fromX, fromY, toX, toY, maxSteps) {
  let x = fromX | 0;
  let y = fromY | 0;
  const tx = toX | 0;
  const ty = toY | 0;
  const limit = Math.max(0, maxSteps | 0);

  let dx = Math.abs(tx - x);
  let sx = x < tx ? 1 : -1;
  let dy = -Math.abs(ty - y);
  let sy = y < ty ? 1 : -1;
  let err = dx + dy;
  let moved = 0;

  while (moved < limit && (x !== tx || y !== ty)) {
    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    moved++;
  }

  return { x, y };
}

/**
 * @param {any} intent
 */
function readIntentPoint(intent) {
  const x = Number(intent?.x);
  const y = Number(intent?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x | 0, y: y | 0 };
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {any} intent
 */
function readTargetPoint(world, actor, intent) {
  const byPoint = readIntentPoint(intent);
  if (byPoint) return byPoint;

  const targetId = Number(intent?.targetId || 0) | 0;
  if (targetId > 0) {
    const targetPos = world.get(targetId, Position);
    if (targetPos) return { x: targetPos.x | 0, y: targetPos.y | 0 };
  }

  const facing = world.get(actor, Facing);
  const fdx = Math.sign(Number(facing?.dx || 0));
  const fdy = Math.sign(Number(facing?.dy || 0));
  if (fdx !== 0 || fdy !== 0) {
    const from = world.get(actor, Position) || { x: 0, y: 0 };
    return { x: (from.x | 0) + fdx, y: (from.y | 0) + fdy };
  }

  return null;
}

/**
 * @param {World} world
 * @param {number} actor
 * @param {number} itemId
 * @param {any} intent
 */
function resolveThrowSpec(world, actor, itemId, intent) {
  const from = world.get(actor, Position);
  if (!from) return null;

  const info = world.get(itemId, ItemInfo);
  const weight = Number(info?.weight);
  const normalizedWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const maxRange = computeBaseThrowRange(normalizedWeight);

  const targetPoint = readTargetPoint(world, actor, intent);
  let dx = 1;
  let dy = 0;
  let range = maxRange;
  let to = {
    x: (from.x | 0) + (dx * range),
    y: (from.y | 0) + (dy * range),
  };

  if (targetPoint) {
    const dist = chebyshevScalar(from.x | 0, from.y | 0, targetPoint.x | 0, targetPoint.y | 0);
    if (dist > 0) {
      const cappedRange = Math.min(maxRange, dist);
      const projected = projectTowardTarget(
        from.x | 0,
        from.y | 0,
        targetPoint.x | 0,
        targetPoint.y | 0,
        cappedRange,
      );
      const stepX = (projected.x | 0) - (from.x | 0);
      const stepY = (projected.y | 0) - (from.y | 0);
      dx = Math.sign(stepX);
      dy = Math.sign(stepY);
      range = Math.max(1, chebyshevScalar(0, 0, stepX, stepY));
      to = { x: projected.x | 0, y: projected.y | 0 };
    }
  }

  return {
    from: { x: from.x | 0, y: from.y | 0 },
    to,
    dx,
    dy,
    range,
    maxRange,
    weight: normalizedWeight,
    target: targetPoint ? { x: targetPoint.x | 0, y: targetPoint.y | 0 } : null,
  };
}

/**
 * throwSystem — resolves ThrowIntent through Action Runtime + throw pipeline.
 * @param {World} world
 */
export function throwSystem(world) {
  for (const [actor, intent] of world.query(ThrowIntent)) {
    const itemId = intent.itemId | 0;
    const targetId = intent.targetId | 0;
    const throwSpec = resolveThrowSpec(world, actor, itemId, intent);
    let result = null;

    try {
      result = executeInteraction(world, {
        verb: "throw",
        actor,
        primary: itemId,
        target: targetId,
        params: { intent, throwSpec },
        pipeline: throwPipeline,
      });
    } catch (error) {
      result = {
        schemaVersion: 1,
        kind: "interaction",
        verb: "throw",
        actor,
        primary: itemId,
        target: targetId,
        ok: false,
        canceled: true,
        reason: "RUNTIME_ERROR",
        detail: { message: String(error?.message || error || "unknown runtime error") },
        metrics: { committedOps: 0, emittedEvents: 0 },
        payload: null,
        breadcrumbs: [],
        warnings: [{ code: "runtime:error", detail: { message: String(error?.message || error || "") } }],
      };
    }

    if (result?.canceled && typeof result.reason === "string" && !result.reason.startsWith("THROW_GATE_")) {
      const detail = result?.detail && typeof result.detail === "object" ? result.detail : {};
      emitSafe(world, "item:throw-cancelled", {
        actor,
        itemId,
        targetId,
        code: detail?.code || result.reason,
        message: detail?.message,
        consumesTurn: detail?.consumesTurn,
      });
    }

    emitSafe(world, "interaction:result", result);
    try { world.remove(actor, ThrowIntent); } catch {} // ECS: may not exist
  }
}
