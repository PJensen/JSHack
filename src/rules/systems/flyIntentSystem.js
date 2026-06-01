import { FlyIntent } from "../components/Intents/FlyIntent.js";
import { Flying } from "../components/Flying.js";
import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { getMonster } from "../data/monsters.js";
import { sleepPreventsMovement } from "../utils/sleep.js";

/**
 * Resolve FlyIntent as a full action: taking off or landing consumes the turn.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function flyIntentSystem(world) {
  for (const [id, intent] of world.query(FlyIntent)) {
    if (sleepPreventsMovement(world, id)) {
      try { world.remove(id, FlyIntent); } catch {}
      continue;
    }

    const airborne = !!intent?.airborne;
    const isFlying = world.has(id, Flying);
    const pos = world.get(id, Position);
    const ni = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    const name = def?.name || ni?.name || "";

    if (airborne && !isFlying) {
      world.add(id, Flying, {});
      world.emit("proc:fly:takeoff", { id, x: pos?.x ?? 0, y: pos?.y ?? 0, name });
    } else if (!airborne && isFlying) {
      world.remove(id, Flying);
      world.emit("proc:fly:land", { id, x: pos?.x ?? 0, y: pos?.y ?? 0, name });
    }

    try { world.remove(id, FlyIntent); } catch {}
  }
}
