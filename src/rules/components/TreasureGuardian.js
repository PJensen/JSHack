import { defineComponent } from "../../lib/ecs-js/index.js";

export const TreasureGuardian = defineComponent("TreasureGuardian", {
  treasureId: 0,
  homeX: 0,
  homeY: 0,
  radius: 6,
  peacefulUntilDisturbed: true,
  disturbed: false,
  disturbedBy: 0,
  role: "guardian",
}, {
  validate(rec) {
    rec.treasureId = Math.max(0, Number(rec.treasureId || 0) | 0);
    rec.homeX = Number.isFinite(rec.homeX) ? (rec.homeX | 0) : 0;
    rec.homeY = Number.isFinite(rec.homeY) ? (rec.homeY | 0) : 0;
    rec.radius = Math.max(0, Number(rec.radius || 0) | 0);
    rec.peacefulUntilDisturbed = rec.peacefulUntilDisturbed !== false;
    rec.disturbed = rec.disturbed === true;
    rec.disturbedBy = Math.max(0, Number(rec.disturbedBy || 0) | 0);
    rec.role = String(rec.role || "guardian");
    return true;
  },
});
