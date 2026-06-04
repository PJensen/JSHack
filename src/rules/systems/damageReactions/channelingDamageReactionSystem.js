import { DamageApplied } from "../../components/DamageApplied.js";
import { applyDrainLifeDamageInterrupt } from "../channelingSystem.js";

export function channelingDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    if (!(damage.amount > 0)) continue;
    applyDrainLifeDamageInterrupt(world, damage);
  }
}
