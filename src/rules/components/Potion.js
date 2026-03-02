import { defineComponent } from "../../lib/ecs-js/index.js";

// Potion — minimal schema used by drinkSystem
// route: oral|inhale|inject|topical|splash
// doses: remaining uses
// channels: immediate effects like direct damage/heal [{ type, amount }]
// effects: staged effects with timing [{ key, potency, onset, peak, duration, stack, maxStacks }]
// toxicity: optional { hangover: number }
// feel: sensory description shown in message log when drunk unidentified
export const Potion = defineComponent("Potion", {
  route: "oral",
  doses: 1,
  channels: [],
  effects: [],
  name: "Potion",
  toxicity: null,
  feel: "",
});
