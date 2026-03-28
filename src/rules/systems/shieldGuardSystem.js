import { Equipment } from "../components/Equipment.js";
import { Vitality } from "../components/Vitality.js";
import { refreshShieldGuard } from "../utils/shieldGuard.js";

/** Keeps shield guard/broken state in sync with currently equipped shields. */
export function shieldGuardSystem(world) {
  for (const [id, eq, vit] of world.query(Equipment, Vitality)) {
    if (!eq || !vit || (Number(vit.hp || 0) | 0) <= 0) continue;
    refreshShieldGuard(world, id);
  }
}
