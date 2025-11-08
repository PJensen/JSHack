import { defineComponent } from "../../../lib/ecs-js/index.js";

// Intent to rotate an actor toward a direction or world-space point.
export const FaceIntent = defineComponent("FaceIntent", {
  dx: 0,
  dy: 0,
  toX: 0,
  toY: 0,
});
