import { WaitIntent } from "../components/Intents/WaitIntent.js";
import { COMBAT_POSTURES } from "../components/CombatPosture.js";
import { setCombatPosture } from "../utils/posture.js";

// waitSystem — simply consumes WaitIntent to allow a turn to pass
export function waitSystem(world) {
  for (const [id] of world.query(WaitIntent)) {
    setCombatPosture(world, id, COMBAT_POSTURES.guarded, { reason: "wait" });
    try { world.remove(id, WaitIntent); } catch {} // ECS: may not exist
  }
}
