import { DamageApplied } from "../../components/DamageApplied.js";
import { recordDeathImpactFromDamage } from "../cleanupSystem.js";

export function deathImpactDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    recordDeathImpactFromDamage(world, damage);
  }
}
