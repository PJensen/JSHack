import { SleepState } from "../components/SleepState.js";

const INSTALLED = Symbol.for("jshack:sleep:wakeListeners:installed");

/**
 * @param {import("../../lib/ecs-js/index.js").World} world
 * @param {number} id
 * @returns {boolean}
 */
export function isAsleep(world, id) {
  const sleep = world.get(Number(id || 0) | 0, SleepState);
  return !!sleep && sleep.asleep === true;
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
  if (reason !== "damage" && difficulty > 0 && intensity > 0 && intensity < difficulty) {
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

/**
 * Install sleep wake listeners once per world.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function installSleepWakeListeners(world) {
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("damaged", ({ target, source, amount }) => {
    if (!(amount > 0)) return;
    const sleep = world.get(Number(target || 0) | 0, SleepState);
    if (!sleep || sleep.asleep !== true || sleep.wakeOnDamage === false) return;
    tryWakeActor(world, target, {
      reason: "damage",
      intensity: Math.max(1, Number(amount || 0)),
      source,
    });
  });
}
