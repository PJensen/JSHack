import { defineComponent } from "../../../lib/ecs-js/index.js";
/**
 * DrinkIntent — one-shot intent placed on the actor, pointing to an inventory item to drink/use.
 */
export const DrinkIntent = defineComponent("DrinkIntent", {
  itemId: 0, // entity id of the Potion in inventory
  targetId: 0, // entity to apply on (usually self; can be ally for 'topical' route)
});
