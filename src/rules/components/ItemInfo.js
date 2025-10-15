import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * ItemInfo — rules-side description of an item.
 * Used for inventory logic, weight calculations, equipment slots, etc.
 * No display names, glyphs, or color info.
 */
export const ItemInfo = defineComponent(
  "ItemInfo",
  {
    type: "", // logical category, e.g. "weapon", "potion", "scroll"
    slot: "", // intended equipment or container slot, e.g. "hand", "bag"
    weight: 0, // numeric weight (for encumbrance or turn cost)
    value: 0, // optional numeric value for trade/scoring
    stackable: false, // optional: can this be stacked in inventory?
    description: "", // flavor text description of the item
  },
  {
    validate(rec) {
      if (typeof rec.type !== "string")
        throw new Error("ItemInfo.validate(): type must be a string");
      if (typeof rec.slot !== "string")
        throw new Error("ItemInfo.validate(): slot must be a string");
      if (typeof rec.weight !== "number" || rec.weight < 0)
        throw new Error(
          "ItemInfo.validate(): weight must be a non-negative number"
        );
      if (typeof rec.value !== "number" || rec.value < 0)
        throw new Error(
          "ItemInfo.validate(): value must be a non-negative number"
        );
      if (typeof rec.stackable !== "boolean")
        throw new Error("ItemInfo.validate(): stackable must be a boolean");
      if (typeof rec.description !== "string")
        throw new Error("ItemInfo.validate(): description must be a string");
      return true;
    },
  }
);
