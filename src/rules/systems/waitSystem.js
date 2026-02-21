import { WaitIntent } from "../components/Intents/WaitIntent.js";

// waitSystem — simply consumes WaitIntent to allow a turn to pass
export function waitSystem(world) {
  for (const [id] of world.query(WaitIntent)) {
    try { world.remove(id, WaitIntent); } catch {} // ECS: may not exist
  }
}
