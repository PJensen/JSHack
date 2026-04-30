// rules/data/tileReactions.js
// Declarative tile-interaction reaction table.
// When a player bumps into a non-walkable tile, the movement system looks up
// a matching reaction here instead of hard-coding per-tile logic.
//
// Each entry describes:
//   tile        — the TILE_* constant to react to
//   requires    — { bonus: string } the equipped weapon must have in ItemInfo.bonuses
//   costField   — field name on ItemInfo to read stamina cost (default fallback provided)
//   costDefault — fallback cost if costField is absent
//   result      — the TILE_* constant the tile becomes after the reaction
//   event       — event name emitted on success (payload: { actor, x, y })
//   backfill    — (optional) TILE_* to replace adjacent TILE_VOID with
//
// To add a new tile interaction, just add a row — no system code changes needed.

import {
  TILE_WALL,
  TILE_FLOOR,
  TILE_TREE,
  TILE_GRASS,
} from "../environment/dungeon/constants.js";

/**
 * @typedef {{
 *   tile: number,
 *   requires: { bonus: string },
 *   costField: string,
 *   costDefault: number,
 *   result: number,
 *   event: string,
 *   backfill?: number,
 * }} TileReaction
 */

/** @type {TileReaction[]} */
export const TILE_REACTIONS = [
  {
    tile: TILE_WALL,
    requires: { bonus: "dig" },
    costField: "staminaCost",
    costDefault: 5,
    result: TILE_FLOOR,
    event: "tile:dug",
    backfill: TILE_WALL,
  },
  {
    tile: TILE_TREE,
    requires: { bonus: "chop" },
    costField: "staminaCost",
    costDefault: 10,
    result: TILE_GRASS,
    event: "tile:chopped",
  },
];

// Build a fast lookup by tile id.
const _byTile = new Map();
for (const r of TILE_REACTIONS) {
  let arr = _byTile.get(r.tile);
  if (!arr) { arr = []; _byTile.set(r.tile, arr); }
  arr.push(r);
}

/**
 * Find the first matching tile reaction for a given tile type and weapon bonuses.
 * @param {number} tileType
 * @param {Record<string, any>} bonuses — from ItemInfo.bonuses on the equipped weapon
 * @returns {TileReaction | null}
 */
export function findTileReaction(tileType, bonuses) {
  const candidates = _byTile.get(tileType);
  if (!candidates) return null;
  if (!bonuses || typeof bonuses !== "object") return null;
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    if (bonuses[r.requires.bonus]) return r;
  }
  return null;
}

/**
 * Get all reactions for a tile type (for validation / testing).
 * @param {number} tileType
 * @returns {TileReaction[]}
 */
export function getReactionsForTile(tileType) {
  return _byTile.get(tileType) || [];
}
