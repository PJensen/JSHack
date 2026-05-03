import { DungeonState } from "../components/DungeonState.js";
import { getTile } from "../environment/dungeon/tileMap.js";
import { TILE_WATER, TILE_SHALLOW_WATER, TILE_WATER_DEEP } from "../environment/dungeon/constants.js";

const WET_TILE_TYPES = new Set([TILE_WATER, TILE_SHALLOW_WATER, TILE_WATER_DEEP]);

function getWetMap(world) {
  for (const [, ds] of world.query(DungeonState)) {
    if (!ds.wetTiles) ds.wetTiles = {};
    return ds.wetTiles;
  }
  return null;
}

export function markWet(world, x, y, turns) {
  const map = getWetMap(world);
  if (!map) return;
  const key = `${x | 0},${y | 0}`;
  map[key] = { expiresAtStep: (world.step | 0) + Math.max(1, turns | 0) };
}

export function isWetAt(world, x, y) {
  if (WET_TILE_TYPES.has(getTile(x | 0, y | 0))) return true;
  const map = getWetMap(world);
  if (!map) return false;
  const key = `${x | 0},${y | 0}`;
  const rec = map[key];
  if (!rec) return false;
  if ((world.step | 0) > rec.expiresAtStep) {
    delete map[key];
    return false;
  }
  return true;
}
