import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * Explicit adjacent melee attack request.
 * Direction is cardinal only; target selection is resolved by rules.
 */
export const AttackDirectionIntent = defineComponent("AttackDirectionIntent", {
  dx: 0,
  dy: 0,
  confirmed: false,
}, {
  validate(rec) {
    return (
      Number.isInteger(rec.dx) &&
      Number.isInteger(rec.dy) &&
      Math.abs(rec.dx) + Math.abs(rec.dy) === 1 &&
      typeof rec.confirmed === "boolean"
    );
  },
});
