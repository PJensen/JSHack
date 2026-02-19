import { DrinkIntent } from "../components/Intents/DrinkIntent.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { executeInteraction } from "../interaction/runtime/actionRuntime.js";
import { drinkPipeline } from "../interaction/verbs/drinkPipeline.js";
import { getDrinkPayloadByIdentity } from "../content/items/drinkPayloads.js";

/**
 * drinkSystem — canonical intent consumer for the `drink` verb.
 * Execution is delegated to Action Runtime + drink pipeline.
 */
export function drinkSystem(world) {
  for (const [actor, intent] of world.query(DrinkIntent)) {
    const itemId = intent.itemId | 0;
    const targetId = intent.targetId | 0;
    const identity = String(world.get(itemId, NamedIdentity)?.identity || "");
    const payload = getDrinkPayloadByIdentity(identity);
    let result = null;

    try {
      result = executeInteraction(world, {
        verb: "drink",
        actor,
        primary: itemId,
        target: targetId,
        params: { stepHint: world.step | 0, payload },
        pipeline: drinkPipeline,
      });
    } catch (error) {
      result = {
        schemaVersion: 1,
        kind: "interaction",
        verb: "drink",
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

    try { world.emit?.("interaction:result", result); } catch {}
    try { world.remove(actor, DrinkIntent); } catch {}
  }
}
