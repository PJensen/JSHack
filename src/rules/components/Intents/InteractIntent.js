import { defineComponent } from "../../../lib/ecs-js/index.js";

// InteractIntent — actor wishes to interact with a target entity (e.g., door, chest)
export const InteractIntent = defineComponent("InteractIntent", {
	targetId: 0,
	mode: "",
	recipe: "",
});
