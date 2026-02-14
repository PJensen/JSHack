import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * ApplyIntent — request for an actor to apply a tool item to a target inventory item.
 * actor entity holds this component for one tick; systems will consume and remove it.
 * Fields:
 * - itemId: entity id of the tool item (e.g., touchstone)
 * - targetItemId: entity id of the target item (e.g., a gem) */
export const ApplyIntent = defineComponent("ApplyIntent", {
    itemId: 0,
    targetItemId: 0
});
