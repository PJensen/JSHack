import { defineComponent } from "../../lib/ecs-js/index.js";

export const VoidHole = defineComponent(
  "VoidHole",
  {
    sourceId: 0,
    radius: 3,
    pullSteps: 1,
    tickDamage: 4,
  },
  {
    validate(rec) {
      if (!rec) throw new Error("VoidHole record required");
      rec.sourceId = Number.isFinite(rec.sourceId) ? (rec.sourceId | 0) : 0;
      rec.radius = Number.isFinite(rec.radius) ? Math.max(1, rec.radius | 0) : 3;
      rec.pullSteps = Number.isFinite(rec.pullSteps) ? Math.max(0, rec.pullSteps | 0) : 1;
      rec.tickDamage = Number.isFinite(rec.tickDamage) ? Math.max(0, rec.tickDamage | 0) : 4;
      return true;
    },
  },
);
