import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Spatial presentation-audio emitters projected through WorldView.
 *
 * SoundEmitter feeds creature hearing/aggro rules. AudioEmitter is for audible
 * loops the player hears from concrete world sources.
 */
export const AudioEmitter = defineComponent("AudioEmitter", {
  emitters: [],
});
