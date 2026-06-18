import { materializeSpawn } from "../environment/dungeon/populate.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { attachEntityToCurrentFloor } from "./floorEntities.js";
import { getTileQuerySnapshot, invalidateTileQueryCache } from "./tileQueryCache.js";

const CARDINALS = Object.freeze([
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
]);

/**
 * @param {any} world
 * @param {number} x
 * @param {number} y
 */
function resolveCookingFirePlacement(world, x, y) {
  const ax = Number(x) | 0;
  const ay = Number(y) | 0;
  const tiles = getTileQuerySnapshot(world);
  for (let i = 0; i < CARDINALS.length; i++) {
    const nx = ax + CARDINALS[i].dx;
    const ny = ay + CARDINALS[i].dy;
    const key = `${nx},${ny}`;
    if (!isWalkable(nx, ny)) continue;
    if (tiles.blockedByCell.has(key) || tiles.interactableByCell.has(key)) continue;
    return { x: nx, y: ny };
  }
  return { x: ax, y: ay };
}

/**
 * Creates the canonical cooking fire fixture near an actor/anchor tile.
 * @param {any} world
 * @param {{ x: number, y: number }} anchor
 * @returns {number}
 */
export function spawnCookingFireNear(world, anchor) {
  const at = resolveCookingFirePlacement(world, Number(anchor?.x || 0), Number(anchor?.y || 0));
  const id = Number(materializeSpawn(world, { kind: "cooking_fire", x: at.x, y: at.y, params: {} }) || 0) | 0;
  if (!(id > 0)) return 0;
  attachEntityToCurrentFloor(world, id);
  invalidateTileQueryCache(world);
  return id;
}
