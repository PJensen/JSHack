import { FoodDecay } from "../../components/FoodDecay.js";
import { Hunger } from "../../components/Hunger.js";

const DECAY_STAGES = Object.freeze([
  Object.freeze({ name: "fresh", maxFrac: 0.33, nutritionMult: 1.0, sicknessChance: 0 }),
  Object.freeze({ name: "off", maxFrac: 0.66, nutritionMult: 0.75, sicknessChance: 0 }),
  Object.freeze({ name: "rancid", maxFrac: 0.99, nutritionMult: 0.5, sicknessChance: 0.2 }),
  Object.freeze({ name: "putrid", maxFrac: Infinity, nutritionMult: 0.25, sicknessChance: 0.8 }),
]);

/**
 * @param {any} decay
 */
function getDecayStage(decay) {
  if (!decay || typeof decay !== "object") return null;
  const turnsHeld = Number(decay.turnsHeld || 0);
  const shelfLife = Number(decay.shelfLife || 0);
  const frac = shelfLife > 0 ? turnsHeld / shelfLife : 1;
  for (let i = 0; i < DECAY_STAGES.length; i++) {
    if (frac <= DECAY_STAGES[i].maxFrac) return DECAY_STAGES[i];
  }
  return DECAY_STAGES[DECAY_STAGES.length - 1];
}

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
 * @param {{
 *   consumeOnSuccess?: boolean,
 * }} [opts]
 */
export function createEatOnUseHook(opts = {}) {
  const consumeOnSuccess = opts.consumeOnSuccess !== false;

  return (ctx, state) => {
    const actor = Number(state?.actor || ctx.actor || 0) | 0;
    const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
    const effectParams = (state?.effectParams && typeof state.effectParams === "object")
      ? state.effectParams
      : {};
    const baseNutrition = Number(effectParams.nutrition || 0);

    let nutritionTotal = 0;
    const decay = ctx.query.get(itemId, FoodDecay);
    const decayInfo = getDecayStage(decay);
    const nutrition = decayInfo ? Math.floor(baseNutrition * decayInfo.nutritionMult) : baseNutrition;
    if (Number.isFinite(nutrition) && nutrition !== 0) {
      ctx.mutate.queue({ type: "nutrition", entityId: actor, nutrition });
      nutritionTotal += nutrition;
    }

    if (decayInfo && ctx.helpers.chance(decayInfo.sicknessChance)) {
      ctx.mutate.pushEffect(actor, { key: "disease", turnsLeft: 15, potency: 1, stacks: 1, sourceId: itemId });
      ctx.io.emit("hunger:sickened", { actor, type: "decay" });
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
      consumed: consumeOnSuccess,
      nutrition: nutritionTotal,
      decayStage: decayInfo?.stage || "fresh",
    };
  };
}

/**
 * @param {{
 *   consumeOnSuccess?: boolean,
 * }} [opts]
 */
export function createMappingOnUseHook(opts = {}) {
  const consumeOnSuccess = opts.consumeOnSuccess !== false;
  return (ctx) => {
    ctx.mutate.queue({ type: "revealLoadedMap" });
    return {
      consumed: consumeOnSuccess,
      revealMap: true,
    };
  };
}
