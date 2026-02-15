import { ApplyIntent } from "../components/Intents/ApplyIntent.js";
import { Inventory } from "../components/Inventory.js";
import { findApplyDef } from "../data/applyDefs.js";
import { ItemApplyActionContext } from "../utils/actionContexts.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * applySystem — resolves ApplyIntent for applying a tool item to a target item.
 *
 * Cancellation: if def.run() calls ctx.cancel(), all queued mutations are
 * discarded and an 'item:apply-cancelled' event is emitted.
 * @param {World} world
 */
export function applySystem(world) {
  for (const [actor, intent] of world.query(ApplyIntent)) {
    const toolId = intent.itemId | 0;
    const targetId = intent.targetItemId | 0;
    if (!(toolId > 0) || !(targetId > 0)) { world.remove(actor, ApplyIntent); continue; }

    /** @type {{items:number[]}|null} */
    const inv = /** @type any */ (world.get(actor, Inventory));
    if (!inv || !Array.isArray(inv.items)) { world.remove(actor, ApplyIntent); continue; }

    // Both items must be in inventory
    if (!inv.items.includes(toolId) || !inv.items.includes(targetId)) {
      world.remove(actor, ApplyIntent);
      continue;
    }

    const def = findApplyDef(world, actor, toolId, targetId);
    if (def && typeof def.run === "function") {
      const ctx = new ItemApplyActionContext({ world, actor, toolId, targetId });
      try { def.run(ctx); } catch {}

      if (ctx.cancelled) {
        ctx.discard();
        const reason = ctx.cancelReason;
        try {
          world.emit?.("item:apply-cancelled", {
            actor,
            toolId,
            targetId,
            code: reason?.code,
            message: reason?.message,
            consumesTurn: reason?.consumesTurn,
          });
        } catch {}
        world.remove(actor, ApplyIntent);
        continue;
      }

      ctx.commit();
    }

    world.remove(actor, ApplyIntent);
  }
}
