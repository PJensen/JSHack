// ScriptRef.js
// ECS Component: References a script or handler by name/id with optional params
import { defineComponent } from '../../lib/ecs/core.js';

export const ScriptRef = defineComponent('ScriptRef', {
  ref: null,   // string identifier or function name
  params: {}   // shallow params object
});
