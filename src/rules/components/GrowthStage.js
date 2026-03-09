import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * GrowthStage — tracks visual growth progression for plants and crops.
 *
 * For crops with HarvestNode: growth stage is derived from regrow countdown
 * (growInterval = 0). For standalone plants (flowers): growInterval > 0 drives
 * a simple turn-counter that advances one stage per interval.
 *
 * Fields:
 *   currentStage     — current visual stage index (0 = seedling)
 *   maxStage         — final stage index (mature / ready)
 *   stageIdentities  — array of identity strings, one per stage (drives palette glyph)
 *   growInterval     — turns between stages for standalone growth (0 = use HarvestNode)
 *   growCountdown    — countdown to next stage (standalone mode)
 */
export const GrowthStage = defineComponent("GrowthStage", {
  currentStage: 0,
  maxStage: 2,
  stageIdentities: null,
  growInterval: 0,
  growCountdown: 0,
}, {
  validate(rec) {
    if (!Number.isInteger(rec.currentStage) || rec.currentStage < 0) {
      throw new Error("GrowthStage.currentStage must be >= 0");
    }
    if (!Number.isInteger(rec.maxStage) || rec.maxStage < 1) {
      throw new Error("GrowthStage.maxStage must be >= 1");
    }
    if (!Array.isArray(rec.stageIdentities) || rec.stageIdentities.length !== rec.maxStage + 1) {
      throw new Error("GrowthStage.stageIdentities must be an array of length maxStage + 1");
    }
    if (!Number.isInteger(rec.growInterval) || rec.growInterval < 0) {
      throw new Error("GrowthStage.growInterval must be >= 0");
    }
    if (!Number.isInteger(rec.growCountdown) || rec.growCountdown < 0) {
      throw new Error("GrowthStage.growCountdown must be >= 0");
    }
    return true;
  },
});
