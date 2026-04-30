import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * EnchantmentNode marks an attached runtime enchantment on an item.
 */
export const EnchantmentNode = defineComponent("EnchantmentNode", {
  defId: "",
  level: 1,
});
