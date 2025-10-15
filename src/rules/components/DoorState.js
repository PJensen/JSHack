import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DoorState — tracks whether a door is open or locked.
 * Pure rules; no display logic.
 */
export const DoorState = defineComponent(
    "DoorState",
    {
        open: false,
        locked: false,
    },
    {
        validate(rec) {
            if (typeof rec.open !== "boolean") throw new Error("DoorState.open");
            if (typeof rec.locked !== "boolean") throw new Error("DoorState.locked");
            if (rec.open && rec.locked)
                throw new Error(
                    "DoorState: cannot be open and locked at the same time"
                );
            return true;
        },
    }
);
