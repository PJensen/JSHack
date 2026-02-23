import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * DisarmIntent — actor attempts to disarm an adjacent trap.
 * If no trapId is provided, the system searches the actor's tile and neighbors.
 */
export const DisarmIntent = defineComponent("DisarmIntent", {
  trapId: 0,   // optional: specific trap entity to target
});
