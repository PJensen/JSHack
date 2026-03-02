import { defineComponent } from "../../lib/ecs-js/index.js";

export const EffectImmunities = defineComponent(
  "EffectImmunities",
  {
    immuneTo: /** @type {string[]} */ ([]),
  }
);
