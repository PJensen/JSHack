// Consumable item use scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { Hunger } from "../components/Hunger.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Vitality } from "../components/Vitality.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";
import { runCorpseUseProc } from "../data/food.js";

/**
 * @param {any} world
 * @param {number} actor
 * @param {number} itemId
 */
function createCorpseUseContext(world, actor, itemId) {
  return {
    world,
    actor,
    itemId,
    emit(eventName, payload) {
      try { world.emit && world.emit(eventName, payload); } catch { /* */ }
    },
    pushEffect(effect) {
      let ae = world.get(actor, ActiveEffects);
      if (!ae) {
        try { world.add(actor, ActiveEffects, { effects: [] }); ae = world.get(actor, ActiveEffects); } catch { /* */ }
      }
      if (!ae || !Array.isArray(ae.effects)) return;
      ae.effects.push(effect);
    },
    damage(amount, source = "corpse") {
      const vit = world.get(actor, Vitality);
      if (!vit) return 0;
      const dmg = Math.max(0, amount | 0);
      if (dmg <= 0) return 0;
      vit.hp = Math.max(0, (vit.hp | 0) - dmg);
      try { world.emit && world.emit("damage", { id: actor, amount: dmg, source }); } catch { /* */ }
      return dmg;
    },
  };
}

// Eat food: reduce hunger by nutrition, convert surplus to satiation,
// and run per-corpse callback effects.
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

    const corpseType = corpseTypeParam || String((world.get(itemId, NamedIdentity)?.identity || "").replace(/^corpse_/, ""));
    if (!corpseType) return;
    runCorpseUseProc(corpseType, createCorpseUseContext(world, actor, itemId));
  },
});

// Scroll of Mapping: reveal entire dungeon map.
registerScript('consumable:mapping', {
  [ScriptVerb.ItemUse]: (_world, _ctx) => {
    forEachLoadedTile((x, y) => markExplored(x, y));
  },
});
