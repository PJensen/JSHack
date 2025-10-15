import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Material — full physical + optical + radiological + mechanical properties.
 * Pure rules. No display, no names, no units outside comments.
 * e.g., 'steel','wood','stone','bone'
 */
export const Material = defineComponent(
  "Material", { kind: "generic" }
);
