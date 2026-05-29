import { defineComponent } from "../../lib/ecs-js/index.js";

export const REPUTATION_BANDS = Object.freeze({
  honored: "honored",
  neutral: "neutral",
  suspect: "suspect",
  notorious: "notorious",
  wanted: "wanted",
  infamous: "infamous",
});

/**
 * Reputation is a scoped public belief about an entity.
 *
 * objectId: the entity being judged.
 * scopeKind/scopeKey: the group holding the public belief, e.g.
 *   "town:overworld" or "faction:shopkeeper".
 * score: -100..100, where negative means bad public standing.
 */
export const Reputation = defineComponent(
  "Reputation",
  {
    objectId: 0,
    scopeKind: "town",
    scopeKey: "overworld",
    score: 0,
    maxSeverity: 0,
    lastOffenseTurn: 0,
    lastOffenseKind: "none",
    witnessCount: 0,
  },
  {
    validate(rec) {
      return (
        typeof rec.objectId === "number" &&
        rec.objectId > 0 &&
        typeof rec.scopeKind === "string" &&
        rec.scopeKind.length > 0 &&
        typeof rec.scopeKey === "string" &&
        rec.scopeKey.length > 0 &&
        typeof rec.score === "number" &&
        rec.score >= -100 &&
        rec.score <= 100 &&
        typeof rec.maxSeverity === "number" &&
        rec.maxSeverity >= 0 &&
        typeof rec.lastOffenseTurn === "number" &&
        typeof rec.lastOffenseKind === "string" &&
        rec.lastOffenseKind.length > 0 &&
        typeof rec.witnessCount === "number" &&
        rec.witnessCount >= 0
      );
    },
  },
);
