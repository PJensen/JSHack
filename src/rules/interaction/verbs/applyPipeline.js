import { findApplyDef } from "../../data/applyDefs.js";
import { ItemApplyActionContext } from "../../utils/actionContexts.js";
import { findApplyPayload } from "../../content/items/applyPayloads.js";

/**
 * @param {any} value
 */
function normalizeApplyHookResult(value) {
  if (typeof value === "boolean") return { applied: value, consumedTool: false };
  if (value && typeof value === "object") {
    return {
      applied: value.applied === true,
      consumedTool: value.consumedTool === true,
      resultType: value.resultType,
    };
  }
  return { applied: false, consumedTool: false };
}

/**
 * @param {any} ctx
 * @param {any} def
 * @param {any} state
 */
function runApplyHooks(ctx, def, state) {
  const out = {};
  const phases = [
    ["beforeApply", def.beforeApply],
    ["onApply", def.onApply],
    ["afterApply", def.afterApply],
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
 * Canonical apply interaction pipeline.
 * Transitional note:
 * - Reuses existing apply defs through ItemApplyActionContext adapter.
 * - Runtime owns intent lifecycle/result envelope; defs remain unchanged.
 * @param {any} ctx
 */
export function applyPipeline(ctx) {
  const world = ctx._world;
  const actor = ctx.actor | 0;
  const toolId = ctx.primary | 0;
  const targetId = ctx.target | 0;

  const metrics = {
    applied: false,
    payloadMatched: false,
    legacyMatched: false,
    path: "none",
    consumedTool: false,
    legacyCommittedOps: 0,
  };

  if (!world) {
    ctx.cancel({ code: "APPLY_GATE_RUNTIME", message: "Apply runtime world unavailable." });
    return { metrics };
  }
  if (!(actor > 0) || !(toolId > 0) || !(targetId > 0)) {
    ctx.cancel({ code: "APPLY_GATE_INVALID", message: "Missing actor/tool/target for apply action." });
    return { metrics };
  }
  if (!ctx.query.alive(actor)) {
    ctx.cancel({ code: "APPLY_GATE_NO_ACTOR", message: "Actor is not alive." });
    return { metrics };
  }
  if (!ctx.query.alive(toolId) || !ctx.query.alive(targetId)) {
    ctx.cancel({ code: "APPLY_GATE_MISSING_ITEM", message: "Tool or target item no longer exists." });
    return { metrics };
  }
  if (!ctx.rules.hasItemInInventory(actor, toolId) || !ctx.rules.hasItemInInventory(actor, targetId)) {
    ctx.cancel({ code: "APPLY_GATE_NOT_OWNED", message: "Tool and target must both be in inventory." });
    return { metrics };
  }

  const state = {
    actor,
    toolId,
    targetId,
    toolIdentity: String(ctx.query.identity(toolId) || "").toLowerCase(),
    targetIdentity: String(ctx.query.identity(targetId) || "").toLowerCase(),
    toolInfo: ctx.query.itemInfo(toolId),
    targetInfo: ctx.query.itemInfo(targetId),
  };

  const payloadDef = findApplyPayload(state);
  if (payloadDef) {
    metrics.payloadMatched = true;
    metrics.path = "payload";
    const hookOut = runApplyHooks(ctx, payloadDef, state);
    if (ctx.cancelled) {
      return {
        metrics,
        payload: {
          defId: String(payloadDef.id || ""),
          hooks: hookOut,
        },
      };
    }

    const hookResult = normalizeApplyHookResult(hookOut.onApply);
    metrics.applied = hookResult.applied;
    metrics.consumedTool = hookResult.consumedTool;
    if (hookResult.consumedTool) {
      ctx.mutate.consume(toolId, actor);
    }

    return {
      metrics,
      payload: {
        defId: String(payloadDef.id || ""),
        hooks: hookOut,
        hookResult,
      },
    };
  }

  const def = findApplyDef(world, actor, toolId, targetId);
  if (!def || typeof def.run !== "function") {
    return { metrics, payload: { defId: null, path: "none" } };
  }
  metrics.legacyMatched = true;
  metrics.path = "legacy";

  const legacyCtx = new ItemApplyActionContext({ world, actor, toolId, targetId });
  let runResult = null;
  try { runResult = def.run(legacyCtx); } catch {}

  if (legacyCtx.cancelled) {
    legacyCtx.discard();
    ctx.cancel(legacyCtx.cancelReason || { code: "APPLY_CANCELLED", message: "Apply action cancelled." });
    return { metrics, payload: { defId: String(def.id || ""), runResult, path: "legacy" } };
  }

  const committed = legacyCtx.commit();
  metrics.legacyCommittedOps = Array.isArray(committed) ? committed.length : 0;
  metrics.applied = true;

  return {
    metrics,
    payload: {
      defId: String(def.id || ""),
      runResult,
      path: "legacy",
    },
  };
}
