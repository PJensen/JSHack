import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * ScriptState — persistent local state for content-DSL entities.
 * Holds an arbitrary key/value bag that scripts read and mutate.
 * Serializable for save/load (plain object, no functions).
 *
 * @property {object} data - free-form state bag, set from the `state` block in defineItem/defineMonster
 */
export const ScriptState = defineComponent(
  "ScriptState",
  {
    data: {},
  },
);
