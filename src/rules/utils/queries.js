import { Position } from "../components/Position.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { Player } from "../components/Player.js";
import { Collider } from "../components/Collider.js";
import { Vitality } from "../components/Vitality.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";

export function itemsAt(world, x, y) {
  const ids = [];
  // Mirror rendering access pattern: scan all Position holders, then filter by ItemInfo
  for (const [id, pos] of world.query(Position)) {
    if (!pos || pos.x !== x || pos.y !== y) continue;
    if (world.has(id, ItemInfo)) ids.push(id);
  }
  return ids;
}

export function playerEntity(world) {
  // Query order must match destructuring: ensure Position is the second tuple value
  for (const [id, _pl, pos] of world.query(Player, Position)) {
    if (pos && Number.isInteger(pos.x) && Number.isInteger(pos.y)) {
      return { id, pos: { x: pos.x, y: pos.y } };
    }
  }
  return null;
}

/**
 * Find the nearest valid tile around a source point.
 * Valid means walkable terrain and no solid/living occupant.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{x:number, y:number}} source
 * @param {{
 *   maxDistance?: number,
 *   exclude?: Array<{x:number, y:number}>
 * }} [opts]
 */
export function findNearestValidTileAround(world, source, opts = {}) {
  const maxDistance = Math.max(0, opts.maxDistance ?? 1);
  const excluded = new Set((opts.exclude || []).map((p) => `${p.x},${p.y}`));
  const blocked = new Set();

  for (const [id, pos] of world.query(Position)) {
    const col = world.get(id, Collider);
    if (col?.solid) blocked.add(`${pos.x},${pos.y}`);

    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) blocked.add(`${pos.x},${pos.y}`);
  }

  const candidates = [];
  for (let dy = -maxDistance; dy <= maxDistance; dy++) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      const x = source.x + dx;
      const y = source.y + dy;
      const dist = Math.abs(dx) + Math.abs(dy);
      candidates.push({ x, y, dist, axisBias: (dx === 0 || dy === 0) ? 0 : 1 });
    }
  }

  candidates.sort((a, b) => a.dist - b.dist || a.axisBias - b.axisBias);

  for (const p of candidates) {
    const key = `${p.x},${p.y}`;
    if (excluded.has(key)) continue;
    if (!isWalkable(p.x, p.y)) continue;
    if (blocked.has(key)) continue;
    return { x: p.x, y: p.y };
  }

  return null;
}
