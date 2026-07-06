import { defineComponent } from "../../lib/ecs-js/index.js";

export const LANDVAETTIR_DISPOSITIONS = Object.freeze({
  dormant: "dormant",
  watchful: "watchful",
  appeased: "appeased",
  offended: "offended",
});

export const Landvaettir = defineComponent("Landvaettir", {
  siteId: "",
  originX: 0,
  originY: 0,
  radius: 6,
  disposition: LANDVAETTIR_DISPOSITIONS.dormant,
  visible: false,
  memory: "",
}, {
  validate(rec) {
    rec.siteId = String(rec.siteId || "");
    rec.originX = Number.isFinite(rec.originX) ? (rec.originX | 0) : 0;
    rec.originY = Number.isFinite(rec.originY) ? (rec.originY | 0) : 0;
    rec.radius = Math.max(0, Number(rec.radius || 0) | 0);
    rec.disposition = String(rec.disposition || LANDVAETTIR_DISPOSITIONS.dormant);
    rec.visible = rec.visible === true;
    rec.memory = String(rec.memory || "");
    return true;
  },
});
