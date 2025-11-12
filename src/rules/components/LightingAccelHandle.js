import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * LightingAccelHandle — derived lighting resource pointer per floor.
 */
export const LightingAccelHandle = defineComponent(
  "LightingAccelHandle",
  {
    floorId: 0,
    accelPtr: null,
    version: 0,
    ttlTicks: 0,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.floorId)) {
        throw new Error("LightingAccelHandle.floorId must be a finite number");
      }
      if (!Number.isFinite(rec.version) || rec.version < 0) {
        throw new Error("LightingAccelHandle.version must be a non-negative number");
      }
      if (!Number.isFinite(rec.ttlTicks) || rec.ttlTicks < 0) {
        throw new Error("LightingAccelHandle.ttlTicks must be a non-negative number");
      }
      return true;
    },
  }
);

export const __doc__ = {
  purpose: "Caches derived lighting acceleration data keyed to kernel versions",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Lighting acceleration TTL keeps recent floors warm for quick revisits.",
    "Version tracks kernel synchronization for deterministic lighting.",
  ],
};
