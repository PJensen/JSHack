// itemCooldownSystem.js
// Tick down per-item use cooldowns each turn.
import { ItemCooldown } from "../components/ItemCooldown.js";

export function itemCooldownSystem(world) {
  for (const [, cd] of world.query(ItemCooldown)) {
    if (cd.turnsRemaining > 0) {
      cd.turnsRemaining = Math.max(0, cd.turnsRemaining - 1);
    }
  }
}
