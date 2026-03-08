import { getMonster } from "../../rules/data/monsters.js";
import { applyMutation } from "../../rules/interaction/mutations.js";
import { findNearestValidTileAround, playerEntity } from "../../rules/utils/queries.js";

/**
 * Spawn a debug monster on the nearest open tile around the player.
 *
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {string} monsterId
 * @returns {{ ok: true, monsterId: string, name: string, x: number, y: number } | { ok: false, error: string }}
 */
export function spawnDebugMonsterNearPlayer(world, monsterId) {
  const id = String(monsterId || "").trim();
  if (!id) return { ok: false, error: "Missing monster id." };

  const def = getMonster(id);
  if (!def) return { ok: false, error: `Unknown monster: "${id}"` };

  const pe = playerEntity(world);
  if (!pe) return { ok: false, error: "No player entity found." };

  const spawnAt = findNearestValidTileAround(world, pe.pos, {
    maxDistance: 2,
    exclude: [pe.pos],
  });
  if (!spawnAt) return { ok: false, error: "No open tile near player." };

  applyMutation(world, {
    type: "spawnMonster",
    monsterId: id,
    x: spawnAt.x,
    y: spawnAt.y,
    emitEvent: true,
  }, { getMonster });

  return {
    ok: true,
    monsterId: id,
    name: String(def.name || id),
    x: spawnAt.x,
    y: spawnAt.y,
  };
}
