import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * GeomHandle — references the cached analytic kernel for a floor.
 */
export const GeomHandle = defineComponent(
  "GeomHandle",
  {
    floorId: 0,
    kernelKey: "",
    snapshotPtr: null,
    version: 0,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.floorId)) {
        throw new Error("GeomHandle.floorId must be a finite number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Stores live analytic kernel references and versioning per floor",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Kernel key enables cache invalidation without rebuilding.",
    "Snapshot pointer references the current Kernel2D instance.",
  ],
};
