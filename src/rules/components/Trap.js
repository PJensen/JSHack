import { defineComponent } from "../../lib/ecs-js/index.js";

export const Trap = defineComponent(
  "Trap",
  {
    type: "",         // e.g., "spike"
    revealed: false,  // not shown until triggered
    armed: true,      // triggers once when armed
    script: "",       // script key to execute on trigger
    params: null,     // optional script params
    difficulty: 10,   // DC for disarm check (1d20 >= difficulty = success)
  },
  {
    validate(rec) {
      if (!rec) throw new Error("Trap record required");
      if (typeof rec.type !== "string") throw new Error("Trap.type must be a string");
      if (typeof rec.revealed !== "boolean") throw new Error("Trap.revealed must be boolean");
      if (typeof rec.armed !== "boolean") throw new Error("Trap.armed must be boolean");
      if (rec.script != null && typeof rec.script !== 'string') throw new Error('Trap.script must be string');
      if (rec.params != null && typeof rec.params !== 'object') throw new Error('Trap.params must be object');
      return true;
    },
  }
);
