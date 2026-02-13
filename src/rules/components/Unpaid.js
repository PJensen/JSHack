import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Unpaid component marks items that belong to a shop and haven't been paid for.
 * @property {number} shopkeeperId - The entity ID of the shopkeeper who owns this item
 * @property {number} price - The price the player must pay for this item
 */
export const Unpaid = defineComponent(
  "Unpaid",
  {
    shopkeeperId: 0,
    price: 0,
  },
  {
    validate(rec) {
      return (
        typeof rec.shopkeeperId === "number" &&
        rec.shopkeeperId > 0 &&
        typeof rec.price === "number" &&
        rec.price >= 0
      );
    }
  }
);
