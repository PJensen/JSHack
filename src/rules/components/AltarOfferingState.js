import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Durable state owned by an altar-like entity after offerings.
 * The offered item visual is projected by WorldView; the original item entity
 * is still consumed by the offering pipeline.
 */
export const AltarOfferingState = defineComponent(
  "AltarOfferingState",
  {
    lastOfferedDay: -1,
    offeredItemKind: "",
    offeredItemName: "",
    offeredItemIdentity: "",
    offeredAtTurn: -1,
  },
  {
    validate(rec) {
      rec.lastOfferedDay = Number.isFinite(rec.lastOfferedDay) ? (rec.lastOfferedDay | 0) : -1;
      rec.offeredItemKind = String(rec.offeredItemKind || "");
      rec.offeredItemName = String(rec.offeredItemName || "");
      rec.offeredItemIdentity = String(rec.offeredItemIdentity || "");
      rec.offeredAtTurn = Number.isFinite(rec.offeredAtTurn) ? (rec.offeredAtTurn | 0) : -1;
      return true;
    },
  },
);
