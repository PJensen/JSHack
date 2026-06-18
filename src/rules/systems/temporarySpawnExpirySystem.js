import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Changed, defineWorldResource } from "../../lib/ecs-js/index.js";
import { TemporarySpawn } from "../components/TemporarySpawn.js";
import { Position } from "../components/Position.js";
import { Ashes } from "../archetypes/Items.js";
import { createTurnSchedule } from "../utils/turnSchedule.js";
import { attachEntityToCurrentFloor } from "../utils/floorEntities.js";
import { invalidateTileQueryCache } from "../utils/tileQueryCache.js";

export const temporarySpawnWakeupResource = defineWorldResource("jshack.temporarySpawnWakeups", {
  create() {
    return {
      wakeups: createTurnSchedule({ maxLevel: 10 }),
      seeded: false,
    };
  },
  reset(value) {
    const rec = value && typeof value === "object" ? value : null;
    if (!rec) return { wakeups: createTurnSchedule({ maxLevel: 10 }), seeded: false };
    if (rec.wakeups && typeof rec.wakeups.clear === "function") rec.wakeups.clear();
    else rec.wakeups = createTurnSchedule({ maxLevel: 10 });
    rec.seeded = false;
    return rec;
  },
});

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function getWakeupState(world) {
  return world.resource(temporarySpawnWakeupResource);
}

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function getWakeups(world) {
  const state = getWakeupState(world);
  if (!state.wakeups) state.wakeups = createTurnSchedule({ maxLevel: 10 });
  return state.wakeups;
}

function replacementArchetype(kind) {
  switch (String(kind || "")) {
    case "ashes":
      return Ashes;
    default:
      return null;
  }
}

function readDueTurn(temp) {
  const due = Number(temp?.expiresAtTurn || 0) | 0;
  return due > 0 ? due : null;
}

function scheduleTemporary(world, id, temp) {
  const wakeups = getWakeups(world);
  const key = String(id | 0);
  const due = readDueTurn(temp);
  if (due == null) wakeups.cancel(key);
  else wakeups.schedule(key, due, id | 0);
}

/**
 * One-time seed from existing temporary entities, including save/restore paths.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function seedWakeups(world) {
  const state = getWakeupState(world);
  if (state.seeded) return;
  for (const [id, temp] of world.query(TemporarySpawn)) {
    scheduleTemporary(world, id, temp);
  }
  state.seeded = true;
}

/**
 * Keep the skip-list aligned with newly added or mutated temporary rows.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
function syncChangedWakeups(world) {
  for (const [id, temp] of world.query(TemporarySpawn, Changed(TemporarySpawn))) {
    scheduleTemporary(world, id, temp);
  }
}

/**
 * Expire temporary materialized entities when their absolute due turn arrives.
 *
 * Phase: cleanup, before spatial index sync.
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function temporarySpawnExpirySystem(world) {
  const now = Number(world.step || 0) | 0;
  seedWakeups(world);
  syncChangedWakeups(world);
  const wakeups = getWakeups(world);

  wakeups.drainDue(now, (_key, value) => {
    const id = Number(value || 0) | 0;
    if (!(id > 0) || !world.isAlive(id)) return;
    const temp = world.get(id, TemporarySpawn);
    if (!temp) return;
    const due = Number(temp.expiresAtTurn || 0) | 0;
    if (due > now) return;

    const pos = world.get(id, Position);
    const at = pos ? { x: pos.x | 0, y: pos.y | 0 } : null;
    const replacement = replacementArchetype(temp.replacementKind);
    let replacementId = 0;
    if (replacement && at) {
      replacementId = Number(createFrom(world, replacement, { x: at.x, y: at.y }) || 0) | 0;
      if (replacementId > 0) {
        try { world.add(replacementId, Position, at); } catch {}
        attachEntityToCurrentFloor(world, replacementId);
      }
    }

    world.emit?.("temporary:expired", {
      id,
      at,
      source: String(temp.source || ""),
      replacementKind: String(temp.replacementKind || ""),
      replacementId,
    });
    world.destroy(id);
    invalidateTileQueryCache(world);
  });
}
