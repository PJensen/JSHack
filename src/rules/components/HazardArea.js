import { defineComponent } from "../../lib/ecs-js/index.js";

function normalizeMedium(value) {
  const medium = String(value || "").toLowerCase();
  if (medium === "floor") return "floor";
  return "air";
}

export const HazardArea = defineComponent(
  "HazardArea",
  {
    kind: "generic",
    medium: "air", // metadata only for now
    turnsLeft: 3,
    radius: 1,
    tickDamage: 0,
    damageType: "generic",
    cause: "hazard",
    sourceId: 0,
    sourceKind: "",
    meta: null,
  },
  {
    validate(rec) {
      if (!rec) throw new Error("HazardArea record required");
      rec.kind = String(rec.kind || "generic").toLowerCase() || "generic";
      rec.medium = normalizeMedium(rec.medium);
      rec.turnsLeft = Number.isFinite(rec.turnsLeft) ? Math.max(1, rec.turnsLeft | 0) : 3;
      rec.radius = Number.isFinite(rec.radius) ? Math.max(0, rec.radius | 0) : 1;
      rec.tickDamage = Number.isFinite(rec.tickDamage) ? Math.max(0, rec.tickDamage | 0) : 0;
      rec.damageType = String(rec.damageType || "generic").toLowerCase() || "generic";
      rec.cause = String(rec.cause || rec.kind || "hazard");
      rec.sourceId = Number.isFinite(rec.sourceId) ? (rec.sourceId | 0) : 0;
      rec.sourceKind = typeof rec.sourceKind === "string" ? rec.sourceKind : "";
      if (rec.meta != null && (typeof rec.meta !== "object" || Array.isArray(rec.meta))) rec.meta = null;
      return true;
    },
  },
);
