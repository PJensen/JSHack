import { DamageApplied } from "../../components/DamageApplied.js";
import { applyItemDestructionForDamage } from "../itemDestructionSystem.js";

export function itemDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    applyItemDestructionForDamage(world, damage);
  }
}
