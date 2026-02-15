import { UseIntent } from "../components/Intents/UseIntent.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Consumable } from "../components/Consumable.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { findItemUseDef } from "../data/itemUseDefs.js";
import { runScript, ScriptVerb } from "../scripting.js";
import { ItemUseActionContext } from "../utils/actionContexts.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * useItemSystem — resolves UseIntent for generic item use.
 *
 * Cancellation: if a def callback calls ctx.cancel(), the item is NOT consumed
 * and all queued effects are discarded.
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
 * @param {World} world
 */
export function useItemSystem(world) {
  for (const [actor, intent] of world.query(UseIntent)) {
    const itemId = intent.itemId | 0;
    if (!(itemId > 0)) { world.remove(actor, UseIntent); continue; }

    /** @type {{items:number[]}|null} */
    const inv = /** @type any */ (world.get(actor, Inventory));
    if (!inv || !Array.isArray(inv.items)) { world.remove(actor, UseIntent); continue; }

    // ensure item is in inventory
    const idx = inv.items.indexOf(itemId);
    if (idx === -1) { world.remove(actor, UseIntent); continue; }

    /** @type {{type?:string, description?:string, count?:number}|null} */
    const info = /** @type any */ (world.get(itemId, ItemInfo));
    /** @type {{identity?:string}|null} */
    const ni = /** @type any */ (world.get(itemId, NamedIdentity));
    /** @type {{effectKey?:string, effectParams?:object, remainingUses?:number}|null} */
    const cons = /** @type any */ (world.get(itemId, Consumable));
    const identity = String(ni?.identity || "").toLowerCase();

    let consumed = false;

    // Path 1: consumable with a scripting-registry effectKey
    if (cons && cons.effectKey) {
      try { runScript(cons.effectKey, ScriptVerb.ItemUse, world, { actor, itemId, params: { ...cons.effectParams } }); } catch {}
      consumed = true;
    } else if (info) {
      const context = new ItemUseActionContext({
        world,
        actor,
        itemId,
        intent,
        info,
        identity,
      });
      const def = findItemUseDef(context);
      if (def) {
        const run = typeof def.run === "function" ? def.run : def.action;
        consumed = executeUseAction(run, context);

        // Cancellation: discard queued effects, emit cancel event, skip consumption
        if (context.cancelled) {
          context.discard();
          const reason = context.cancelReason;
          try {
            world.emit?.("item:use-cancelled", {
              actor, itemId, code: reason?.code, message: reason?.message,
            });
          } catch {}
          world.remove(actor, UseIntent);
          continue;
        }

        // Commit queued mutations (damage, heal, effects)
        context.commit();
      }
    }

    // If consumed, decrement stack or destroy and remove from inventory
    if (consumed) {
      if (info && Number.isFinite(info?.count) && (info?.count ?? 0) > 1) {
        world.mutate(itemId, ItemInfo, /** @param {any} r */ (r) => { r.count = (r.count | 0) - 1; });
      } else {
        // remove from inventory list first to avoid dangling id
        if (idx >= 0) inv.items.splice(idx, 1);
        try { world.destroy(itemId); } catch {}
      }
      try { world.emit && world.emit("item:used", { actor, itemId }); } catch {}
    }

    // clear intent
    world.remove(actor, UseIntent);
  }
}
