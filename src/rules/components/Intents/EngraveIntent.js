import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * EngraveIntent — queued by input to engrave text on the ground
 * at the actor's current position.
 *
 * @property {string} text - The text to engrave on the ground.
 */
export const EngraveIntent = defineComponent("EngraveIntent", {
  text: "",
});
