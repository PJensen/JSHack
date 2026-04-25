import { startLoop, stopLoop, setLoopVolume } from "./audioEngine.js";
import { resolve } from "./sounds.js";
import { hasLOS } from "../../shared/math/gridLOS.js";

const COOKING_FIRE_AUDIBLE_RADIUS_TILES = 8;
const HOLY_SITE_AUDIBLE_RADIUS_TILES = 7;
const TORCH_AUDIBLE_RADIUS_TILES = 6;
const AMBIENT_LOOP_BUS = "ambient:loop";
const COOKING_FIRE_LOOP_GAIN = 0.14;
const HOLY_SITE_LOOP_GAIN = 0.1;
const TORCH_LOOP_GAIN = 0.12;
const HOLY_SITE_IDENTITIES = new Set([
  "altar",
  "shrine",
  "church_altar",
]);
const HOLY_SITE_INTERIOR_IDENTITIES = new Set([
  "church_altar",
]);

function sourceAudible(source, playerPos, playerSheltered, isBlockedVision) {
  if (!source?.interior) return true;
  if (!playerSheltered) return false;
  return isBlockedVision
    ? hasLOS(playerPos.x | 0, playerPos.y | 0, source.pos.x | 0, source.pos.y | 0, isBlockedVision)
    : true;
}

function collectExplicitSources(worldView) {
  if (!Array.isArray(worldView?.audioEmitters)) return null;
  return worldView.audioEmitters.filter((source) => source?.pos && source.profile);
}

/**
 * @param {{ x:number, y:number }} a
 * @param {{ x:number, y:number }} b
 */
function distance(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * @param {number} dist
 * @param {number} radius
 * @param {number} peak
 */
function radialGain(dist, radius, peak) {
  if (!Number.isFinite(dist)) return 0;
  if (dist <= 1) return peak;
  if (dist >= radius) return 0;
  const t = (dist - 1) / (radius - 1);
  return peak * Math.pow(1 - t, 1.3);
}

export function computeCookingFireLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, COOKING_FIRE_AUDIBLE_RADIUS_TILES, COOKING_FIRE_LOOP_GAIN);
}

export function computeHolySiteLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, HOLY_SITE_AUDIBLE_RADIUS_TILES, HOLY_SITE_LOOP_GAIN);
}

export function computeTorchLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, TORCH_AUDIBLE_RADIUS_TILES, TORCH_LOOP_GAIN);
}

/**
 * @param {{
 *   startLoopFn?: typeof startLoop,
 *   stopLoopFn?: typeof stopLoop,
 *   setLoopVolumeFn?: typeof setLoopVolume,
 *   resolveFn?: typeof resolve,
 * }} deps
 */
export function createLocalEmitterAmbientController({
  startLoopFn = startLoop,
  stopLoopFn = stopLoop,
  setLoopVolumeFn = setLoopVolume,
  resolveFn = resolve,
} = {}) {
  const cookingSound = resolveFn("ambient:cooking_fire");
  const holySiteSound = resolveFn("ambient:holy_site");
  const torchSound = resolveFn("ambient:torch_flames");
  const cookingUrl = cookingSound?.url || null;
  const holySiteUrl = holySiteSound?.url || null;
  const torchUrl = torchSound?.url || null;
  let cookingActive = false;
  let holySiteActive = false;
  let torchActive = false;

  function stopCooking() {
    if (!cookingUrl || !cookingActive) return;
    stopLoopFn(cookingUrl, { fadeOut: 0.35 });
    cookingActive = false;
  }

  function stopTorch() {
    if (!torchUrl || !torchActive) return;
    stopLoopFn(torchUrl, { fadeOut: 0.25 });
    torchActive = false;
  }

  function stopHolySite() {
    if (!holySiteUrl || !holySiteActive) return;
    stopLoopFn(holySiteUrl, { fadeOut: 0.3 });
    holySiteActive = false;
  }

  /**
   * @param {{
   *   player?: { pos?: { x:number, y:number } } | null,
   *   entities?: Array<{ kind?: string, pos?: { x:number, y:number } }>,
   *   playerSheltered?: boolean,
   *   isBlockedVision?: ((x:number, y:number)=>boolean) | null,
   * }} worldView
   */
  function syncWorldView(worldView) {
    const playerPos = worldView?.player?.pos || null;
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    const explicitSources = collectExplicitSources(worldView);
    const playerSheltered = worldView?.playerSheltered === true;
    const isBlockedVision = typeof worldView?.isBlockedVision === "function" ? worldView.isBlockedVision : null;
    if (!playerPos || (explicitSources ? explicitSources.length === 0 : entities.length === 0)) {
      stopCooking();
      stopHolySite();
      stopTorch();
      return;
    }

    let nearestCooking = Infinity;
    let nearestHolySite = Infinity;
    let nearestTorch = Infinity;
    if (explicitSources) {
      for (let i = 0; i < explicitSources.length; i++) {
        const source = explicitSources[i];
        if (!sourceAudible(source, playerPos, playerSheltered, isBlockedVision)) continue;
        const dist = distance(source.pos, playerPos);
        if (source.profile === "cooking_fire") nearestCooking = Math.min(nearestCooking, dist);
        else if (source.profile === "holy_site") nearestHolySite = Math.min(nearestHolySite, dist);
        else if (source.profile === "torch") nearestTorch = Math.min(nearestTorch, dist);
      }
    } else for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity?.pos) continue;
      const kind = String(entity.kind || "");
      if (kind === "cooking_fire" || kind === "furnace") {
        nearestCooking = Math.min(nearestCooking, distance(entity.pos, playerPos));
        continue;
      }
      if (HOLY_SITE_IDENTITIES.has(kind)) {
        if (HOLY_SITE_INTERIOR_IDENTITIES.has(kind)) {
          if (!playerSheltered) continue;
          const hasHolySiteLos = isBlockedVision
            ? hasLOS(playerPos.x | 0, playerPos.y | 0, entity.pos.x | 0, entity.pos.y | 0, isBlockedVision)
            : true;
          if (!hasHolySiteLos) continue;
        }
        nearestHolySite = Math.min(nearestHolySite, distance(entity.pos, playerPos));
        continue;
      }
      if (kind === "torch") {
        nearestTorch = Math.min(nearestTorch, distance(entity.pos, playerPos));
      }
    }

    const cookingVolume = computeCookingFireLoopVolume(nearestCooking);
    const holySiteVolume = computeHolySiteLoopVolume(nearestHolySite);
    const torchVolume = computeTorchLoopVolume(nearestTorch);

    if (cookingVolume > 0.001 && cookingUrl) {
      if (!cookingActive) {
        startLoopFn(cookingUrl, { bus: AMBIENT_LOOP_BUS, volume: cookingVolume, fadeIn: 0.25 });
        cookingActive = true;
      } else {
        setLoopVolumeFn(cookingUrl, cookingVolume, { ramp: 0.12 });
      }
    } else {
      stopCooking();
    }

    if (holySiteVolume > 0.001 && holySiteUrl) {
      if (!holySiteActive) {
        startLoopFn(holySiteUrl, { bus: AMBIENT_LOOP_BUS, volume: holySiteVolume, fadeIn: 0.28 });
        holySiteActive = true;
      } else {
        setLoopVolumeFn(holySiteUrl, holySiteVolume, { ramp: 0.1 });
      }
    } else {
      stopHolySite();
    }

    if (torchVolume > 0.001 && torchUrl) {
      if (!torchActive) {
        startLoopFn(torchUrl, { bus: AMBIENT_LOOP_BUS, volume: torchVolume, fadeIn: 0.2 });
        torchActive = true;
      } else {
        setLoopVolumeFn(torchUrl, torchVolume, { ramp: 0.08 });
      }
    } else {
      stopTorch();
    }
  }

  return { syncWorldView };
}
