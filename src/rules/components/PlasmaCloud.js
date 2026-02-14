import { defineComponent } from "../../lib/ecs-js/index.js";

export const PlasmaCloud = defineComponent(
  "PlasmaCloud",
  {
    turnsLeft: 3,
    radius: 1,
    damage: 2,
    sourceId: 0,
    sourceKind: "",
  },
  {
    validate(rec) {
      if (!rec) throw new Error("PlasmaCloud record required");
      if (!Number.isFinite(rec.turnsLeft)) throw new Error("PlasmaCloud.turnsLeft must be finite");
      if (!Number.isFinite(rec.radius)) throw new Error("PlasmaCloud.radius must be finite");
      if (!Number.isFinite(rec.damage)) throw new Error("PlasmaCloud.damage must be finite");
      if (!Number.isFinite(rec.sourceId)) rec.sourceId = 0;
      if (typeof rec.sourceKind !== "string") rec.sourceKind = "";

      rec.turnsLeft = Math.max(1, rec.turnsLeft | 0);
      rec.radius = Math.max(0, rec.radius | 0);
      rec.damage = Math.max(0, rec.damage | 0);
      rec.sourceId = rec.sourceId | 0;
      return true;
    },
  },
);
