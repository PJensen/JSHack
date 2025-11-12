import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * FloorRef — identifies which dungeon floor an entity occupies along with its analytic coordinates.
 */
export const FloorRef = defineComponent(
  "FloorRef",
  {
    floorId: 0,
    altitude: 0,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.floorId)) {
        throw new Error(`FloorRef.floorId must be a finite number (got ${rec.floorId})`);
      }
      if (!Number.isFinite(rec.altitude)) {
        throw new Error(`FloorRef.altitude must be a finite number (got ${rec.altitude})`);
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Tracks which analytic dungeon floor an entity currently inhabits",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Provides floor affinity for portal traversal and floor activation systems.",
    "Altitude remains analytic metadata for vertical ordering only.",
  ],
};
