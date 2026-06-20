import { HealingApplied } from "../../components/HealingApplied.js";
import { applyHealingDeityReaction } from "../deitySystem.js";

export function deityHealingReactionSystem(world) {
  for (const [, healing] of world.query(HealingApplied)) {
    if (healing.amount > 0) applyHealingDeityReaction(world, healing);
  }
}
