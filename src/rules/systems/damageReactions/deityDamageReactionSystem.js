import { DamageApplied } from "../../components/DamageApplied.js";
import { applyPetDamageDeityReaction } from "../deitySystem.js";

export function deityDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    if (!(damage.amount > 0)) continue;
    applyPetDamageDeityReaction(world, damage);
  }
}
