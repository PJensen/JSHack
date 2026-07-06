import { defineComponent } from "../../lib/ecs-js/index.js";

export const GuardedTreasure = defineComponent("GuardedTreasure", {
  guardianId: 0,
  radius: 6,
  disturbed: false,
  disturbedBy: 0,
  kind: "treasure",
}, {
  validate(rec) {
    rec.guardianId = Math.max(0, Number(rec.guardianId || 0) | 0);
    rec.radius = Math.max(0, Number(rec.radius || 0) | 0);
    rec.disturbed = rec.disturbed === true;
    rec.disturbedBy = Math.max(0, Number(rec.disturbedBy || 0) | 0);
    rec.kind = String(rec.kind || "treasure");
    return true;
  },
});
