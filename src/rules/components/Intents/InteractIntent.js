import { defineComponent } from "../../../lib/ecs-js/index.js";

// InteractIntent — actor wishes to interact with a target entity (e.g., door, chest)
//
// Fields:
//   targetId — the entity to interact with
//   mode     — optional sub-mode string (e.g. "brew", "offer")
//   recipe   — optional recipe key for crafting interactions
//   itemId   — optional item entity ID (e.g. altar offering selection)
export const InteractIntent = defineComponent("InteractIntent", {
	targetId: 0,
	mode: "",
	recipe: "",
	itemId: 0,
});
