import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DungeonLevel — aggregates floor ids and the currently active floor for a level.
 */
export const DungeonLevel = defineComponent(
  "DungeonLevel",
  {
    levelId: "",
    floors: [],
    activeFloorId: 0,
  },
  {
    validate(rec) {
      if (!rec.levelId) throw new Error("DungeonLevel.levelId is required");
      if (!Array.isArray(rec.floors)) {
        throw new Error("DungeonLevel.floors must be an array");
      }
      if (!Number.isFinite(rec.activeFloorId)) {
        throw new Error("DungeonLevel.activeFloorId must be a finite number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Tracks multi-floor dungeon metadata and active floor selection",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Authoritative list of floor ids per dungeon level.",
    "Active floor drives kernel cache hot-set and lighting maintenance.",
  ],
};
