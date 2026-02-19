import { Facing } from "../components/Facing.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Position } from "../components/Position.js";
import { ThrowIntent } from "../components/Intents/ThrowIntent.js";
import { executeInteraction } from "../interaction/runtime/actionRuntime.js";
import { throwPipeline } from "../interaction/verbs/throwPipeline.js";
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

  if (targetPoint) {
    const rawDx = (targetPoint.x | 0) - (from.x | 0);
    const rawDy = (targetPoint.y | 0) - (from.y | 0);
    const dist = Math.max(Math.abs(rawDx), Math.abs(rawDy));
    if (dist > 0) {
      dx = Math.sign(rawDx);
      dy = Math.sign(rawDy);
      range = Math.min(maxRange, dist);
    }
  }

  const to = {
    x: (from.x | 0) + (dx * range),
    y: (from.y | 0) + (dy * range),
  };

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
      try {
        world.emit?.("item:throw-cancelled", {
          actor,
          itemId,
          targetId,
          code: detail?.code || result.reason,
          message: detail?.message,
          consumesTurn: detail?.consumesTurn,
        });
      } catch {}
    }

    try { world.emit?.("interaction:result", result); } catch {}
    try { world.remove(actor, ThrowIntent); } catch {}
  }
}
