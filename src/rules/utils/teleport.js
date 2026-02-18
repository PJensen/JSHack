import { Position } from "../components/Position.js";
import { Collider } from "../components/Collider.js";
import { Vitality } from "../components/Vitality.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";

function buildBlockedTileSet(world) {
  const blocked = new Set();
  for (const [id, pos] of world.query(Position)) {
    const col = world.get(id, Collider);
    if (col?.solid) blocked.add(`${pos.x},${pos.y}`);

    const vit = world.get(id, Vitality);
    if (vit && (vit.hp ?? 0) > 0) blocked.add(`${pos.x},${pos.y}`);
  }
  return blocked;
}

/**
 * Resolve a safe teleport destination near a desired tile.
 * Uses Chebyshev distance rings first, then cardinal preference.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{x:number,y:number}} desired
 * @param {{ maxDistance?: number, exclude?: Array<{x:number,y:number}> }} [opts]
 */
export function resolveTeleportDestination(world, desired, opts = {}) {
  const maxDistance = Math.max(0, Number(opts.maxDistance ?? 3) | 0);
  const excluded = new Set((opts.exclude || []).map((p) => `${p.x},${p.y}`));
  const blocked = buildBlockedTileSet(world);

  /** @type {Array<{x:number,y:number,cheb:number,man:number,axisBias:number}>} */
  const candidates = [];
  for (let dy = -maxDistance; dy <= maxDistance; dy++) {
    for (let dx = -maxDistance; dx <= maxDistance; dx++) {
      const x = (desired.x | 0) + dx;
      const y = (desired.y | 0) + dy;
      candidates.push({
        x,
        y,
        cheb: Math.max(Math.abs(dx), Math.abs(dy)),
        man: Math.abs(dx) + Math.abs(dy),
        axisBias: (dx === 0 || dy === 0) ? 0 : 1,
      });
    }
  }

  candidates.sort((a, b) => a.cheb - b.cheb || a.man - b.man || a.axisBias - b.axisBias);

  for (const p of candidates) {
    const key = `${p.x},${p.y}`;
    if (excluded.has(key)) continue;
    if (!isWalkable(p.x, p.y)) continue;
    if (blocked.has(key)) continue;
    return { x: p.x, y: p.y };
  }

  return null;
}

/**
 * Find canonical home anchor from overworld entities.
 * Prioritizes midpoint between bed and nearest chest.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function findHomeAnchor(world) {
  let bed = null;
  /** @type {Array<{x:number,y:number}>} */
  const chests = [];

  for (const [, pos, ni] of world.query(Position, NamedIdentity)) {
    if (ni.identity === "bed_home") bed = { x: pos.x, y: pos.y };
    if (ni.identity === "chest") chests.push({ x: pos.x, y: pos.y });
  }

  if (!bed) return null;
  if (chests.length <= 0) return { depth: 0, x: bed.x, y: bed.y };

  let best = chests[0];
  let bestD = Infinity;
  for (const ch of chests) {
    const d = Math.abs(ch.x - bed.x) + Math.abs(ch.y - bed.y);
    if (d < bestD) {
      bestD = d;
      best = ch;
    }
  }

  return {
    depth: 0,
    x: Math.round((bed.x + best.x) / 2),
    y: Math.round((bed.y + best.y) / 2),
  };
}
