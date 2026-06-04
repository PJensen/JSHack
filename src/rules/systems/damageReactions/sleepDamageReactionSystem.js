import { DamageApplied } from "../../components/DamageApplied.js";
import { SleepState } from "../../components/SleepState.js";
import { tryWakeActor } from "../../utils/sleep.js";

export function sleepDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    if (!(damage.amount > 0)) continue;
    const target = Number(damage.target || 0) | 0;
    const sleep = world.get(target, SleepState);
    if (!sleep || sleep.asleep !== true || sleep.wakeOnDamage === false) continue;
    tryWakeActor(world, target, {
      reason: "damage",
      intensity: Math.max(1, Number(damage.amount || 0)),
      source: Number(damage.source || 0) | 0,
    });
  }
}
