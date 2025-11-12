import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * PortalH — canonical descriptor for horizontal portals within a floor (doors, gates).
 */
export const PortalH = defineComponent(
  "PortalH",
  {
    id: "",
    floorId: 0,
    shape2D: null,
    open: true,
    canTraverse: true,
    canSeeThrough: true,
  },
  {
    validate(rec) {
      if (!rec.id) throw new Error("PortalH.id is required");
      if (!Number.isFinite(rec.floorId)) {
        throw new Error("PortalH.floorId must be a finite number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Defines same-floor analytic portals such as doors or gates",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Used for gating traversal and visibility within a single floor.",
    "Shape metadata remains analytic for line-of-sight queries.",
  ],
};
