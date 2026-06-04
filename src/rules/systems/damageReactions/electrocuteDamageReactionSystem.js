import { DamageApplied } from "../../components/DamageApplied.js";
import { applyElectrocuted } from "../../utils/electrocute.js";

export function electrocuteDamageReactionSystem(world) {
  for (const [, damage] of world.query(DamageApplied)) {
    if (!(damage.amount > 0)) continue;
    const type = String(damage.type || "");
    if (type !== "electric" && type !== "lightning") continue;
    applyElectrocuted(world, Number(damage.target || 0) | 0);
  }
}
