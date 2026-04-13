import { Material } from "../components/Material.js";
import { MaterialState } from "../components/MaterialState.js";
import { getMaterialIntrinsic } from "../data/materials.js";
import { materialHasTag } from "../data/materials.js";

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v || 0)));
}

export function ensureMaterialState(world, itemId) {
  const mat = world.get(itemId, Material);
  const primary = String(mat?.kind || "");
  let state = world.get(itemId, MaterialState);
  if (!state) {
    world.add(itemId, MaterialState, {
      primary,
      wetness: 0,
      heatC: 20,
      corrosion: 0,
      corrosionStacks: 0,
      waterloggedStacks: 0,
      soggyStacks: 0,
      swollenStacks: 0,
      dilutedStacks: 0,
      ruinedByWater: false,
      soot: 0,
      burning: false,
      brittleBonus: 0,
    });
    state = world.get(itemId, MaterialState);
  } else if (!state.primary && primary) {
    state.primary = primary;
  }
  return { state, mat, intrinsic: getMaterialIntrinsic(primary) };
}

/**
 * Apply one interaction stimulus to an item's mutable material state.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {{ kind: string, mode?: string, intensity?: number, duration?: number }} stimulus
 */
export function applyMaterialStimulus(world, itemId, stimulus = { kind: "" }) {
  const kind = String(stimulus?.kind || "").toLowerCase();
  if (!kind) return { applied: false, state: null };
  const intensity = Math.max(0, Number(stimulus?.intensity ?? 1));
  const duration = Math.max(0, Number(stimulus?.duration ?? 1));
  const mode = String(stimulus?.mode || "contact");

  const rec = ensureMaterialState(world, itemId);
  const state = rec?.state;
  const intrinsic = rec?.intrinsic;
  if (!state) return { applied: false, state: null };

  if (kind === "water") {
    const absorb = Math.max(0, Number(intrinsic?.wetAbsorbency || 0));
    const wetDelta = absorb * intensity * duration;
    state.wetness = clamp01(Number(state.wetness || 0) + wetDelta);

    // Corrosion is a metal-specific mechanic; non-metals only track wetness.
    if (materialHasTag(rec?.mat?.kind, "metal")) {
      const antiCorrosion = Math.max(0, Number(intrinsic?.corrosionResist || 0));
      const corrosionDelta = Math.max(0, (1 - antiCorrosion) * intensity * duration * 0.25);
      state.corrosion = clamp01(Number(state.corrosion || 0) + corrosionDelta);
    }
    return { applied: true, state, mode };
  }

  if (kind === "fire") {
    const heatGain = intensity * duration * 180;
    state.heatC = Math.max(0, Number(state.heatC || 20) + heatGain);
    const igniteAt = Number(intrinsic?.ignitionTempC ?? Infinity);
    const flammable = Number(intrinsic?.flammability || 0) > 0;
    if (flammable && Number.isFinite(igniteAt) && state.heatC >= igniteAt) {
      state.burning = true;
      state.soot = clamp01(Number(state.soot || 0) + 0.25 * intensity * duration);
    }
    return { applied: true, state, mode };
  }

  return { applied: false, state, mode };
}
