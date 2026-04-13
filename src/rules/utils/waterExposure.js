import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { materialHasTag } from "../data/materials.js";
import { applyMaterialStimulus } from "./materialStimulus.js";
import {
  applyCorrosionStack,
  consumeBlessedRustWard,
  isMetalItemMaterial,
  isRustproofItemMaterial,
  MAX_CORROSION_STACKS,
} from "./corrosion.js";

const MAX_WATER_STACKS = 3;

function bumpStack(info, key, maxStacks = MAX_WATER_STACKS) {
  if (!info || typeof info !== "object") return 0;
  const current = Number(info[key] || 0) | 0;
  const next = Math.min(maxStacks, Math.max(0, current + 1));
  info[key] = next;
  return next;
}

function emitWaterCondition(world, effect, payload = {}) {
  const safe = { ...payload, effect: String(effect || "wet") };
  world.emit?.("item:waterCondition", safe);
  if (effect === "waterlogged") world.emit?.("item:waterlogged", safe);
  if (effect === "soggy") world.emit?.("item:soggy", safe);
  if (effect === "swollen") world.emit?.("item:swollen", safe);
  if (effect === "diluted") world.emit?.("item:diluted", safe);
}

/**
 * Canonical pathway for water exposure item outcomes from dips.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {{ actor?: number, sourceId?: number, waterType?: string }} [opts]
 */
export function applyWaterExposure(world, itemId, opts = {}) {
  const info = world.get(itemId, ItemInfo);
  const mat = world.get(itemId, Material);
  const type = String(info?.type || "").toLowerCase();
  const kind = String(mat?.kind || "").toLowerCase();
  const stimulus = applyMaterialStimulus(world, itemId, {
    kind: "water",
    mode: "dip",
    intensity: 1,
    duration: 1,
  });
  const wetness = Math.max(0, Number(stimulus?.state?.wetness || 0));
  const payload = {
    actor: Number(opts.actor || 0) | 0,
    sourceId: Number(opts.sourceId || 0) | 0,
    itemId: itemId | 0,
    waterType: String(opts.waterType || "plain"),
  };

  if (isMetalItemMaterial(world, itemId)) {
    if (isRustproofItemMaterial(world, itemId)) {
      return { effect: "resist", applied: false, stacks: 0 };
    }
    if (consumeBlessedRustWard(world, itemId)) {
      return { effect: "blessedResist", applied: true, stacks: 0 };
    }
    const corrosion = applyCorrosionStack(world, itemId, MAX_CORROSION_STACKS);
    if (corrosion.applied) {
      return { effect: "rust", applied: true, stacks: Number(corrosion.stacks || 0) | 0 };
    }
    if (corrosion.reason === "maxed") return { effect: "nothing", applied: false, stacks: MAX_CORROSION_STACKS };
    return { effect: "wet", applied: false, stacks: 0 };
  }

  if (!info) return { effect: "wet", applied: false, stacks: 0 };

  if (materialHasTag(kind, "paper") || type === "scroll" || type === "learn" || type === "book") {
    const stacks = Math.max(bumpStack(info, "waterloggedStacks"), wetness >= 0.8 ? 2 : (wetness >= 0.35 ? 1 : 0));
    if (stacks > Number(info.waterloggedStacks || 0)) info.waterloggedStacks = stacks;
    const ruined = (type === "scroll" || type === "learn" || type === "book") && stacks >= 2;
    if (ruined) info.ruinedByWater = true;
    emitWaterCondition(world, "waterlogged", { ...payload, stacks, ruined });
    return { effect: "waterlogged", applied: true, stacks, ruined };
  }

  if ((type === "potion" || type === "elixir") && materialHasTag(kind, "glass")) {
    const stacks = Math.max(bumpStack(info, "dilutedStacks"), wetness >= 0.5 ? 1 : 0);
    if (stacks > Number(info.dilutedStacks || 0)) info.dilutedStacks = stacks;
    emitWaterCondition(world, "diluted", { ...payload, stacks });
    return { effect: "diluted", applied: true, stacks };
  }

  if (materialHasTag(kind, "wood") || type === "wand" || type === "staff") {
    const stacks = Math.max(bumpStack(info, "swollenStacks"), wetness >= 0.55 ? 1 : 0);
    if (stacks > Number(info.swollenStacks || 0)) info.swollenStacks = stacks;
    emitWaterCondition(world, "swollen", { ...payload, stacks });
    return { effect: "swollen", applied: true, stacks };
  }

  if (type === "food" || materialHasTag(kind, "organic")) {
    const stacks = Math.max(bumpStack(info, "soggyStacks"), wetness >= 0.45 ? 1 : 0);
    if (stacks > Number(info.soggyStacks || 0)) info.soggyStacks = stacks;
    emitWaterCondition(world, "soggy", { ...payload, stacks });
    return { effect: "soggy", applied: true, stacks };
  }

  return { effect: "wet", applied: false, stacks: 0 };
}

/**
 * @param {any} ctx
 * @param {any} state
 */
export function interceptUseForWaterDamage(ctx, state) {
  const actor = Number(state?.actor || ctx.actor || 0) | 0;
  const itemId = Number(state?.itemId || ctx.primary || 0) | 0;
  const info = state?.info;
  if (!info) return null;

  const type = String(info.type || "").toLowerCase();
  const wetness = Math.max(0, Number(state?.materialState?.wetness || 0));
  const waterlogged = Math.max(Number(info.waterloggedStacks || 0) | 0, wetness >= 0.35 ? 1 : 0);
  const diluted = Math.max(Number(info.dilutedStacks || 0) | 0, wetness >= 0.5 ? 1 : 0);
  const swollen = Math.max(Number(info.swollenStacks || 0) | 0, wetness >= 0.55 ? 1 : 0);
  const soggy = Math.max(Number(info.soggyStacks || 0) | 0, wetness >= 0.45 ? 1 : 0);

  if ((type === "scroll" || type === "learn" || type === "book") && waterlogged > 0) {
    ctx.io.emit("item:ruinedByWater", { actor, itemId, stacks: waterlogged });
    return { consumed: true, intercepted: true, reason: "waterlogged" };
  }

  if (type === "potion" && diluted > 0) {
    ctx.io.emit("item:dilutedFizzle", { actor, itemId, stacks: diluted });
    return { consumed: true, intercepted: true, reason: "diluted" };
  }

  if ((type === "wand" || type === "staff") && swollen > 0) {
    const failChance = Math.min(0.75, 0.2 * swollen);
    if (ctx.helpers?.chance?.(failChance)) {
      ctx.io.emit("item:swollenMisfire", { actor, itemId, stacks: swollen, failChance });
      return {
        consumed: false,
        intercepted: true,
        cancelled: true,
        code: "USE_WET_MISFIRE",
        message: "The damp core sputters and refuses to discharge.",
        consumesTurn: true,
      };
    }
  }

  if (type === "food" && soggy > 0) {
    const nutritionMult = Math.max(0.35, 1 - (0.2 * soggy));
    const effectParams = (state?.effectParams && typeof state.effectParams === "object")
      ? { ...state.effectParams }
      : {};
    if (Number.isFinite(Number(effectParams.nutrition || NaN))) {
      effectParams.nutrition = Math.max(1, Math.floor(Number(effectParams.nutrition) * nutritionMult));
      state.effectParams = effectParams;
      ctx.io.emit("item:soggyNutritionPenalty", { actor, itemId, stacks: soggy, nutritionMult });
    }
  }

  return null;
}
