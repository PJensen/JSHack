import { PrayIntent } from "../components/Intents/PrayIntent.js";
import { Devotion } from "../components/Devotion.js";
import { Player } from "../components/Player.js";
import { getDeityInstance } from "./deitySystem.js";

/**
 * praySystem — processes PrayIntent by calling deity.pray()
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function praySystem(world) {
  for (const [id] of world.query(PrayIntent)) {
    // Only players with devotion can pray
    if (world.has(id, Player)) {
      const devotion = world.get(id, Devotion);
      if (devotion?.deityId) {
        const deity = getDeityInstance(devotion.deityId);
        if (deity) {
          deity.pray();
          // Emit event for logging/UI feedback
          try {
            world.emit && world.emit('prayer', { actor: id, deityId: devotion.deityId });
          } catch { /* */ }
        }
      }
    }

    // Consume the intent
    try { world.remove(id, PrayIntent); } catch {}
  }
}
