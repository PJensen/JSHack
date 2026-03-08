import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Marker component: entity is currently airborne.
 * Added/removed by aiFlyingSystem each tick based on AI state and floor eligibility.
 */
export const Flying = defineComponent('Flying', {});
