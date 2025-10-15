import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * MeleeAttackIntent — queued by input/AI when attacker wants to strike target.
 * sourceId: attacker entity id
 * targetId: defender entity id
 */
export const MeleeAttackIntent = defineComponent(
  "MeleeAttackIntent",
  { sourceId: 0, targetId: 0 },
  {
    validate() {
      if (!Number.isInteger(this.sourceId) || this.sourceId <= 0) throw new Error("MeleeAttackIntent.sourceId");
      if (!Number.isInteger(this.targetId) || this.targetId <= 0) throw new Error("MeleeAttackIntent.targetId");
      return true;
    },
  }
);
