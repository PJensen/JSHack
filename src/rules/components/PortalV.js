import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * PortalV — canonical descriptor for vertical portals connecting two floors.
 */
export const PortalV = defineComponent(
  "PortalV",
  {
    id: "",
    fromFloor: 0,
    toFloor: 0,
    shape2D: null,
    zRange: [0, 0],
    open: true,
    canTraverse: true,
    canSeeThrough: true,
    visAttn: 1.0,
    reentrySnapEpsilon: 0.05,
    arrivalFacing: 0.0,
    transformAB: null,
    transformBA: null,
  },
  {
    validate(rec) {
      if (!rec.id) throw new Error("PortalV.id is required");
      if (!Number.isFinite(rec.fromFloor) || !Number.isFinite(rec.toFloor)) {
        throw new Error("PortalV floors must be finite numbers");
      }
      if (rec.visAttn < 0 || !Number.isFinite(rec.visAttn)) {
        throw new Error("PortalV.visAttn must be a finite, non-negative number");
      }
      if (!Number.isFinite(rec.reentrySnapEpsilon) || rec.reentrySnapEpsilon < 0) {
        throw new Error("PortalV.reentrySnapEpsilon must be a non-negative number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Defines analytic vertical portals mediating traversal between floors",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Portal transforms remain bijective between connected footprints.",
    "Traversal and LOS gating leverage open/canTraverse/canSeeThrough flags.",
  ],
};
