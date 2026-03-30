// rules/utils/spawnCentipede.js
// Spawns a multi-segment centipede chain.  The head gets full Monster AI;
// body segments are stripped of Brain/AggroState so they follow passively.

import { spawnMonsterEntity } from "./spawnMonsterEntity.js";
import { CentipedeSegment } from "../components/CentipedeSegment.js";
import { AggroState } from "../components/AggroState.js";
import { Brain } from "../components/Brain.js";
import { SoundEmitter } from "../components/SoundEmitter.js";
import { Wounds } from "../components/Wounds.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";
import { CARDINAL_DIRS } from "./directions.js";

/**
 * Spawn a full centipede chain starting at (headX, headY).
 * Tries cardinal directions to find a walkable line for the body.
 *
 * @param {any}    world
 * @param {Object} params  - toMonsterSpawnParams output
 * @param {number} headX
 * @param {number} headY
 * @param {number} length  - total segments including head (min 2)
 * @param {{ next: () => number, int?: (lo:number,hi:number)=>number }} rng
 * @returns {number[]} entity IDs [head, seg1, seg2, ...]
 */
export function spawnCentipede(world, params, headX, headY, length, rng) {
  const chainId = ((world.step * 0x9e3779b9) ^ (headX * 0x45d9f3b) ^ (headY * 0x119de1f3)) >>> 0;

  // Shuffle directions deterministically
  const dirOrder = [...CARDINAL_DIRS];
  for (let i = dirOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [dirOrder[i], dirOrder[j]] = [dirOrder[j], dirOrder[i]];
  }

  // Find best direction with most consecutive walkable tiles
  let bestDir = dirOrder[0];
  let bestCount = 0;
  for (const dir of dirOrder) {
    let count = 0;
    for (let s = 1; s < length; s++) {
      const tx = headX + dir.dx * s;
      const ty = headY + dir.dy * s;
      if (!isWalkable(tx, ty)) break;
      count++;
    }
    if (count >= length - 1) { bestDir = dir; bestCount = count; break; }
    if (count > bestCount) { bestDir = dir; bestCount = count; }
  }

  const actualLength = Math.min(length, bestCount + 1);
  if (actualLength < 2) {
    // Can't fit a chain — spawn as a single normal monster
    const id = spawnMonsterEntity(world, { ...params, x: headX, y: headY });
    world.add(id, CentipedeSegment, {
      headId: 0, index: 0, nextId: 0, prevId: 0, chainId,
    });
    return [id];
  }

  const ids = [];

  // Spawn head (full monster with AI)
  const headId = spawnMonsterEntity(world, { ...params, x: headX, y: headY });
  ids.push(headId);

  // Spawn body segments (stripped of AI)
  for (let i = 1; i < actualLength; i++) {
    const sx = headX + bestDir.dx * i;
    const sy = headY + bestDir.dy * i;

    const segId = spawnMonsterEntity(world, {
      ...params,
      x: sx,
      y: sy,
    });

    // Strip AI components — body segments are passive followers
    try { world.remove(segId, Brain); } catch { /* absent */ }
    try { world.remove(segId, AggroState); } catch { /* absent */ }
    try { world.remove(segId, SoundEmitter); } catch { /* absent */ }
    try { world.remove(segId, Wounds); } catch { /* absent */ }

    ids.push(segId);
  }

  // Link all segments into a doubly-linked chain
  for (let i = 0; i < ids.length; i++) {
    world.add(ids[i], CentipedeSegment, {
      headId: i === 0 ? 0 : ids[0],
      index: i,
      nextId: i < ids.length - 1 ? ids[i + 1] : 0,
      prevId: i > 0 ? ids[i - 1] : 0,
      chainId,
    });
  }

  return ids;
}
