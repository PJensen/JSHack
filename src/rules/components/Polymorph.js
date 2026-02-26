import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Polymorph marker for entities that can reveal a different form.
 * The base form (e.g. chest) remains until a polymorph trigger fires.
 */
export const Polymorph = defineComponent(
  "Polymorph",
  {
    targetIdentity: "",
    trigger: "touch",
    once: true,
    revealed: false,
    hookKey: "",
    depth: 1,
  },
  {
    validate(rec) {
      if (!rec || typeof rec !== "object") return false;
      if (typeof rec.targetIdentity !== "string" || !rec.targetIdentity.trim()) return false;
      if (typeof rec.trigger !== "string" || !rec.trigger.trim()) return false;
      if (typeof rec.once !== "boolean") return false;
      if (typeof rec.revealed !== "boolean") return false;
      if (typeof rec.hookKey !== "string") return false;
      if (!Number.isFinite(rec.depth)) return false;
      rec.depth = Math.max(1, rec.depth | 0);
      return true;
    },
  }
);

