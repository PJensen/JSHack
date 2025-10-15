import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Consumable component representing items that can be consumed/used.
 * @property {function} useEffect - Function defining the effect when the item is used.
 * @property {number} remainingUses - Number of uses left for the consumable item.
 * @property {object} meta - Additional metadata for the consumable item.
 */
export const Consumable = defineComponent(
  "Consumable",
  {
    useEffect: null,
    remainingUses: 1,
    meta: { },
  },
  {
    validate(rec) {
      if (typeof rec.useEffect !== "function")
        throw new Error("Consumable.validate(): useEffect must be a function");

      if (typeof rec.potency !== "number" || rec.potency < 0)
        throw new Error(
          "Consumable.validate(): potency must be a non-negative number"
        );
      if (!Number.isInteger(rec.remainingUses) || rec.remainingUses < 0)
        throw new Error(
          "Consumable.validate(): remainingUses must be a non-negative integer"
        );
      return true;
    },
  }
);
