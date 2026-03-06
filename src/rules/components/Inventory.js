import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Inventory component
 * - capacity: max number of distinct item stacks (slots)
 *
 * Containment is modeled via the ECS hierarchy using a hidden InventoryRoot:
 * owner -> InventoryRoot -> item.
 * Use the inventoryFacade for all read/write operations.
 *
 * Weight limits are not tracked here. Carry capacity is derived from
 * Stamina.maxStamina (1:1 kg) by encumbranceSystem.
 */
export const Inventory = defineComponent(
  "Inventory",
  {
    capacity: 20,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.capacity) || rec.capacity < 0)
        throw new Error("Inventory.capacity must be a non-negative number");
      return true;
    },
  }
);
