import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DoorLock — associates a door with a specific lock id.
 */
export const DoorLock = defineComponent(
  "DoorLock",
  {
    lockId: "",
  },
  {
    validate(rec) {
      if (typeof rec.lockId !== "string" || rec.lockId.length <= 0) {
        throw new Error("DoorLock.lockId");
      }
      return true;
    },
  },
);
