import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * ObjectState — generic string state for any entity (e.g. "lit", "unlit", "idle").
 * Reusable across furnaces, anvils, or any object that needs a simple state toggle.
 */
export const ObjectState = defineComponent(
    "ObjectState",
    {
        state: "idle",
    },
    {
        validate(rec) {
            if (typeof rec.state !== "string") throw new Error("ObjectState.state must be a string");
            return true;
        },
    }
);
