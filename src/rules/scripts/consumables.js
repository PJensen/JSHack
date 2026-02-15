// Consumable item use scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { Hunger } from "../components/Hunger.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";
import { getMonster } from "../data/monsters.js";
import { EatCallbackContext, CORPSE_EAT_HOOKS } from "../data/callbacks/eat.js";
import { runCallbackList } from "../interaction/dispatch.js";

// Eat food: reduce hunger by nutrition, convert surplus to satiation,
// and run per-corpse callback effects from monster definition hooks.
// Params: { nutrition: number, corpseType?: string }
registerScript('consumable:eat', {
  [ScriptVerb.ItemUse]: (world, ctx) => {
    const actor = Number(ctx?.actor || 0) || 0;
    const itemId = Number(ctx?.itemId || 0) || 0;
    const nutrition = Number(ctx?.params?.nutrition || 0);
    const corpseTypeParam = String(ctx?.params?.corpseType || "").toLowerCase();

    const hc = world.get(actor, Hunger);

    // Check if this is a pet corpse being eaten (desecration!)
    if (itemId > 0 && world.has(itemId, Pet)) {
      const owner = world.get(itemId, Owner);
      const corpseIdent = world.get(itemId, NamedIdentity);
      try {
        world.emit && world.emit('corpse:desecrated', {
          actor,
          itemId,
          ownerId: owner?.ownerId || 0,
          corpseName: corpseIdent?.name || 'pet corpse',
        });
      } catch { /* */ }
    }

    if (hc) {
      const newHunger = hc.hunger - nutrition;
      if (newHunger < 0) {
        hc.satiation = Math.min(hc.satiation + Math.abs(newHunger), 200);
        hc.hunger = 0;
      } else {
        hc.hunger = newHunger;
      }

      try {
        world.emit && world.emit('hunger:ate', {
          actor, nutrition, newHunger: hc.hunger, satiation: hc.satiation,
        });
      } catch { /* */ }
    }

    // Resolve corpse type and run eat hooks from monster definition
    const corpseType = corpseTypeParam || String((world.get(itemId, NamedIdentity)?.identity || "").replace(/^corpse_/, ""));
    if (!corpseType) return;

    const monsterDef = getMonster(corpseType);
    const hooks = monsterDef?.hooks?.eat || CORPSE_EAT_HOOKS[corpseType];
    if (hooks) {
      const eatCtx = new EatCallbackContext(world, actor, itemId);
      runCallbackList(hooks, eatCtx);
    }
  },
});

// Scroll of Mapping: reveal entire dungeon map.
registerScript('consumable:mapping', {
  [ScriptVerb.ItemUse]: (_world, _ctx) => {
    forEachLoadedTile((x, y) => markExplored(x, y));
  },
});
