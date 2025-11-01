import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Inventory component
 * - items: array of entity ids contained in this inventory
 * - capacity: max number of distinct item stacks (slots)
 * - weightLimit: optional max total weight (sum of weight*count); if null/undefined, unlimited
 */
export const Inventory = defineComponent(
  "Inventory",
  {
    items: [],
    capacity: 20,
    weightLimit: null,
  },
  {
    validate(rec) {
      if (!Array.isArray(rec.items)) throw new Error("Inventory.items must be an array");
      if (!Number.isFinite(rec.capacity) || rec.capacity < 0)
        throw new Error("Inventory.capacity must be a non-negative number");
      if (rec.weightLimit != null && (!Number.isFinite(rec.weightLimit) || rec.weightLimit < 0))
        throw new Error("Inventory.weightLimit must be null or a non-negative number");
      return true;
    },
  }
);
