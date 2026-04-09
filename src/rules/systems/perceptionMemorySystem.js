import { PERCEPTION_TUNING } from "../environment/dungeon/perceptionTuning.js";
import { forgetPerceptionContact, gcPerceptionMemory } from "../environment/dungeon/perceptionMemory.js";
import { currentDepth } from "../utils/worldAccess.js";

const INSTALLED_KEY = Symbol.for("jshack:perceptionMemory:listeners:installed");

export function installPerceptionMemoryListeners(world) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  world.on("died", ({ id }) => {
    const entityId = Number(id || 0) | 0;
    if (!(entityId > 0)) return;
    forgetPerceptionContact(currentDepth(world, 0), entityId);
  });
}

export function perceptionMemorySystem(world) {
  const depth = currentDepth(world, 0);
  gcPerceptionMemory(depth, world.step | 0, PERCEPTION_TUNING.memoryTtlTurns);
}
