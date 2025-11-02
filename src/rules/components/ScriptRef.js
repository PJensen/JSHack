// Spell.js
// ECS Component: Learned spell
import { defineComponent } from "../../lib/ecs-js/index.js";

export const ScriptRef = defineComponent('ScriptRef', {
  ref: null,   // string identifier or function name
  params: {}   // shallow params object
});
