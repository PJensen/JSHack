import { Consumable } from "../../components/Consumable.js";
import { findUsePayload } from "../../content/items/usePayloads.js";

/**
 * @param {any} value
 */
function normalizeUseHookResult(value) {
  if (typeof value === "boolean") return { consumed: value };
  if (value && typeof value === "object") {
    return {
      consumed: value.consumed === true,
      cancelled: value.cancelled === true,
      code: value.code,
      message: value.message,
      consumesTurn: value.consumesTurn,
      detail: value.detail,
    };
  }
  return { consumed: false };
}

/**
 * @param {any} ctx
 * @param {any} payload
 * @param {any} state
 */
function runUseHooks(ctx, payload, state) {
  const out = {};
  const phases = [
    ["beforeUse", payload.beforeUse],
    ["onUse", payload.onUse],
    ["afterUse", payload.afterUse],
  ];
  for (let i = 0; i < phases.length; i++) {
    const [phase, fn] = phases[i];
    if (typeof fn !== "function") continue;
    out[phase] = fn(ctx, state);
    if (ctx.cancelled) break;
  }
  return out;
}

/**
 * Canonical use interaction pipeline.
 * Hook-only note:
 * - Runtime resolves use behavior through payload objects and helper callbacks.
 * - No legacy item-use-def adapter remains in this pipeline.
 * @param {any} ctx
 */
export function usePipeline(ctx) {
  const actor = ctx.actor | 0;
  const itemId = ctx.primary | 0;
  const intent = (ctx.params?.intent && typeof ctx.params.intent === "object")
    ? ctx.params.intent
    : null;

  const metrics = {
    consumed: false,
    payloadMatched: false,
    path: "none",
  };

  if (!(actor > 0) || !(itemId > 0)) {
    ctx.cancel({ code: "USE_GATE_INVALID", message: "Missing actor or item for use action." });
    return { metrics };
  }
  if (!ctx.query.alive(actor)) {
    ctx.cancel({ code: "USE_GATE_NO_ACTOR", message: "Actor is not alive." });
    return { metrics };
  }
  if (!ctx.query.alive(itemId)) {
    ctx.cancel({ code: "USE_GATE_NO_ITEM", message: "Item no longer exists." });
    return { metrics };
  }
  if (!ctx.rules.hasItemInInventory(actor, itemId)) {
    ctx.cancel({ code: "USE_GATE_NOT_OWNED", message: "Item is not in inventory." });
    return { metrics };
  }

  const info = ctx.query.itemInfo(itemId);
  const cons = /** @type any */ (ctx.query.get(itemId, Consumable));
  const identity = String(ctx.query.identity(itemId) || "").toLowerCase();
  const state = {
    actor,
    itemId,
    identity,
    info,
    intent,
    consumable: cons,
    effectKey: String(cons?.effectKey || ""),
    effectParams: (cons?.effectParams && typeof cons.effectParams === "object") ? cons.effectParams : {},
  };

  const payload = findUsePayload(state);
  if (!payload) {
    return { metrics, payload: { defId: null, path: "none" } };
  }
  metrics.payloadMatched = true;
  metrics.path = String(payload.source || "payload");

  const hookOut = runUseHooks(ctx, payload, state);
  if (!ctx.cancelled) {
    const hookResult = normalizeUseHookResult(hookOut.onUse);
    if (hookResult.cancelled) {
      ctx.cancel({
        code: String(hookResult.code || "USE_CANCELLED"),
        message: String(hookResult.message || "Use action cancelled."),
        consumesTurn: hookResult.consumesTurn === true,
        detail: hookResult.detail,
      });
    }
    if (!ctx.cancelled && hookResult.consumed) {
      ctx.mutate.consume(itemId, actor);
      ctx.io.emit("item:used", { actor, itemId });
      metrics.consumed = true;
    }
    return {
      metrics,
      payload: {
        defId: String(payload.id || ""),
        path: String(payload.source || "payload"),
        hooks: hookOut,
        hookResult,
      },
    };
  }

  return {
    metrics,
    payload: {
      defId: String(payload.id || ""),
      path: String(payload.source || "payload"),
      hooks: hookOut,
    },
  };
}
