import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * FloorState — references hashes describing door states and dynamic edits per floor.
 */
export const FloorState = defineComponent(
  "FloorState",
  {
    floorId: 0,
    doorStatesHash: "",
    dynamicEditsHash: "",
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.floorId)) {
        throw new Error("FloorState.floorId must be a finite number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Holds per-floor hashes used to detect kernel rebuild requirements",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Door and dynamic edit hashes feed kernel cache validation.",
    "Used alongside GeomHandle to track live kernel versions.",
  ],
};
