import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Spatial presentation-light emitters projected through WorldView.
 *
 * Simulation state remains on gameplay components such as ObjectState, Trap,
 * Material, and status components. LightEmitter is authored presentation data
 * for concrete world sources, mirroring AudioEmitter.
 */
export const LightEmitter = defineComponent("LightEmitter", {
  radius: 0,
  color: [255, 255, 255],
  pattern: "steady",
  softness: 6,
  voidStrength: null,
  whenState: "",
});
