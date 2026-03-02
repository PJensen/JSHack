import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Inventory component
 * - items: array of entity ids contained in this inventory
 * - capacity: max number of distinct item stacks (slots)
 *
 * Weight limits are not tracked here. Carry capacity is derived from
 * Stamina.maxStamina (1:1 kg) by encumbranceSystem.
 */
export const Inventory = defineComponent(
  "Inventory",
  {
    items: [],
    capacity: 20,
  },
  {
    validate(rec) {
      if (!Array.isArray(rec.items)) throw new Error("Inventory.items must be an array");
      if (!Number.isFinite(rec.capacity) || rec.capacity < 0)
        throw new Error("Inventory.capacity must be a non-negative number");
      return true;
    },
  }
);
