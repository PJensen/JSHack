import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * DropIntent — request for an actor to drop an inventory item onto their current tile.
 * Fields:
 * - itemId: entity id of the item in inventory to drop
 * - count: optional number to drop from a stack (defaults to full stack)
 */
export const DropIntent = defineComponent("DropIntent", {
  itemId: 0,
  count: null,
}, {
  validate(rec) {
    return Number.isInteger(rec.itemId) && rec.itemId >= 0 && (rec.count == null || (Number.isFinite(rec.count) && rec.count > 0));
  }
});
