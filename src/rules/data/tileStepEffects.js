// rules/data/tileStepEffects.js
// Declarative table mapping tile type → step-on effect.
// Consumed by the tileStepEffectSystem listener on the "moved" event.

import { TILE_ICE, TILE_SHALLOW_WATER, TILE_LAVA } from "../environment/dungeon/constants.js";

/**
 * @typedef {{
 *   tile: number,
 *   type: "extinguish" | "scorch" | "slide",
 *   event: string,
 *   damage?: number,
 *   damageType?: string,
 *   status?: { key: string, turnsLeft: number, potency: number, stacks: number },
 * }} TileStepEffect
 */

/** @type {TileStepEffect[]} */
export const TILE_STEP_EFFECTS = [
  { tile: TILE_SHALLOW_WATER, type: "extinguish", event: "tile:waded" },
  {
    tile: TILE_LAVA, type: "scorch", event: "tile:scorched",
    damage: 3, damageType: "fire",
    status: { key: "burn", turnsLeft: 3, potency: 2, stacks: 1 },
  },
  { tile: TILE_ICE, type: "slide", event: "tile:slid" },
];

/** @type {Map<number, TileStepEffect>} */
const _byTile = new Map();
for (const e of TILE_STEP_EFFECTS) _byTile.set(e.tile, e);

/**
 * Look up the step-on effect for a tile type. O(1).
 * @param {number} tileType
 * @returns {TileStepEffect | null}
 */
export function findTileStepEffect(tileType) {
  return _byTile.get(tileType) ?? null;
}
