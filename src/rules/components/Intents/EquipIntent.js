import { defineComponent } from "../../../lib/ecs-js/index.js";
/**
 * EquipIntent — one-shot intent placed on the actor, pointing to an inventory item to equip.
 * targetSlot — when set to 'weapon' or 'offhand', skips auto-cascade and equips directly.
 */
export const EquipIntent = defineComponent("EquipIntent", {
  itemId: 0, // entity id of the item in inventory to equip
  targetSlot: '', // optional: 'weapon' or 'offhand' to bypass auto-cascade
});
