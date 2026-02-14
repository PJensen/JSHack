// Apply-tool scripts.
// Imported by scheduler.js for side-effect registration.

import { registerScript, ScriptVerb } from "../scripting.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { getGem } from "../data/gems.js";

// Touchstone: rub a gem/stone against the touchstone to learn its hardness.
// In NetHack, hard gems leave a streak on the touchstone; soft gems and glass do not.
registerScript('stone_touchstone', {
  [ScriptVerb.ItemApply]: (world, ctx) => {
    const actor = Number(ctx?.actor || 0) || 0;
    const toolId = Number(ctx?.toolId || 0) || 0;
    const targetId = Number(ctx?.targetId || 0) || 0;
    if (!actor || !targetId) return;

    const targetNi = world.get(targetId, NamedIdentity);
    const identity = targetNi?.identity || '';
    const gem = getGem(identity);

    if (!gem) {
      try { world.emit?.('item:applied', { actor, toolId, targetId, result: { type: 'nothing' } }); } catch {}
      return;
    }

    const result = {
      type: 'touchstone',
      gemName: gem.name,
      appearance: gem.appearance,
      hardness: gem.hardness,
      material: gem.material,
    };

    try { world.emit?.('item:applied', { actor, toolId, targetId, result }); } catch {}
  },
});
