import { defineComponent } from "../../lib/ecs-js/index.js";

export const ShopInventory = defineComponent("ShopInventory", {
    items: [],
    buyMarkup: 1.0,
    sellDiscount: 0.5,
});
