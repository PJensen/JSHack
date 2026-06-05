import { DeathApplied } from "../components/DeathApplied.js";
import { PERCEPTION_TUNING } from "../environment/dungeon/perceptionTuning.js";
import { forgetPerceptionContact, gcPerceptionMemory } from "../environment/dungeon/perceptionMemory.js";
import { currentDepth } from "../utils/worldAccess.js";

export function perceptionMemorySystem(world) {
  const depth = currentDepth(world, 0);
  for (const [, death] of world.query(DeathApplied)) {
    const entityId = Number(death.target || 0) | 0;
    if (entityId > 0) forgetPerceptionContact(depth, entityId);
  }
  gcPerceptionMemory(depth, world.step | 0, PERCEPTION_TUNING.memoryTtlTurns);
}
