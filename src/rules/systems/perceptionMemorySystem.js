import { DungeonState } from "../components/DungeonState.js";
import { PERCEPTION_TUNING } from "../environment/dungeon/perceptionTuning.js";
import { forgetPerceptionContact, gcPerceptionMemory } from "../environment/dungeon/perceptionMemory.js";

const INSTALLED_KEY = Symbol.for("jshack:perceptionMemory:listeners:installed");

function currentDepth(world) {
  for (const [, ds] of world.query(DungeonState)) {
    return Number(ds.currentDepth || 0) | 0;
  }
  return 0;
}

export function installPerceptionMemoryListeners(world) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  world.on("died", ({ id }) => {
    const entityId = Number(id || 0) | 0;
    if (!(entityId > 0)) return;
    forgetPerceptionContact(currentDepth(world), entityId);
  });
}

export function perceptionMemorySystem(world) {
  const depth = currentDepth(world);
  gcPerceptionMemory(depth, world.step | 0, PERCEPTION_TUNING.memoryTtlTurns);
}

