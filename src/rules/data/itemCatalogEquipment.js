// Equipment entries for the item catalog.
// All items except torch have been migrated to src/content/items/.
import { createTorchThrowHook } from "./itemCatalogHooks.js";
import { WEAPON_FAMILIES } from "./weaponFamilies.js";

export const EQUIPMENT_ITEMS = {
  // torch: raw on_throw hook requires catalog-layer factory, not migratable to content DSL
  torch: {
    id: "torch",
    catalogKind: "equipment",
    name: "Torch",
    type: "equip",
    slot: "offhand",
    weaponFamily: WEAPON_FAMILIES.woodenStaff,
    material: "wood",
    rarity: 1,
    rarityName: "common",
    weight: 1,
    value: 2,
    damageDice: "1d3",
    damageType: "blunt",
    staminaCost: 6,
    bonuses: { visionRange: 2 },
    description: "A burning torch with a steady flame. It does not seem likely to run out any time soon.",
    hooks: {
      on_throw: createTorchThrowHook({
        turnsLeft: 3,
        radius: 0,
        tickDamage: 2,
      }),
    },
  },
};
