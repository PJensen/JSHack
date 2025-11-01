import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * CastSpellIntent — queued by input/AI to cast an equipped/active spell.
 * spellId: optional concrete spell id; if 0/undefined, consume actor's active spell.
 * targetId: entity id to target; if 0/undefined, defaults to self.
 */
export const CastSpellIntent = defineComponent("CastSpellIntent", {
  spellId: 0,
  targetId: 0,
});
