import { defineComponent } from "../../lib/ecs-js/index.js";

export const DISPOSITION_BANDS = Object.freeze({
  trusted: "trusted",
  neutral: "neutral",
  wary: "wary",
  angry: "angry",
  furious: "furious",
  wrathful: "wrathful",
});

/**
 * Disposition is one entity's durable opinion of another entity.
 *
 * subjectId: the entity holding the opinion.
 * objectId: the entity being judged.
 * score: -100..100, where negative means resentment/hostility.
 * maxSeverity: worst offense severity ever applied to this relationship.
 */
export const Disposition = defineComponent(
  "Disposition",
  {
    subjectId: 0,
    objectId: 0,
    score: 0,
    maxSeverity: 0,
    lastOffenseTurn: 0,
    lastOffenseKind: "none",
  },
  {
    validate(rec) {
      return (
        typeof rec.subjectId === "number" &&
        rec.subjectId > 0 &&
        typeof rec.objectId === "number" &&
        rec.objectId > 0 &&
        typeof rec.score === "number" &&
        rec.score >= -100 &&
        rec.score <= 100 &&
        typeof rec.maxSeverity === "number" &&
        rec.maxSeverity >= 0 &&
        typeof rec.lastOffenseTurn === "number" &&
        typeof rec.lastOffenseKind === "string" &&
        rec.lastOffenseKind.length > 0
      );
    },
  },
);
