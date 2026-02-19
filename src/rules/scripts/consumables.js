// Consumable item use scripts.
// Imported by scheduler.js for side-effect registration (same pattern as traps.js).

import { registerScript, ScriptVerb } from "../scripting.js";
import { Hunger } from "../components/Hunger.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { forEachLoadedTile } from "../environment/dungeon/tileMap.js";
import { markExplored } from "../environment/dungeon/exploredMap.js";
import { getCorpseEatHooks, getDecayStage } from "../data/food.js";
import { EatCallbackContext } from "../data/callbacks/eat.js";
import { runCallbackList } from "../interaction/dispatch.js";
import { FoodDecay } from "../components/FoodDecay.js";

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} chance
 */
function rollChance(world, chance) {
  const pct = Number(chance || 0);
  if (!(pct > 0)) return false;
  const rand = typeof world?.rand === "function" ? Number(world.rand()) : Number.NaN;
  if (!Number.isFinite(rand)) return false;
  return rand < pct;
}

// Eat food: reduce hunger by nutrition, convert surplus to satiation,
// and run per-corpse callback effects from corpse item data.
// Params: { nutrition: number, corpseIdentity?: string }
registerScript('consumable:eat', {
  [ScriptVerb.ItemUse]: (world, ctx) => {
    const actor = Number(ctx?.actor || 0) || 0;
    const itemId = Number(ctx?.itemId || 0) || 0;
    const baseNutrition = Number(ctx?.params?.nutrition || 0);
    const corpseIdentityParam = String(ctx?.params?.corpseIdentity || "").toLowerCase();

    // Factor in food decay: scale nutrition and roll for sickness
    const decay = world.get(itemId, FoodDecay);
    const decayInfo = decay ? getDecayStage(decay.turnsHeld, decay.shelfLife) : null;
    const nutrition = decayInfo ? Math.floor(baseNutrition * decayInfo.nutritionMult) : baseNutrition;

    const eatCtx = new EatCallbackContext(world, actor, itemId);
    eatCtx.applyNutrition(nutrition);

    // Rancid/putrid food can cause sickness
    if (decayInfo && rollChance(world, decayInfo.sicknessChance)) {
      eatCtx.pushEffect({ key: 'disease', turnsLeft: 15, potency: 1, stacks: 1, sourceId: itemId });
      eatCtx.emit('hunger:sickened', { actor, type: 'decay' });
    }

    // Resolve corpse identity and run per-corpse item hooks.
    const corpseIdentity = corpseIdentityParam || String(world.get(itemId, NamedIdentity)?.identity || "").toLowerCase();
    const hooks = getCorpseEatHooks(corpseIdentity);
    if (Array.isArray(hooks) && hooks.length > 0) {
      runCallbackList(hooks, eatCtx);
    }

    if (eatCtx.cancelled) {
      const reason = eatCtx.cancelReason || { code: "CANCELLED", message: "Cancelled" };
      eatCtx.discard();
      return {
        consumed: false,
        cancelled: true,
        code: reason.code,
        message: reason.message,
        consumesTurn: reason.consumesTurn,
      };
    }

    eatCtx.commit();

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

    const hc = world.get(actor, Hunger);
    if (hc && Number.isFinite(nutrition) && nutrition !== 0) {
      try {
        world.emit && world.emit('hunger:ate', {
          actor, nutrition, newHunger: hc.hunger, satiation: hc.satiation,
        });
      } catch { /* */ }
    }

    return { consumed: true };
  },
});

// Scroll of Mapping: reveal entire dungeon map.
registerScript('consumable:mapping', {
  [ScriptVerb.ItemUse]: (_world, _ctx) => {
    forEachLoadedTile((x, y) => markExplored(x, y));
  },
});
