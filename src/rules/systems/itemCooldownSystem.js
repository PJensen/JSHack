// itemCooldownSystem.js
// Advance item cooldowns using due-turn wakeups.
import { tickItemCooldowns } from "../utils/itemCooldowns.js";

export function itemCooldownSystem(world) {
  tickItemCooldowns(world);
}
