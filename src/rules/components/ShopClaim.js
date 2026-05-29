import { defineComponent } from "../../lib/ecs-js/index.js";

export const SHOP_CLAIM_STATUS = Object.freeze({
  open: "open",
  resolved: "resolved",
  dismissed: "dismissed",
});

export const SHOP_CLAIM_CONFIDENCE = Object.freeze({
  known: "known",
  probable: "probable",
  suspicious: "suspicious",
});

/**
 * Neutral shop-accounting fact attached under the shopkeeper that owns it.
 * Debt and incident records are projections of a claim, not the claim itself.
 */
export const ShopClaim = defineComponent(
  "ShopClaim",
  {
    shopkeeperId: 0,
    actorId: 0,
    itemId: 0,
    amount: 0,
    claimKind: "unauthorized_use",
    valueKind: "unknown",
    evidence: "ledger",
    confidence: SHOP_CLAIM_CONFIDENCE.known,
    severity: 0,
    debtId: 0,
    incidentId: 0,
    createdTurn: 0,
    status: SHOP_CLAIM_STATUS.open,
  },
  {
    validate(rec) {
      const confidence = String(rec.confidence || SHOP_CLAIM_CONFIDENCE.known);
      const status = String(rec.status || SHOP_CLAIM_STATUS.open);
      return (
        typeof rec.shopkeeperId === "number" &&
        rec.shopkeeperId > 0 &&
        typeof rec.actorId === "number" &&
        rec.actorId > 0 &&
        typeof rec.itemId === "number" &&
        typeof rec.amount === "number" &&
        rec.amount >= 0 &&
        typeof rec.claimKind === "string" &&
        rec.claimKind.length > 0 &&
        typeof rec.valueKind === "string" &&
        rec.valueKind.length > 0 &&
        typeof rec.evidence === "string" &&
        rec.evidence.length > 0 &&
        Object.hasOwn(SHOP_CLAIM_CONFIDENCE, confidence) &&
        typeof rec.severity === "number" &&
        rec.severity >= 0 &&
        typeof rec.debtId === "number" &&
        typeof rec.incidentId === "number" &&
        typeof rec.createdTurn === "number" &&
        Object.hasOwn(SHOP_CLAIM_STATUS, status)
      );
    },
  },
);
