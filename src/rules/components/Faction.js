import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Faction — identifies the faction affiliation of an entity.
 * key: string (stable key, e.g. "neutral", "player", "enemy")
 */
export const Faction = defineComponent("Faction", { key: "neutral" }, {
  validate(rec){
    if (typeof rec.key !== "string" || rec.key.length === 0) {
      throw new Error("Faction.key");
    }
    return true;
  }
});