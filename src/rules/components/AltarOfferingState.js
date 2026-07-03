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
    beatitudeState: "",
    value: 0,
    offeredAtTurn: -1,
    expiresAtTurn: -1,
  },
  {
    validate(rec) {
      rec.lastOfferedDay = Number.isFinite(rec.lastOfferedDay) ? (rec.lastOfferedDay | 0) : -1;
      rec.offeredItemKind = String(rec.offeredItemKind || "");
      rec.offeredItemName = String(rec.offeredItemName || "");
      rec.offeredItemIdentity = String(rec.offeredItemIdentity || "");
      rec.beatitudeState = String(rec.beatitudeState || "");
      rec.value = Number.isFinite(rec.value) ? Math.max(0, Math.min(1, Number(rec.value))) : 0;
      rec.offeredAtTurn = Number.isFinite(rec.offeredAtTurn) ? (rec.offeredAtTurn | 0) : -1;
      rec.expiresAtTurn = Number.isFinite(rec.expiresAtTurn) ? (rec.expiresAtTurn | 0) : -1;
      return true;
    },
  },
);
