// Spell.js
// ECS Component: Learned spell
import { defineComponent } from "../../lib/ecs-js/index.js";

export const ScriptRef = defineComponent('ScriptRef', {
  ref: null,   // string identifier into the script registry
  params: {}   // shallow params object
});
