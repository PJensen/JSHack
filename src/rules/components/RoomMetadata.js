import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * RoomMetadata component stores information about special rooms.
 * Attached to terrain/marker entities to identify room boundaries and types.
 * @property {string} roomType - Type of room: "shop", "temple", "vault", etc.
 * @property {number} x - Room top-left x coordinate
 * @property {number} y - Room top-left y coordinate
 * @property {number} w - Room width
 * @property {number} h - Room height
 * @property {number} shopkeeperId - Entity ID of the shopkeeper (if roomType === "shop")
 */
export const RoomMetadata = defineComponent(
  "RoomMetadata",
  {
    roomType: "generic",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    shopkeeperId: 0,
  },
  {
    validate(rec) {
      return (
        typeof rec.roomType === "string" &&
        rec.roomType.length > 0 &&
        typeof rec.x === "number" &&
        typeof rec.y === "number" &&
        typeof rec.w === "number" &&
        rec.w > 0 &&
        typeof rec.h === "number" &&
        rec.h > 0
      );
    }
  }
);
