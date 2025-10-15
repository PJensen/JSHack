import { defineComponent } from "../../lib/ecs-js/core.js";

export const Terrain = defineComponent(
    "Terrain",
    {
        walkable: false,
        opaque: true,
    }
);
