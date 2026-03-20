import { HEARING_HL_THRESHOLD, HEARING_TIERS } from "../components/Anatomy.js";
import { chebyshev } from "./distance.js";

export const HEARING_TIER_THRESHOLDS = Object.freeze({
  [HEARING_TIERS.super]: HEARING_HL_THRESHOLD.super,
  [HEARING_TIERS.far]: HEARING_HL_THRESHOLD.far,
  [HEARING_TIERS.mid]: HEARING_HL_THRESHOLD.mid,
  [HEARING_TIERS.near]: HEARING_HL_THRESHOLD.near,
  [HEARING_TIERS.deaf]: HEARING_HL_THRESHOLD.deaf,
});

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function toInt(n) {
  return Number(n) | 0;
}

function countWallsOnLine(x0, y0, x1, y1, getTile, isWall) {
  let walls = 0;
  let x = toInt(x0);
  let y = toInt(y0);
  const xEnd = toInt(x1);
  const yEnd = toInt(y1);
  const dx = Math.abs(xEnd - x);
  const sx = x < xEnd ? 1 : -1;
  const dy = -Math.abs(yEnd - y);
  const sy = y < yEnd ? 1 : -1;
  let err = dx + dy;
  let first = true;

  while (true) {
    if (!first) {
      const tile = getTile(x, y);
      if (isWall(tile)) walls++;
    }
    first = false;
    if (x === xEnd && y === yEnd) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }

  return walls;
}

/**
 * @param {"super"|"far"|"mid"|"near"|"deaf"|string} tier
 */
export function thresholdForTier(tier) {
  const key = String(tier || HEARING_TIERS.super).toLowerCase();
  const value = HEARING_TIER_THRESHOLDS[key];
  if (!Number.isFinite(value)) throw new Error(`Unknown hearing tier: ${tier}`);
  return value;
}

/**
 * Evaluate whether a listener can hear a sound source.
 *
 * @param {{
 *   origin: {x:number,y:number},
 *   source: {x:number,y:number},
 *   sourceDbAt1Tile: number,
 *   hearingThresholdDbHL: number,
 *   wallDbPenalty?: number,
 *   getTile?: (x:number,y:number) => any,
 *   isWall?: (tile:any) => boolean,
 * }} payload
 */
export function evaluateSound(payload) {
  const origin = payload?.origin;
  const source = payload?.source;
  const sourceDbAt1Tile = Number(payload?.sourceDbAt1Tile);
  const hearingThresholdDbHL = Number(payload?.hearingThresholdDbHL);
  const wallDbPenalty = Number(payload?.wallDbPenalty || 0);
  const getTile = payload?.getTile;
  const isWall = payload?.isWall;

  if (!origin || !source) throw new Error("evaluateSound: missing origin/source");
  if (!Number.isFinite(sourceDbAt1Tile)) throw new Error("evaluateSound: sourceDbAt1Tile must be finite");
  if (!Number.isFinite(hearingThresholdDbHL)) throw new Error("evaluateSound: hearingThresholdDbHL must be finite");

  const distance = Math.max(1, chebyshev(origin, source));
  const distanceDb = 6 * log2(distance);

  const occlusionDb = (
    typeof getTile === "function"
    && typeof isWall === "function"
    && Number.isFinite(wallDbPenalty)
    && wallDbPenalty > 0
  )
    ? wallDbPenalty * countWallsOnLine(origin.x, origin.y, source.x, source.y, getTile, isWall)
    : 0;

  const perceivedDb = sourceDbAt1Tile - distanceDb - occlusionDb;
  const marginDb = perceivedDb - hearingThresholdDbHL;
  const audible = marginDb >= 0;

  const clarity = marginDb >= 40
    ? "crystal"
    : marginDb >= 20
      ? "clear"
      : marginDb >= 5
        ? "faint"
        : marginDb >= 0
          ? "barely"
          : "inaudible";

  return {
    audible,
    marginDb,
    perceivedDb,
    distance,
    occlusionDb,
    clarity,
  };
}

/**
 * Compute max audible distance in tiles (ignoring occlusion).
 *
 * @param {number} sourceDbAt1Tile
 * @param {number} hearingThresholdDbHL
 */
export function maxAudibleDistanceTiles(sourceDbAt1Tile, hearingThresholdDbHL) {
  const db = Number(sourceDbAt1Tile);
  const threshold = Number(hearingThresholdDbHL);
  if (!Number.isFinite(db) || !Number.isFinite(threshold)) return 1;
  const exp = (db - threshold) / 6;
  if (exp <= 0) return 1;
  return Math.max(1, Math.floor(Math.pow(2, exp)));
}
