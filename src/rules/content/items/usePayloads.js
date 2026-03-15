import { getItemHooksByIdentity } from "./itemHooks.js";
import { FoodDecay } from "../../components/FoodDecay.js";
import { Hunger } from "../../components/Hunger.js";
import { NamedIdentity } from "../../components/NamedIdentity.js";
import { Owner } from "../../components/Owner.js";
import { Pet } from "../../components/Pet.js";
import { Traits } from "../../components/Traits.js";
import { getDecayStage } from "../../data/food.js";
import { getCorpseEatHooks } from "../../data/corpseFood.js";
import { runCallbackList } from "../../interaction/dispatch.js";
import { createCombatStatFacade } from "../../utils/resolveCombatSnapshot.js";

/**
 * @param {any} hunger
 * @param {number} nutrition
 */
function projectHungerAfterNutrition(hunger, nutrition) {
  const amount = Number(nutrition || 0);
  const currentHunger = Number(hunger?.hunger || 0);
  const currentSatiation = Number(hunger?.satiation || 0);
  const nextHungerRaw = currentHunger - amount;
  if (nextHungerRaw < 0) {
    return {
      hunger: 0,
      satiation: Math.min(currentSatiation + Math.abs(nextHungerRaw), 200),
    };
  }
  return {
    hunger: nextHungerRaw,
    satiation: currentSatiation,
  };
}

/**
 * @param {any} ctx
 * @param {any} state
 */
function runCorpseEatHooks(ctx, state) {
  const actor = Number(state?.actor || ctx.actor || 0) | 0;
  const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
  const effectParams = (state?.effectParams && typeof state.effectParams === "object")
    ? state.effectParams
    : {};
  const baseNutrition = Number(effectParams.nutrition || 0);
  const corpseIdentityParam = String(effectParams.corpseIdentity || "").toLowerCase();

  let nutritionTotal = 0;
  const decay = ctx.query.get(itemId, FoodDecay);
  const decayInfo = decay ? getDecayStage(decay.turnsHeld, decay.shelfLife) : null;
  const nutrition = decayInfo ? Math.floor(baseNutrition * decayInfo.nutritionMult) : baseNutrition;
  if (Number.isFinite(nutrition) && nutrition !== 0) {
    ctx.mutate.queue({ type: "nutrition", entityId: actor, nutrition });
    nutritionTotal += nutrition;
  }

  const actorTraits = ctx.query.get(actor, Traits);
  const sicknessChance = actorTraits?.iron_stomach
    ? decayInfo?.sicknessChance * 0.5
    : decayInfo?.sicknessChance;
  if (decayInfo && ctx.helpers.chance(sicknessChance)) {
    ctx.mutate.pushEffect(actor, { key: "disease", turnsLeft: 15, potency: 1, stacks: 1, sourceId: itemId });
    ctx.io.emit("hunger:sickened", { actor, type: "decay" });
  }

  const corpseIdentity = corpseIdentityParam || String(state?.identity || "").toLowerCase();
  const hooks = getCorpseEatHooks(corpseIdentity);
  if (Array.isArray(hooks) && hooks.length > 0) {
    const statWorld = {
      get(entityId, Comp) {
        return ctx.query.get(entityId | 0, Comp);
      },
      isAlive(entityId) {
        return ctx.query.alive(entityId | 0);
      },
    };
    const stats = createCombatStatFacade(statWorld, {
      actor: () => actor,
      primary: () => itemId,
      target: () => actor,
    });

    const bridgeCtx = {
      world: { get: (entityId, Comp) => ctx.query.get(entityId | 0, Comp) },
      actor,
      itemId,
      stats,
      cancelled: false,
      cancelReason: null,
      applyNutrition(amount) {
        const value = Number(amount || 0);
        if (!Number.isFinite(value) || value === 0) return false;
        nutritionTotal += value;
        ctx.mutate.queue({ type: "nutrition", entityId: actor, nutrition: value });
        return true;
      },
      emit(eventName, payload) {
        ctx.io.emit(String(eventName || ""), payload && typeof payload === "object" ? { ...payload } : payload);
      },
      pushEffect(effect) {
        if (!effect || typeof effect !== "object") return;
        ctx.mutate.pushEffect(actor, { ...effect });
      },
      damage(amount, source = "corpse") {
        const value = Number(amount || 0);
        if (!(value > 0)) return 0;
        ctx.mutate.damage(actor, value | 0, String(source || "corpse"));
        return value | 0;
      },
      grantElectricResistance(minOhms = 2400, fibrillationA = 0.03) {
        ctx.mutate.queue({
          type: "grantElectricResistance",
          entityId: actor,
          minOhms: Number(minOhms),
          fibrillationA: Number(fibrillationA),
        });
      },
      chance(prob) {
        return ctx.helpers.chance(prob);
      },
      setTrait(key, value) {
        ctx.mutate.queue({ type: "setTrait", entityId: actor, key: String(key || ""), value });
      },
      cancel(reason) {
        this.cancelled = true;
        this.cancelReason = typeof reason === "string"
          ? { code: "USE_CANCELLED", message: reason, consumesTurn: true }
          : (reason && typeof reason === "object"
            ? { ...reason }
            : { code: "USE_CANCELLED", message: "You cannot use that.", consumesTurn: true });
      },
    };

    runCallbackList(hooks, bridgeCtx);
    if (bridgeCtx.cancelled) {
      ctx.cancel({
        code: String(bridgeCtx.cancelReason?.code || "USE_CANCELLED"),
        message: String(bridgeCtx.cancelReason?.message || "Use action cancelled."),
        consumesTurn: bridgeCtx.cancelReason?.consumesTurn === true,
      });
      return {
        consumed: false,
        cancelled: true,
        reason: bridgeCtx.cancelReason,
        nutrition: nutritionTotal,
        decayStage: decayInfo?.stage || "fresh",
      };
    }
  }

  // Preserve deity trigger semantics for pet corpse desecration.
  if (itemId > 0 && ctx.query.has(itemId, Pet)) {
    const owner = ctx.query.get(itemId, Owner);
    const corpseIdent = ctx.query.get(itemId, NamedIdentity);
    ctx.io.emit("corpse:desecrated", {
      actor,
      itemId,
      ownerId: owner?.ownerId || 0,
      corpseName: corpseIdent?.name || "pet corpse",
    });
  }

  const hunger = ctx.query.get(actor, Hunger);
  if (hunger && Number.isFinite(nutritionTotal) && nutritionTotal !== 0) {
    const projected = projectHungerAfterNutrition(hunger, nutritionTotal);
    ctx.io.emit("hunger:ate", {
      actor,
      nutrition: nutritionTotal,
      newHunger: projected.hunger,
      satiation: projected.satiation,
    });
  }

  return {
    consumed: true,
    nutrition: nutritionTotal,
    decayStage: decayInfo?.stage || "fresh",
  };
}

export const USE_ITEM_PAYLOADS = Object.freeze({});

export const USE_ITEM_MATCHER_PAYLOADS = Object.freeze([
  Object.freeze({
    id: "corpse_use_hook_payload",
    matches(state) {
      return String(state?.identity || "").startsWith("corpse_");
    },
    onUse: runCorpseEatHooks,
  }),
]);

/**
 * Resolve a first-class use payload object for the current item state.
 * Priority:
 * 1. Exact item identity payload object
 * 2. Item-def hooks (including snake_case aliases)
 * 3. Matcher payload object
 *
 * @param {{
 *   identity: string,
 *   info: any,
 *   consumable?: any,
 * }} state
 */
export function findUsePayload(state) {
  const identity = String(state?.identity || "");
  const direct = USE_ITEM_PAYLOADS[identity];
  if (direct) return { ...direct, source: "identity" };

  const hooks = getItemHooksByIdentity(identity);
  const hasItemUseHooks = (
    typeof hooks.beforeUse === "function"
    || typeof hooks.onUse === "function"
    || typeof hooks.afterUse === "function"
  );
  if (hasItemUseHooks) {
    return {
      id: `item:${identity}:hooks`,
      source: "itemHooks",
      beforeUse: hooks.beforeUse,
      onUse: hooks.onUse,
      afterUse: hooks.afterUse,
    };
  }

  for (let i = 0; i < USE_ITEM_MATCHER_PAYLOADS.length; i++) {
    const payload = USE_ITEM_MATCHER_PAYLOADS[i];
    try {
      if (payload.matches(state)) return { ...payload, source: "matcher" };
    } catch (e) { console.error('[usePayloads] matcher failed:', e); }
  }

  return null;
}
