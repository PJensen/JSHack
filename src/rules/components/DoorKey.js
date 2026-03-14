import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DoorKey — portable key for a matching DoorLock.lockId.
 */
export const DoorKey = defineComponent(
  "DoorKey",
  {
    lockId: "",
  },
  {
    validate(rec) {
      if (typeof rec.lockId !== "string" || rec.lockId.length <= 0) {
        throw new Error("DoorKey.lockId");
      }
      return true;
    },
  },
);
