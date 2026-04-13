import { ItemInfo } from "../components/ItemInfo.js";
import { Material } from "../components/Material.js";
import { MaterialState } from "../components/MaterialState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

function isAshIdentity(identity) {
  const key = String(identity || "").toLowerCase();
  return key === "ash" || key === "ashes";
}

/**
 * Decide whether a threshold-driven transform should fire.
 * @param {{
 *  stimulusKind?: string,
 *  requestedTransform?: string,
 *  identity?: string,
 *  state?: any,
 * }} spec
 */
export function resolveMaterialTransform(spec = {}) {
  const stimulusKind = String(spec?.stimulusKind || "").toLowerCase();
  const requested = String(spec?.requestedTransform || "").toLowerCase();
  const identity = String(spec?.identity || "").toLowerCase();
  const state = spec?.state || null;

  if (requested === "ash") {
    return state?.burning ? "ash" : null;
  }
  if (requested === "mud") {
    return Number(state?.wetness || 0) >= 0.1 ? "mud" : null;
  }

  if (stimulusKind === "water" && isAshIdentity(identity)) {
    return Number(state?.wetness || 0) >= 0.1 ? "mud" : null;
  }

  return null;
}

/**
 * Apply a known transform in-place to an item-like entity.
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} itemId
 * @param {string} transformId
 */
export function applyMaterialTransform(world, itemId, transformId) {
  const id = itemId | 0;
  if (!(id > 0) || !world.isAlive(id)) return { applied: false, result: "none" };

  const transform = String(transformId || "").toLowerCase();
  if (!transform) return { applied: false, result: "none" };

  const info = world.get(id, ItemInfo);
  const mat = world.get(id, Material);
  const ni = world.get(id, NamedIdentity);
  const state = world.get(id, MaterialState);

  if (transform === "ash") {
    if (ni) {
      ni.name = "Ash";
      ni.identity = "ash";
    } else {
      world.add(id, NamedIdentity, { name: "Ash", identity: "ash" });
    }

    if (info) {
      info.type = "junk";
      info.slot = "bag";
      info.description = "A small pile of ash.";
      info.weight = 0.05;
      info.value = 0;
      info.count = Math.max(1, Number(info.count || 1) | 0);
      info.affixes = [];
      info.bonuses = {};
      info.damageDice = null;
      info.staminaCost = null;
      info.subtype = null;
      info.range = null;
      info.rarity = 1;
      info.rarityName = "common";
    }

    if (mat) mat.kind = "sand";
    else world.add(id, Material, { kind: "sand" });

    if (state) {
      state.primary = "sand";
      state.burning = false;
      state.heatC = Math.min(Number(state.heatC || 20), 200);
    }
    return { applied: true, result: "ash" };
  }

  if (transform === "mud") {
    const alreadyMud = String(ni?.identity || "").toLowerCase() === "mud";
    if (alreadyMud) return { applied: false, result: "mud" };

    if (ni) {
      ni.name = "Mud";
      ni.identity = "mud";
    } else {
      world.add(id, NamedIdentity, { name: "Mud", identity: "mud" });
    }

    if (info) {
      info.type = "junk";
      info.slot = "bag";
      info.description = "A clump of wet mud.";
      info.weight = Math.max(0.1, Number(info.weight || 0.2));
      info.value = 0;
      info.count = Math.max(1, Number(info.count || 1) | 0);
      info.affixes = [];
      info.bonuses = {};
    }

    if (mat) mat.kind = "clay";
    else world.add(id, Material, { kind: "clay" });

    if (state) {
      state.primary = "clay";
      state.burning = false;
      state.soot = Math.max(0, Number(state.soot || 0) - 0.25);
      state.wetness = Math.max(Number(state.wetness || 0), 0.5);
    }
    return { applied: true, result: "mud" };
  }

  return { applied: false, result: "none" };
}
