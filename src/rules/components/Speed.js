import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Speed — controls how often an entity acts.
 * actEvery: number of ticks between actions (1 = every tick, 2 = every other, etc.)
 */
export const Speed = defineComponent("Speed", { actEvery: 1 });
