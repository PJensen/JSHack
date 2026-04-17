import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * HydraulicsLink - lightweight linkage metadata for mechanical dungeon props.
 *
 * linkId: groups related entities (e.g., winch + portcullis gates + plinth).
 * role: semantic role used by systems/interactions ("portcullis", "plinth", etc).
 */
export const HydraulicsLink = defineComponent("HydraulicsLink", {
  linkId: "",
  role: "",
});

