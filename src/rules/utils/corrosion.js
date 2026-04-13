import { Beatitude } from "../components/Beatitude.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { MaterialState } from "../components/MaterialState.js";
import { materialHasTag } from "../data/materials.js";
import { ensureMaterialState } from "./materialStimulus.js";

export const MAX_CORROSION_STACKS = 3;

export function isMetalMaterialKind(kind) {
  return materialHasTag(kind, "metal");
}

export function isMetalItemMaterial(world, itemId) {
  const mat = world.get(itemId, Material);
  return isMetalMaterialKind(mat?.kind);
}

export function corrosionResistOf(world, itemId, fallback = 0.5) {
  const mat = world.get(itemId, Material);
  if (mat && typeof mat.corrosionResist === "number") return mat.corrosionResist;
  return fallback;
}

export function isRustproofItemMaterial(world, itemId, threshold = 0.95) {
  return corrosionResistOf(world, itemId) >= threshold;
}

export function consumeBlessedRustWard(world, itemId) {
  const beat = world.get(itemId, Beatitude);
  if (!beat || beat.state !== "blessed") return false;
  world.set(itemId, Beatitude, { ...beat, state: "uncursed" });
  return true;
}

export function corrosionStacksOf(world, itemId) {
  const info = world.get(itemId, ItemInfo);
  const state = world.get(itemId, MaterialState);
  return Math.max(
    Number(state?.corrosionStacks || 0) | 0,
    Number(info?.corrosionStacks || 0) | 0,
    Number(state?.corrosion || 0) >= 0.34 ? 1 : 0,
  );
}

export function applyCorrosionStack(world, itemId, maxStacks = MAX_CORROSION_STACKS) {
  const info = world.get(itemId, ItemInfo);
  if (!info) return { applied: false, stacks: 0, reason: "no_item_info" };
  const rec = ensureMaterialState(world, itemId);
  const state = rec?.state;

  const stacks = corrosionStacksOf(world, itemId);
  if (stacks >= maxStacks) return { applied: false, stacks, reason: "maxed" };

  const next = stacks + 1;
  if (state) {
    state.corrosionStacks = next;
    state.corrosion = Math.max(
      Number(state.corrosion || 0),
      Math.min(1, next / Math.max(1, maxStacks)),
    );
  }
  // Compatibility mirror for one release.
  info.corrosionStacks = next;

  let reducedBonus = null;
  if (info.bonuses && typeof info.bonuses === "object") {
    let bestKey = null;
    let bestValue = 0;
    for (const [key, value] of Object.entries(info.bonuses)) {
      if (typeof value === "number" && value > bestValue) {
        bestKey = key;
        bestValue = value;
      }
    }
    if (bestKey) {
      info.bonuses[bestKey] = Math.max(0, info.bonuses[bestKey] - 1);
      reducedBonus = bestKey;
    }
  }

  return {
    applied: true,
    stacks: next,
    reachedMax: next >= maxStacks,
    reducedBonus,
  };
}
