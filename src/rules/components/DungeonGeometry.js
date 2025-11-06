import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DungeonGeometry — serialized analytic dungeon primitives for the active level.
 * Holds the authoritative carved geometry data so other systems can rebuild kernels.
 */
export const DungeonGeometry = defineComponent(
  "DungeonGeometry",
  {
    seed: 0,
    mbrVersion: 0,
    moveVersion: 0,
    occlVersion: 0,
    mbr: null,
    primitives: [],
    meta: null,
    options: null,
  },
  {
    validate(rec) {
      if (!Number.isFinite(rec.seed)) {
        throw new Error(`DungeonGeometry.seed must be a finite number (got ${rec.seed})`);
      }
      if (!Number.isFinite(rec.mbrVersion) || rec.mbrVersion < 0) {
        throw new Error(`DungeonGeometry.mbrVersion must be a non-negative number (got ${rec.mbrVersion})`);
      }
      if (!Number.isFinite(rec.moveVersion) || rec.moveVersion < 0) {
        throw new Error(`DungeonGeometry.moveVersion must be a non-negative number (got ${rec.moveVersion})`);
      }
      if (!Number.isFinite(rec.occlVersion) || rec.occlVersion < 0) {
        throw new Error(`DungeonGeometry.occlVersion must be a non-negative number (got ${rec.occlVersion})`);
      }
      if (rec.mbr != null) {
        const m = rec.mbr;
        const ok = Number.isFinite(m.minX) && Number.isFinite(m.minY) &&
          Number.isFinite(m.maxX) && Number.isFinite(m.maxY) &&
          m.minX <= m.maxX && m.minY <= m.maxY;
        if (!ok) {
          throw new Error("DungeonGeometry.mbr must be a valid bounding box");
        }
      }
      if (!Array.isArray(rec.primitives)) {
        throw new Error("DungeonGeometry.primitives must be an array");
      }
      if (rec.options != null && typeof rec.options !== "object") {
        throw new Error("DungeonGeometry.options must be an object when provided");
      }
      return true;
    },
  }
);
