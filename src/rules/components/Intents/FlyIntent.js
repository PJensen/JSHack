import { defineComponent } from "../../../lib/ecs-js/index.js";

/**
 * FlyIntent — actor spends its turn taking off or landing.
 * airborne=true => takeoff, airborne=false => land.
 */
export const FlyIntent = defineComponent("FlyIntent", {
  airborne: false,
});
