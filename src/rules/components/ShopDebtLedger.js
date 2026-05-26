import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Actor-side shop debts for value extracted from unpaid merchandise that may
 * no longer exist as carried items.
 */
export const ShopDebtLedger = defineComponent(
  "ShopDebtLedger",
  {
    debts: [],
  },
  {
    validate(rec) {
      return Array.isArray(rec.debts);
    },
  },
);
