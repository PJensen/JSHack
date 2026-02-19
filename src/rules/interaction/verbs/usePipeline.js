import { Consumable } from "../../components/Consumable.js";
import { findItemUseDef } from "../../data/itemUseDefs.js";
import { runScript, ScriptVerb } from "../../scripting.js";
import { ItemUseActionContext } from "../../utils/actionContexts.js";

/**
 * @param {any} action
 * @param {any} context
 */
function executeUseAction(action, context) {
  if (typeof action !== "function") return false;
  try {
    const out = action(context);
    if (typeof out === "boolean") return out;
    if (out && typeof out === "object" && typeof out.consumed === "boolean") return out.consumed;
  } catch {}
  return false;
}

/**
 * @param {any} result
 */
function normalizeScriptUseResult(result) {
  if (typeof result === "boolean") return { consumed: result, cancelled: false };
  if (result && typeof result === "object") {
    return {
      consumed: typeof result.consumed === "boolean" ? result.consumed : true,
      cancelled: result.cancelled === true,
      code: result.code,
      message: result.message,
      consumesTurn: result.consumesTurn,
    };
  }
  return { consumed: true, cancelled: false };
}

/**
 * Canonical use interaction pipeline.
 * Transitional note:
 * - Universal mechanics and inventory consumption use the runtime facets.
 * - Existing item-use defs/scripts are executed via a legacy adapter context
 *   until each family is migrated to first-class payload hooks.
 * @param {any} ctx
 */
export function usePipeline(ctx) {
  const world = ctx._world;
  const actor = ctx.actor | 0;
  const itemId = ctx.primary | 0;
  const intent = (ctx.params?.intent && typeof ctx.params.intent === "object")
    ? ctx.params.intent
    : null;

  const metrics = {
    consumed: false,
    path: "none",
    legacyCommittedOps: 0,
  };

  if (!world) {
    ctx.cancel({ code: "USE_GATE_RUNTIME", message: "Use runtime world unavailable." });
    return { metrics };
  }
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

  let consumed = false;
  let payload = null;

  // Path 1: consumable script hook
  if (cons && cons.effectKey) {
    metrics.path = "consumable-script";
    const scriptResult = normalizeScriptUseResult(
      runScript(cons.effectKey, ScriptVerb.ItemUse, world, {
        actor,
        itemId,
        params: { ...(cons.effectParams || {}) },
      }),
    );
    if (scriptResult.cancelled) {
      ctx.cancel({
        code: String(scriptResult.code || "USE_CANCELLED"),
        message: String(scriptResult.message || "Use action cancelled."),
        consumesTurn: scriptResult.consumesTurn === true,
      });
      return { metrics };
    }
    consumed = scriptResult.consumed === true;
    payload = { scriptKey: String(cons.effectKey || ""), scriptResult };
  } else if (info) {
    // Path 2: item-use data defs (legacy adapter)
    metrics.path = "item-use-def";
    const legacyCtx = new ItemUseActionContext({
      world,
      actor,
      itemId,
      intent,
      info,
      identity,
    });
    const def = findItemUseDef(legacyCtx);
    if (def) {
      const run = typeof def.run === "function" ? def.run : def.action;
      consumed = executeUseAction(run, legacyCtx);
      payload = { defId: String(def.id || ""), identity };

      if (legacyCtx.cancelled) {
        legacyCtx.discard();
        const reason = legacyCtx.cancelReason || { code: "USE_CANCELLED", message: "Use action cancelled." };
        ctx.cancel(reason);
        return { metrics, payload };
      }

      const committed = legacyCtx.commit();
      metrics.legacyCommittedOps = Array.isArray(committed) ? committed.length : 0;
    } else {
      payload = { defId: null, identity };
    }
  } else {
    metrics.path = "no-info";
  }

  if (consumed) {
    ctx.mutate.consume(itemId, actor);
    ctx.io.emit("item:used", { actor, itemId });
    metrics.consumed = true;
  }

  return { metrics, payload };
}
