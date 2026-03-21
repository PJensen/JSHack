import { defineComponent } from "../../lib/ecs-js/index.js";

export const CorpseAdaptation = defineComponent("CorpseAdaptation", {
  source: "",      // monster id (e.g. "cave_snake")
  label: "",       // display label (e.g. "poison")
  statKey: "",     // canonical stat key (e.g. "poisonResist")
});
