import { ApplyIntent } from "../components/Intents/ApplyIntent.js";
import { Inventory } from "../components/Inventory.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { runScript, ScriptVerb } from "../scripting.js";
/** @typedef {import('../../lib/ecs-js/index.js').World} World */

/**
 * applySystem — resolves ApplyIntent for applying a tool item to a target item.
 * Looks up the tool's identity and dispatches via the scripting registry.
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

    const ni = /** @type any */ (world.get(toolId, NamedIdentity));
    const identity = ni?.identity || '';

    if (identity) {
      try {
        runScript(identity, ScriptVerb.ItemApply, world, { actor, toolId, targetId });
      } catch {}
    }

    world.remove(actor, ApplyIntent);
  }
}
