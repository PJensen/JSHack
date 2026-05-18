import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Vitality } from "../components/Vitality.js";
import { getMonster } from "../data/monsters.js";
import { resolveSleepProfile, resolveSleepScheduleNow } from "../data/sleepProfiles.js";
import { isAsleep, putActorToSleep, tryWakeActor } from "../utils/sleep.js";

function isSafeToFallAsleep(world, id) {
  const aggro = world.get(id, AggroState);
  if (!aggro) return true;
  return aggro.alertLevel === AGGRO_LEVELS.unaware;
}

/**
 * Applies time-of-day sleep schedules from monster sleep profiles.
 *
 * Scheduled sleep never overrides active aggro: an awake monster in any
 * non-unaware aggro state stays awake, even if the rest phase starts.
 *
 * @param {import("../../lib/ecs-js/index.js").World} world
 */
export function sleepScheduleSystem(world) {
  for (const [id, ident, vit] of world.query(NamedIdentity, Vitality)) {
    if (vit.hp <= 0) continue;

    const def = getMonster(String(ident.identity || ""));
    if (!def?.sleep) continue;

    const shouldSleep = resolveSleepScheduleNow(def.sleep, world.step || 0);
    if (shouldSleep == null) continue;

    if (!shouldSleep) {
      if (isAsleep(world, id)) {
        tryWakeActor(world, id, { reason: "scheduled_wake", intensity: 999 });
      }
      continue;
    }

    if (isAsleep(world, id)) continue;
    if (!isSafeToFallAsleep(world, id)) continue;

    const resolved = resolveSleepProfile(def.sleep);
    if (!resolved) continue;
    putActorToSleep(world, id, {
      reason: "scheduled_rest",
      wakeDifficulty: resolved.wakeDifficulty,
      wakeRadius: resolved.wakeRadius,
      wakeOnDamage: resolved.wakeOnDamage,
    });
  }
}
