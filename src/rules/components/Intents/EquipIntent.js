import { defineComponent } from "../../../lib/ecs-js/index.js";
/**
 * EquipIntent — one-shot intent placed on the actor, pointing to an inventory item to equip.
 */
export const EquipIntent = defineComponent("EquipIntent", {
  itemId: 0, // entity id of the item in inventory to equip
});
