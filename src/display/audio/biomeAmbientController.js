import { startLoop, stopLoop, setLoopVolume } from "./audioEngine.js";
import { resolve } from "./sounds.js";
import {
  TILE_WATER_DEEP, TILE_WATER, TILE_SHALLOW_WATER,
  TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
  TILE_SWAMP, TILE_BOG, TILE_MARSH, TILE_MANGROVE, TILE_MUD, TILE_SALT_MARSH,
  TILE_GRASS, TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
  TILE_PINE_FOREST, TILE_PALM_FOREST,
} from "../../shared/terrainTiles.js";

const OCEAN_SCAN_RADIUS = 6;
const SWAMP_SCAN_RADIUS = 8;
const FOREST_SCAN_RADIUS = 8;
const MEADOW_SCAN_RADIUS = 8;
const OCEAN_TILES = new Set([
  TILE_WATER_DEEP, TILE_WATER, TILE_SHALLOW_WATER,
  TILE_KELP_FOREST, TILE_SEAGRASS, TILE_CORAL_REEF,
]);
const SWAMP_TILES = new Set([
  TILE_SWAMP, TILE_BOG, TILE_MARSH, TILE_MANGROVE, TILE_MUD, TILE_SALT_MARSH,
]);
const FOREST_TILES = new Set([
  TILE_PINE_FOREST, TILE_PALM_FOREST,
]);
const MEADOW_TILES = new Set([
  TILE_GRASS, TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
]);
const AMBIENT_LOOP_BUS = "ambient:loop";
const OCEAN_PEAK_GAIN = 0.2;
const SWAMP_PEAK_GAIN = 0.16;
const FOREST_PEAK_GAIN = 0.17;
const MEADOW_PEAK_GAIN = 0.14;

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
  const forestSound = resolveFn("ambient:forest");
  const meadowSound = resolveFn("ambient:meadow");
  const oceanUrl = oceanSound?.url || null;
  const swampUrl = swampSound?.url || null;
  const forestUrl = forestSound?.url || null;
  const meadowUrl = meadowSound?.url || null;
  let oceanActive = false;
  let swampActive = false;
  let forestActive = false;
  let meadowActive = false;

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

  function stopForest() {
    if (!forestUrl || !forestActive) return;
    stopLoopFn(forestUrl, { fadeOut: 0.4 });
    forestActive = false;
  }

  function stopMeadow() {
    if (!meadowUrl || !meadowActive) return;
    stopLoopFn(meadowUrl, { fadeOut: 0.4 });
    meadowActive = false;
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
      stopForest();
      stopMeadow();
      return;
    }

    const getTile = tileGrid.getTile || ((x, y) => 0);
    const px = playerPos.x | 0;
    const py = playerPos.y | 0;

    let oceanCount = 0;
    let swampCount = 0;
    let forestCount = 0;
    let meadowCount = 0;
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
    for (let x = px - FOREST_SCAN_RADIUS; x <= px + FOREST_SCAN_RADIUS; x++) {
      for (let y = py - FOREST_SCAN_RADIUS; y <= py + FOREST_SCAN_RADIUS; y++) {
        const tile = getTile(x, y);
        if (FOREST_TILES.has(tile)) forestCount++;
      }
    }
    for (let x = px - MEADOW_SCAN_RADIUS; x <= px + MEADOW_SCAN_RADIUS; x++) {
      for (let y = py - MEADOW_SCAN_RADIUS; y <= py + MEADOW_SCAN_RADIUS; y++) {
        const tile = getTile(x, y);
        if (MEADOW_TILES.has(tile)) meadowCount++;
      }
    }

    const oceanVolume = computeBiomeVolume(oceanCount, 16, OCEAN_PEAK_GAIN);
    const swampVolume = computeBiomeVolume(swampCount, 24, SWAMP_PEAK_GAIN);
    const forestVolume = computeBiomeVolume(forestCount, 24, FOREST_PEAK_GAIN);
    const meadowVolume = computeBiomeVolume(meadowCount, 32, MEADOW_PEAK_GAIN);

    if (oceanVolume > 0.001 && oceanUrl) {
      if (!oceanActive) {
        startLoopFn(oceanUrl, { bus: AMBIENT_LOOP_BUS, volume: oceanVolume, fadeIn: 0.4 });
        oceanActive = true;
      } else {
        setLoopVolumeFn(oceanUrl, oceanVolume, { ramp: 0.15 });
      }
    } else {
      stopOcean();
    }

    if (swampVolume > 0.001 && swampUrl) {
      if (!swampActive) {
        startLoopFn(swampUrl, { bus: AMBIENT_LOOP_BUS, volume: swampVolume, fadeIn: 0.4 });
        swampActive = true;
      } else {
        setLoopVolumeFn(swampUrl, swampVolume, { ramp: 0.15 });
      }
    } else {
      stopSwamp();
    }

    if (forestVolume > 0.001 && forestUrl) {
      if (!forestActive) {
        startLoopFn(forestUrl, { bus: AMBIENT_LOOP_BUS, volume: forestVolume, fadeIn: 0.4 });
        forestActive = true;
      } else {
        setLoopVolumeFn(forestUrl, forestVolume, { ramp: 0.15 });
      }
    } else {
      stopForest();
    }

    if (meadowVolume > 0.001 && meadowUrl) {
      if (!meadowActive) {
        startLoopFn(meadowUrl, { bus: AMBIENT_LOOP_BUS, volume: meadowVolume, fadeIn: 0.4 });
        meadowActive = true;
      } else {
        setLoopVolumeFn(meadowUrl, meadowVolume, { ramp: 0.15 });
      }
    } else {
      stopMeadow();
    }
  }

  return { syncWorldView };
}
