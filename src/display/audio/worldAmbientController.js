import { startLoop, stopLoop, setLoopVolume } from "./audioEngine.js";
import { resolve } from "./sounds.js";
import { hasLOS } from "../../shared/math/gridLOS.js";

const TOWN_AUDIBLE_RADIUS_TILES = 14;
const TAVERN_AUDIBLE_RADIUS_TILES = 10;
const CHURCH_AUDIBLE_RADIUS_TILES = 12;
const SMITHY_AUDIBLE_RADIUS_TILES = 11;
const AMBIENT_LOOP_BUS = "ambient:loop";
const NIGHT_TOWN_ALPHA_THRESHOLD = 0.5;
const TOWN_LOOP_GAIN = 0.16;
const TAVERN_LOOP_GAIN = 0.22;
const CHURCH_LOOP_GAIN = 0.14;
const SMITHY_LOOP_GAIN = 0.17;
const TAVERN_IDENTITIES = new Set([
  "tavern_sign",
  "tavern_keg",
  "tavern_table",
  "tavern_bench",
  "tavern_pillar",
  "tavern_chest",
]);
const TAVERN_INTERIOR_IDENTITIES = new Set([
  "tavern_keg",
  "tavern_table",
  "tavern_bench",
  "tavern_pillar",
  "tavern_chest",
  "cooking_fire",
]);
const CHURCH_INTERIOR_IDENTITIES = new Set([
  "church_altar",
  "church_pew",
  "church_font",
]);
const SMITHY_IDENTITIES = new Set([
  "smithy_sign",
  "anvil",
  "anvil_active",
  "furnace",
  "furnace_unlit",
]);
const SMITHY_INTERIOR_IDENTITIES = new Set([
  "anvil",
  "anvil_active",
  "furnace",
  "furnace_unlit",
]);

function sourceVisibleFromPlayer(source, playerPos, playerSheltered, isBlockedVision) {
  if (!source?.interior) return !playerSheltered;
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
  return peak * Math.pow(1 - t, 1.25);
}

export function computeTownLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, TOWN_AUDIBLE_RADIUS_TILES, TOWN_LOOP_GAIN);
}

export function computeTavernLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, TAVERN_AUDIBLE_RADIUS_TILES, TAVERN_LOOP_GAIN);
}

export function computeChurchLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, CHURCH_AUDIBLE_RADIUS_TILES, CHURCH_LOOP_GAIN);
}

export function computeSmithyLoopVolume(distanceTiles) {
  return radialGain(distanceTiles, SMITHY_AUDIBLE_RADIUS_TILES, SMITHY_LOOP_GAIN);
}

/**
 * @param {{
 *   startLoopFn?: typeof startLoop,
 *   stopLoopFn?: typeof stopLoop,
 *   setLoopVolumeFn?: typeof setLoopVolume,
 *   resolveFn?: typeof resolve,
 * }} deps
 */
export function createWorldAmbientController({
  startLoopFn = startLoop,
  stopLoopFn = stopLoop,
  setLoopVolumeFn = setLoopVolume,
  resolveFn = resolve,
} = {}) {
  const townSound = resolveFn("ambient:town");
  const townNightSound = resolveFn("ambient:town:night");
  const tavernSound = resolveFn("ambient:tavern");
  const churchSound = resolveFn("ambient:church");
  const smithySound = resolveFn("ambient:smithy");
  const townUrl = townSound?.url || null;
  const townNightUrl = townNightSound?.url || null;
  const tavernUrl = tavernSound?.url || null;
  const churchUrl = churchSound?.url || null;
  const smithyUrl = smithySound?.url || null;
  let townActive = false;
  let activeTownUrl = null;
  let tavernActive = false;
  let churchActive = false;
  let smithyActive = false;

  function stopTown() {
    if (!activeTownUrl || !townActive) return;
    stopLoopFn(activeTownUrl, { fadeOut: 0.5 });
    townActive = false;
    activeTownUrl = null;
  }

  function townLoopUrlFor(worldView) {
    const nightAlpha = Number(worldView?.nightAlpha || 0);
    if (nightAlpha >= NIGHT_TOWN_ALPHA_THRESHOLD && townNightUrl) return townNightUrl;
    return townUrl;
  }

  function stopTavern() {
    if (!tavernUrl || !tavernActive) return;
    stopLoopFn(tavernUrl, { fadeOut: 0.35 });
    tavernActive = false;
  }

  function stopChurch() {
    if (!churchUrl || !churchActive) return;
    stopLoopFn(churchUrl, { fadeOut: 0.3 });
    churchActive = false;
  }

  function stopSmithy() {
    if (!smithyUrl || !smithyActive) return;
    stopLoopFn(smithyUrl, { fadeOut: 0.35 });
    smithyActive = false;
  }

  /**
   * @param {{
   *   player?: { pos?: { x:number, y:number } } | null,
   *   entities?: Array<{ kind?: string, pos?: { x:number, y:number } }>
   *   isOverworld?: boolean,
   *   playerSheltered?: boolean,
   *   isBlockedVision?: ((x:number, y:number)=>boolean) | null,
   * }} worldView
   */
  function syncWorldView(worldView) {
    const playerPos = worldView?.player?.pos || null;
    const entities = Array.isArray(worldView?.entities) ? worldView.entities : [];
    const explicitSources = collectExplicitSources(worldView);
    const isOverworld = worldView?.isOverworld === true;
    const playerSheltered = worldView?.playerSheltered === true;
    const isBlockedVision = typeof worldView?.isBlockedVision === "function" ? worldView.isBlockedVision : null;
    if (!playerPos || !isOverworld || (explicitSources ? explicitSources.length === 0 : entities.length === 0)) {
      stopTown();
      stopTavern();
      stopChurch();
      stopSmithy();
      return;
    }

    let nearestTown = Infinity;
    let nearestTavern = Infinity;
    let nearestChurch = Infinity;
    let nearestSmithy = Infinity;
    if (explicitSources) {
      for (let i = 0; i < explicitSources.length; i++) {
        const source = explicitSources[i];
        if (!sourceVisibleFromPlayer(source, playerPos, playerSheltered, isBlockedVision)) continue;
        const dist = distance(source.pos, playerPos);
        if (source.profile === "town") nearestTown = Math.min(nearestTown, dist);
        else if (source.profile === "tavern") nearestTavern = Math.min(nearestTavern, dist);
        else if (source.profile === "church") nearestChurch = Math.min(nearestChurch, dist);
        else if (source.profile === "smithy") nearestSmithy = Math.min(nearestSmithy, dist);
      }
    } else for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity?.pos) continue;
      const kind = String(entity.kind || "");
      if (kind.startsWith("townfolk_")) {
        nearestTown = Math.min(nearestTown, distance(entity.pos, playerPos));
        continue;
      }
      if (TAVERN_IDENTITIES.has(kind)) {
        if (playerSheltered && TAVERN_INTERIOR_IDENTITIES.has(kind)) {
          const hasTavernLos = isBlockedVision
            ? hasLOS(playerPos.x | 0, playerPos.y | 0, entity.pos.x | 0, entity.pos.y | 0, isBlockedVision)
            : true;
          if (!hasTavernLos) continue;
        } else if (playerSheltered) {
          continue;
        }
        nearestTavern = Math.min(nearestTavern, distance(entity.pos, playerPos));
        continue;
      }
      if (playerSheltered && CHURCH_INTERIOR_IDENTITIES.has(kind)) {
        const hasChurchLos = isBlockedVision
          ? hasLOS(playerPos.x | 0, playerPos.y | 0, entity.pos.x | 0, entity.pos.y | 0, isBlockedVision)
          : true;
        if (!hasChurchLos) continue;
        nearestChurch = Math.min(nearestChurch, distance(entity.pos, playerPos));
        continue;
      }
      if (SMITHY_IDENTITIES.has(kind)) {
        if (playerSheltered && SMITHY_INTERIOR_IDENTITIES.has(kind)) {
          const hasSmithyLos = isBlockedVision
            ? hasLOS(playerPos.x | 0, playerPos.y | 0, entity.pos.x | 0, entity.pos.y | 0, isBlockedVision)
            : true;
          if (!hasSmithyLos) continue;
        } else if (playerSheltered) {
          continue;
        }
        nearestSmithy = Math.min(nearestSmithy, distance(entity.pos, playerPos));
      }
    }

    const tavernVolume = computeTavernLoopVolume(nearestTavern);
    const smithyVolume = computeSmithyLoopVolume(nearestSmithy);
    const townBase = playerSheltered ? 0 : computeTownLoopVolume(nearestTown);
    const townVolume = townBase * (tavernVolume > 0.02 || smithyVolume > 0.02 ? 0.28 : 1);
    const churchVolume = playerSheltered ? computeChurchLoopVolume(nearestChurch) : 0;
    const currentTownUrl = townLoopUrlFor(worldView);

    if (tavernVolume > 0.001 && tavernUrl) {
      if (!tavernActive) {
        startLoopFn(tavernUrl, { bus: AMBIENT_LOOP_BUS, volume: tavernVolume, fadeIn: 0.45 });
        tavernActive = true;
      } else {
        setLoopVolumeFn(tavernUrl, tavernVolume, { ramp: 0.14 });
      }
    } else {
      stopTavern();
    }

    if (townVolume > 0.001 && currentTownUrl) {
      if (!townActive || activeTownUrl !== currentTownUrl) {
        stopTown();
        startLoopFn(currentTownUrl, { bus: AMBIENT_LOOP_BUS, volume: townVolume, fadeIn: 0.7 });
        townActive = true;
        activeTownUrl = currentTownUrl;
      } else {
        setLoopVolumeFn(currentTownUrl, townVolume, { ramp: 0.2 });
      }
    } else {
      stopTown();
    }

    if (churchVolume > 0.001 && churchUrl) {
      if (!churchActive) {
        startLoopFn(churchUrl, { bus: AMBIENT_LOOP_BUS, volume: churchVolume, fadeIn: 0.35 });
        churchActive = true;
      } else {
        setLoopVolumeFn(churchUrl, churchVolume, { ramp: 0.12 });
      }
    } else {
      stopChurch();
    }

    if (smithyVolume > 0.001 && smithyUrl) {
      if (!smithyActive) {
        startLoopFn(smithyUrl, { bus: AMBIENT_LOOP_BUS, volume: smithyVolume, fadeIn: 0.4 });
        smithyActive = true;
      } else {
        setLoopVolumeFn(smithyUrl, smithyVolume, { ramp: 0.14 });
      }
    } else {
      stopSmithy();
    }
  }

  return { syncWorldView };
}
