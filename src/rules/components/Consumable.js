import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Consumable component representing items that can be consumed/used.
 * @property {string} [effectKey] - Legacy script key (optional during migration).
 * @property {object} effectParams - Plain data passed to the script handler as context.params.
 * @property {number} remainingUses - Number of uses left for the consumable item.
 * @property {object} meta - Additional metadata for the consumable item.
 */
export const Consumable = defineComponent(
  "Consumable",
  {
    effectKey: '',
    effectParams: {},
    potency: 0,
    remainingUses: 1,
    meta: { },
  },
  {
    validate(rec) {
      if (rec.effectKey != null && typeof rec.effectKey !== "string")
        throw new Error("Consumable.validate(): effectKey must be a string when provided");

      if (rec.effectParams != null && typeof rec.effectParams !== "object")
        throw new Error("Consumable.validate(): effectParams must be an object or null");

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
