import { startLoop, stopLoop, setLoopVolume } from "./audioEngine.js";
import { resolve } from "./sounds.js";
import {
  TILE_WATER_DEEP, TILE_WATER, TILE_SHALLOW_WATER,
  TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
  TILE_SWAMP, TILE_BOG, TILE_MARSH, TILE_MANGROVE, TILE_MUD, TILE_SALT_MARSH,
} from "../../rules/environment/dungeon/constants.js";

const OCEAN_SCAN_RADIUS = 6;
const SWAMP_SCAN_RADIUS = 8;
const OCEAN_TILES = new Set([
  TILE_WATER_DEEP, TILE_WATER, TILE_SHALLOW_WATER,
  TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
]);
const SWAMP_TILES = new Set([
  TILE_SWAMP, TILE_BOG, TILE_MARSH, TILE_MANGROVE, TILE_MUD, TILE_SALT_MARSH,
]);
const OCEAN_PEAK_GAIN = 0.45;
const SWAMP_PEAK_GAIN = 0.38;

/**
 * Compute volume from tile count in scan area.
 * @param {number} count
 * @param {number} maxCount
 * @param {number} peak
 * @returns {number}
 */
function computeBiomeVolume(count, maxCount, peak) {
  return Math.min(1, (count / maxCount)) * peak;
}

/**
 * @param {{
 *   startLoopFn?: typeof startLoop,
 *   stopLoopFn?: typeof stopLoop,
 *   setLoopVolumeFn?: typeof setLoopVolume,
 *   resolveFn?: typeof resolve,
 * }} deps
 */
export function createBiomeAmbientController({
  startLoopFn = startLoop,
  stopLoopFn = stopLoop,
  setLoopVolumeFn = setLoopVolume,
  resolveFn = resolve,
} = {}) {
  const oceanSound = resolveFn("ambient:ocean");
  const swampSound = resolveFn("ambient:swamp");
  const oceanUrl = oceanSound?.url || null;
  const swampUrl = swampSound?.url || null;
  let oceanActive = false;
  let swampActive = false;

  function stopOcean() {
    if (!oceanUrl || !oceanActive) return;
    stopLoopFn(oceanUrl, { fadeOut: 0.4 });
    oceanActive = false;
  }

  function stopSwamp() {
    if (!swampUrl || !swampActive) return;
    stopLoopFn(swampUrl, { fadeOut: 0.4 });
    swampActive = false;
  }

  /**
   * @param {{
   *   player?: { pos?: { x:number, y:number } } | null,
   *   isOverworld?: boolean,
   *   tileGrid?: { getTile?: (x:number, y:number)=>number, forEachTileInRect?: (x1:number,y1:number,x2:number,y2:number,cb:(t:number)=>void)=>void } | null,
   * }} worldView
   */
  function syncWorldView(worldView) {
    const playerPos = worldView?.player?.pos || null;
    const isOverworld = worldView?.isOverworld === true;
    const tileGrid = worldView?.tileGrid || null;

    if (!playerPos || !isOverworld || !tileGrid) {
      stopOcean();
      stopSwamp();
      return;
    }

    const getTile = tileGrid.getTile || ((x, y) => 0);
    const px = playerPos.x | 0;
    const py = playerPos.y | 0;

    let oceanCount = 0;
    let swampCount = 0;
    for (let x = px - OCEAN_SCAN_RADIUS; x <= px + OCEAN_SCAN_RADIUS; x++) {
      for (let y = py - OCEAN_SCAN_RADIUS; y <= py + OCEAN_SCAN_RADIUS; y++) {
        const tile = getTile(x, y);
        if (OCEAN_TILES.has(tile)) oceanCount++;
      }
    }
    for (let x = px - SWAMP_SCAN_RADIUS; x <= px + SWAMP_SCAN_RADIUS; x++) {
      for (let y = py - SWAMP_SCAN_RADIUS; y <= py + SWAMP_SCAN_RADIUS; y++) {
        const tile = getTile(x, y);
        if (SWAMP_TILES.has(tile)) swampCount++;
      }
    }

    const oceanVolume = computeBiomeVolume(oceanCount, 16, OCEAN_PEAK_GAIN);
    const swampVolume = computeBiomeVolume(swampCount, 24, SWAMP_PEAK_GAIN);

    if (oceanVolume > 0.001 && oceanUrl) {
      if (!oceanActive) {
        startLoopFn(oceanUrl, { bus: oceanSound?.bus || "ambient", volume: oceanVolume, fadeIn: 0.4 });
        oceanActive = true;
      } else {
        setLoopVolumeFn(oceanUrl, oceanVolume, { ramp: 0.15 });
      }
    } else {
      stopOcean();
    }

    if (swampVolume > 0.001 && swampUrl) {
      if (!swampActive) {
        startLoopFn(swampUrl, { bus: swampSound?.bus || "ambient", volume: swampVolume, fadeIn: 0.4 });
        swampActive = true;
      } else {
        setLoopVolumeFn(swampUrl, swampVolume, { ramp: 0.15 });
      }
    } else {
      stopSwamp();
    }
  }

  return { syncWorldView };
}
