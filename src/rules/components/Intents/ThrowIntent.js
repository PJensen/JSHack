import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * ThrowIntent — request for an actor to throw an inventory item.
 * actor entity holds this component for one tick; systems consume and remove it.
 * Fields:
 * - itemId: entity id of the item to throw
 * - targetId: optional target entity id
 * - x, y: optional target tile coordinates
 */
export const ThrowIntent = defineComponent("ThrowIntent", {
  itemId: 0,
  targetId: 0,
  x: null,
  y: null,
});
