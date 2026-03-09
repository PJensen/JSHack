import { Collider } from "../components/Collider.js";
import { DoorState } from "../components/DoorState.js";
import { Position } from "../components/Position.js";
import { Vitality } from "../components/Vitality.js";
import { getTile, isWalkable } from "../environment/dungeon/tileMap.js";
import { TILE_STAIR_DOWN, TILE_STAIR_UP } from "../environment/dungeon/constants.js";

const DIRS = Object.freeze([
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
]);

function key(x, y) {
  return `${x},${y}`;
}

function heuristic(x, y, tx, ty) {
  return Math.abs(tx - x) + Math.abs(ty - y);
}

function buildBlockedSet(world, actorId, targetX, targetY) {
  const blocked = new Set();

  for (const [id, pos] of world.query(Position)) {
    if (id === actorId) continue;
    if (!pos) continue;
    if (world.has(id, DoorState)) continue;

    const col = world.get(id, Collider);
    const vit = world.get(id, Vitality);
    const solid = !!col?.solid;
    const living = Number(vit?.hp || 0) > 0;
    if (!solid && !living) continue;

    if (pos.x === targetX && pos.y === targetY) continue;
    blocked.add(key(pos.x, pos.y));
  }

  return blocked;
}

function reconstructFirstStep(cameFrom, startKey, goalKey, startX, startY) {
  let cur = goalKey;
  let prev = null;
  while (cur && cur !== startKey) {
    prev = cur;
    cur = cameFrom.get(cur) || null;
  }
  if (!prev) return null;

  const [xStr, yStr] = prev.split(",");
  const x = Number(xStr);
  const y = Number(yStr);
  return { dx: x - startX, dy: y - startY };
}

export function findNextCardinalStep(world, startX, startY, targetX, targetY, actorId, options = {}) {
  const maxNodes = Number.isFinite(options.maxNodes) ? options.maxNodes : 256;
  const goalRadius = Number.isFinite(options.goalRadius) ? options.goalRadius : 0;
  const minX = Math.min(startX, targetX) - 8;
  const maxX = Math.max(startX, targetX) + 8;
  const minY = Math.min(startY, targetY) - 8;
  const maxY = Math.max(startY, targetY) + 8;
  const blocked = buildBlockedSet(world, actorId, targetX, targetY);

  const startKey = key(startX, startY);
  const open = [startKey];
  const openSet = new Set(open);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristic(startX, startY, targetX, targetY)]]);

  let explored = 0;
  while (open.length > 0 && explored < maxNodes) {
    explored++;

    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < open.length; i++) {
      const score = fScore.get(open[i]) ?? Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const currentKey = open.splice(bestIndex, 1)[0];
    openSet.delete(currentKey);
    const [cxStr, cyStr] = currentKey.split(",");
    const cx = Number(cxStr);
    const cy = Number(cyStr);

    if (Math.abs(cx - targetX) + Math.abs(cy - targetY) <= goalRadius) {
      return reconstructFirstStep(cameFrom, startKey, currentKey, startX, startY);
    }

    for (const dir of DIRS) {
      const nx = cx + dir.dx;
      const ny = cy + dir.dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      if (!isWalkable(nx, ny)) continue;
      const tile = getTile(nx, ny);
      if (tile === TILE_STAIR_DOWN || tile === TILE_STAIR_UP) continue;

      const neighborKey = key(nx, ny);
      if (blocked.has(neighborKey)) continue;

      const tentativeG = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (tentativeG >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeG);
      fScore.set(neighborKey, tentativeG + heuristic(nx, ny, targetX, targetY));
      if (!openSet.has(neighborKey)) {
        open.push(neighborKey);
        openSet.add(neighborKey);
      }
    }
  }

  return null;
}
