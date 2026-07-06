import { defineComponent } from "../../lib/ecs-js/index.js";

export const Hamingja = defineComponent("Hamingja", {
  lineageId: "",
  luck: 0,
  inherited: true,
  transferable: false,
  sourceRunId: "",
}, {
  validate(rec) {
    rec.lineageId = String(rec.lineageId || "");
    rec.luck = Number.isFinite(rec.luck) ? Number(rec.luck) : 0;
    rec.inherited = rec.inherited !== false;
    rec.transferable = rec.transferable === true;
    rec.sourceRunId = String(rec.sourceRunId || "");
    return true;
  },
});
