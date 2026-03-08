import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Marker component: entity is currently airborne.
 * Added/removed by flyIntentSystem after AI claims a takeoff/landing turn.
 */
export const Flying = defineComponent('Flying', {});
