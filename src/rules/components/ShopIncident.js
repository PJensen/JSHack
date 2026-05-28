import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * A shop-law memory fact attached under the shopkeeper that owns the claim.
 * ShopDebt records what the actor owes; ShopIncident records what the shop
 * knows about how the claim arose.
 */
export const ShopIncident = defineComponent(
  "ShopIncident",
  {
    shopkeeperId: 0,
    actorId: 0,
    itemId: 0,
    amount: 0,
    reason: "carried_out",
    evidence: "ledger",
    severity: 0,
    createdTurn: 0,
    resolved: false,
  },
  {
    validate(rec) {
      return (
        typeof rec.shopkeeperId === "number" &&
        rec.shopkeeperId > 0 &&
        typeof rec.actorId === "number" &&
        rec.actorId > 0 &&
        typeof rec.itemId === "number" &&
        typeof rec.amount === "number" &&
        rec.amount >= 0 &&
        typeof rec.reason === "string" &&
        rec.reason.length > 0 &&
        typeof rec.evidence === "string" &&
        rec.evidence.length > 0 &&
        typeof rec.severity === "number" &&
        rec.severity >= 0 &&
        typeof rec.createdTurn === "number" &&
        typeof rec.resolved === "boolean"
      );
    },
  },
);
