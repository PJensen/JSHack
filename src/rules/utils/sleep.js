import { SleepState } from "../components/SleepState.js";
import { statusStrength } from "./statusFacade.js";

export const SLEEP_STATUS = "sleep";
export const SLEEP_DISPLAY_TAG = "sleeping";

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 * @returns {boolean}
 */
export function isAsleep(world, id) {
  return statusStrength(world, Number(id || 0) | 0, SLEEP_STATUS) > 0;
}

export function sleepPreventsAction(world, id) {
  return isAsleep(world, id);
}

export function sleepPreventsMovement(world, id) {
  return isAsleep(world, id);
}

export function sleepPreventsPerception(world, id) {
  return isAsleep(world, id);
}

/**
 * Canonical sleep transition. Returns true only when this call changes state
 * from awake to asleep. Existing SleepState data may still be refreshed.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 * @param {{ reason?: string, wakeDifficulty?: number, wakeRadius?: number, wakeOnDamage?: boolean, source?: number, suppressEvent?: boolean }} [opts]
 * @returns {boolean}
 */
export function putActorToSleep(world, id, opts = {}) {
  const actorId = Number(id || 0) | 0;
  if (!(actorId > 0)) return false;
  if (typeof world?.isAlive === "function" && !world.isAlive(actorId)) return false;

  const prev = world.get(actorId, SleepState);
  const wasAsleep = prev?.asleep === true;
  const next = {
    ...(prev || {}),
    asleep: true,
    wakeDifficulty: Math.max(0, Number(opts.wakeDifficulty ?? prev?.wakeDifficulty ?? 8) || 0),
    wakeRadius: Math.max(0, Number(opts.wakeRadius ?? prev?.wakeRadius ?? 2) || 0),
    wakeOnDamage: opts.wakeOnDamage ?? prev?.wakeOnDamage ?? true,
  };

  if (world.has(actorId, SleepState)) world.set(actorId, SleepState, next);
  else world.add(actorId, SleepState, next);

  if (!wasAsleep && opts.suppressEvent !== true) {
    world.emit?.("sleep:slept", {
      actor: actorId,
      reason: String(opts.reason || "sleep"),
      source: Number(opts.source || 0) | 0,
    });
  }
  return !wasAsleep;
}

/**
 * Canonical wake transition. Returns true only when this call changes state.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 * @param {{ reason?: string, intensity?: number, source?: number }} [opts]
 * @returns {boolean}
 */
export function tryWakeActor(world, id, opts = {}) {
  const actorId = Number(id || 0) | 0;
  if (!(actorId > 0)) return false;
  const sleep = world.get(actorId, SleepState);
  if (!sleep || sleep.asleep !== true) return false;

  const reason = String(opts.reason || "disturbance");
  const intensity = Number.isFinite(opts.intensity) ? Number(opts.intensity) : 0;
  const difficulty = Math.max(0, Number(sleep.wakeDifficulty || 0));
  if (reason !== "damage" && difficulty > 0 && intensity < difficulty) {
    return false;
  }

  world.set(actorId, SleepState, { ...sleep, asleep: false });
  world.emit?.("sleep:woke", {
    actor: actorId,
    reason,
    intensity,
    source: Number(opts.source || 0) | 0,
  });
  return true;
}
