import { Traits } from "../components/Traits.js";
import { Hunger } from "../components/Hunger.js";
import { Vitality } from "../components/Vitality.js";
import { getHungerLevel } from "../data/food.js";
import { getEffectiveVisionRange } from "./blind.js";
import { statusStrength } from "./statusFacade.js";

export const MIN_SCROLL_READING_VISION = 3;

function clamp01(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function readTraitThirdEye(traits) {
  return traits?.third_eye === true;
}

function hungerDistraction(hunger) {
  if (!hunger || Number(hunger.satiation || 0) > 0) return 0;
  switch (getHungerLevel(Number(hunger.hunger || 0))) {
    case "hungry": return 1;
    case "famished": return 2;
    case "starving": return 3;
    case "wasting": return 4;
    default: return 0;
  }
}

function woundDistraction(vitality) {
  const hp = Number(vitality?.hp || 0);
  const maxHp = Math.max(1, Number(vitality?.maxHp || 0));
  if (!(hp > 0)) return 4;
  const missing = 1 - (hp / maxHp);
  if (missing >= 0.75) return 3;
  if (missing >= 0.50) return 2;
  if (missing >= 0.25) return 1;
  return 0;
}

export function evaluateScrollReadingQuality(input = {}) {
  const effectiveVisionRange = Math.max(0, Number(input.effectiveVisionRange ?? 0));
  const blinded = Math.max(0, Number(input.blinded || 0));
  const confused = Math.max(0, Number(input.confused || 0));
  const hallucinating = Math.max(0, Number(input.hallucinating || 0));
  const hunger = Math.max(0, Number(input.hungerDistraction || 0));
  const wounded = Math.max(0, Number(input.woundDistraction || 0));
  const thirdEye = readTraitThirdEye(input.traits);

  let canRead = true;
  let reason = "";
  if (!thirdEye && blinded > 0) {
    canRead = false;
    reason = "blinded";
  } else if (!thirdEye && effectiveVisionRange < MIN_SCROLL_READING_VISION) {
    canRead = false;
    reason = "low_vision";
  }

  const visionPenalty = thirdEye
    ? 0
    : Math.max(0, MIN_SCROLL_READING_VISION + 2 - effectiveVisionRange) * 0.08;
  const fumbleChance = clamp01(
    0
    + visionPenalty
    + blinded * 0.20
    + confused * 0.08
    + hallucinating * 0.12
    + hunger * 0.06
    + wounded * 0.05
  );

  return {
    canRead,
    reason,
    effectiveVisionRange,
    blinded,
    confused,
    hallucinating,
    hunger,
    wounded,
    thirdEye,
    fumbleChance: Math.min(0.75, fumbleChance),
  };
}

export function getScrollReadingQuality(world, actorId) {
  const id = Number(actorId || 0) | 0;
  return evaluateScrollReadingQuality({
    effectiveVisionRange: getEffectiveVisionRange(world, id),
    blinded: statusStrength(world, id, "blinded"),
    confused: statusStrength(world, id, "confused"),
    hallucinating: statusStrength(world, id, "hallucinating"),
    hungerDistraction: hungerDistraction(world.get(id, Hunger)),
    woundDistraction: woundDistraction(world.get(id, Vitality)),
    traits: world.get(id, Traits),
  });
}

export function getScrollReadingQualityFromContext(ctx, actorId) {
  const id = Number(actorId || 0) | 0;
  return evaluateScrollReadingQuality({
    effectiveVisionRange: ctx?.query?.effectiveVisionRange?.(id) ?? 0,
    blinded: ctx?.query?.statusStrength?.(id, "blinded") ?? 0,
    confused: ctx?.query?.statusStrength?.(id, "confused") ?? 0,
    hallucinating: ctx?.query?.statusStrength?.(id, "hallucinating") ?? 0,
    hungerDistraction: hungerDistraction(ctx?.query?.get?.(id, Hunger)),
    woundDistraction: woundDistraction(ctx?.query?.get?.(id, Vitality)),
    traits: ctx?.query?.get?.(id, Traits),
  });
}

export function emitScrollReadFailure(io, actor, itemId, quality) {
  const reason = String(quality?.reason || "unreadable");
  io?.emit?.("scroll:read-failed", {
    actor,
    itemId,
    reason,
    effectiveVisionRange: Number(quality?.effectiveVisionRange || 0),
  });
  if (reason === "blinded") {
    io?.emit?.("scroll:wasted_blind", { actor, itemId });
  }
}

export function resolveScrollEffectDuration(world, actorId, opts = {}) {
  void world; void actorId;
  const baseTurns = Math.max(1, Number(opts.baseTurns ?? 50) | 0);
  const minTurns = Math.max(1, Number(opts.minTurns ?? 1) | 0);
  const maxTurns = Math.max(minTurns, Number(opts.maxTurns ?? 9999) | 0);
  return {
    turns: Math.max(minTurns, Math.min(maxTurns, baseTurns | 0)),
  };
}
