import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * PortalTrace — ephemeral state ensuring deterministic round-trip traversal.
 */
export const PortalTrace = defineComponent(
  "PortalTrace",
  {
    portalId: "",
    fromFloor: 0,
    toFloor: 0,
    entryPosA: { x: 0, y: 0 },
    exitPosB: { x: 0, y: 0 },
    expiresAtTick: 0,
  },
  {
    validate(rec) {
      if (rec.portalId != null && typeof rec.portalId !== "string") {
        throw new Error("PortalTrace.portalId must be a string");
      }
      if (!Number.isFinite(rec.fromFloor) || !Number.isFinite(rec.toFloor)) {
        throw new Error("PortalTrace floors must be finite numbers");
      }
      if (!Number.isFinite(rec.expiresAtTick)) {
        throw new Error("PortalTrace.expiresAtTick must be a finite number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Tracks entry/exit points to guarantee round-trip portal re-entry",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Attached to traversing actors and cleared upon round-trip completion.",
    "Holds analytic entry/exit coordinates for lossless snapping.",
  ],
};
