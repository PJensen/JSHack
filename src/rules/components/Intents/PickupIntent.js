import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * PickupIntent — request for an actor to pick up a ground item.
 * actor entity holds this component for one tick; systems will consume and remove it.
 * Fields:
 * - targetId: entity id of the item to pick up
 * - count: optional number to pick from a ground stack (defaults to full stack)
 */
export const PickupIntent = defineComponent("PickupIntent", {
  targetId: 0,
  count: null,
}, {
  validate(rec) {
    return Number.isInteger(rec.targetId) && rec.targetId >= 0 && (rec.count == null || (Number.isFinite(rec.count) && rec.count > 0));
  }
});
