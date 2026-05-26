import { defineComponent } from "../../lib/ecs-js/index.js";

export const SHOP_DEBT_STATUS = Object.freeze({
  unpaid: "unpaid",
  paid: "paid",
  forgiven: "forgiven",
});

/**
 * A concrete debt fact attached under the debtor actor.
 */
export const ShopDebt = defineComponent(
  "ShopDebt",
  {
    shopkeeperId: 0,
    amount: 0,
    reason: "unauthorized_use",
    itemId: 0,
    identity: "",
    name: "",
    createdTurn: 0,
    status: SHOP_DEBT_STATUS.unpaid,
  },
  {
    validate(rec) {
      const status = String(rec.status || SHOP_DEBT_STATUS.unpaid);
      return (
        typeof rec.shopkeeperId === "number" &&
        rec.shopkeeperId > 0 &&
        typeof rec.amount === "number" &&
        rec.amount >= 0 &&
        typeof rec.reason === "string" &&
        typeof rec.itemId === "number" &&
        typeof rec.identity === "string" &&
        typeof rec.name === "string" &&
        typeof rec.createdTurn === "number" &&
        Object.hasOwn(SHOP_DEBT_STATUS, status)
      );
    },
  },
);
