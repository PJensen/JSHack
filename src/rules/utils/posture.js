import { CombatPosture, COMBAT_POSTURES } from "../components/CombatPosture.js";
import { emitSafe } from "./emitSafe.js";

function normalizePosture(stance) {
  const value = String(stance || COMBAT_POSTURES.balanced).toLowerCase();
  if (value === COMBAT_POSTURES.aggressive) return COMBAT_POSTURES.aggressive;
  if (value === COMBAT_POSTURES.guarded) return COMBAT_POSTURES.guarded;
  return COMBAT_POSTURES.balanced;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 */
export function getPostureState(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0) || !world?.isAlive?.(id)) return null;
  const rec = world.get(id, CombatPosture);
  if (!rec) return null;
  return {
    stance: normalizePosture(rec.stance),
    lastChangedStep: Number(rec.lastChangedStep || 0) | 0,
    lastMoveStep: Number(rec.lastMoveStep ?? -1) | 0,
  };
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 * @param {'balanced'|'aggressive'|'guarded'|string} stance
 * @param {{reason?:string, emit?:boolean}} [options]
 */
export function setCombatPosture(world, entityId, stance, options = {}) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0) || !world?.isAlive?.(id)) return null;
  const next = normalizePosture(stance);
  const emit = options.emit !== false;
  const reason = String(options.reason || "").trim();

  const cur = world.get(id, CombatPosture);
  if (!cur) {
    try {
      world.add(id, CombatPosture, {
        stance: next,
        lastChangedStep: Number(world.step || 0) | 0,
        lastMoveStep: -1,
      });
    } catch {}
    if (emit) {
      emitSafe(world, "combat:posture", { id, stance: next, reason });
    }
    return world.get(id, CombatPosture) || null;
  }

  const prev = normalizePosture(cur.stance);
  cur.stance = next;
  if (prev !== next) cur.lastChangedStep = Number(world.step || 0) | 0;
  if (emit && prev !== next) {
    emitSafe(world, "combat:posture", { id, stance: next, previous: prev, reason });
  }
  return cur;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} entityId
 */
export function markMovedThisTurn(world, entityId) {
  const id = Number(entityId || 0) | 0;
  if (!(id > 0) || !world?.isAlive?.(id)) return;
  const rec = setCombatPosture(world, id, COMBAT_POSTURES.balanced, { reason: "move" });
  if (!rec) return;
  rec.lastMoveStep = Number(world.step || 0) | 0;
}
