import { defineComponent } from "../../lib/ecs-js/index.js";
// --- Minimal physiology dial the resolver can read ---
export const Physiology = defineComponent("Physiology", {
  sizeClass: "M",          // XS, S, M, L, XL (affects knockback thresholds etc.)
  massKg: 80,              // rough; use for impulse/kinetics if you want
  kineticTriageDiv: 300,   // residualJ / this ⇒ 0..1 severity
  painMult: 1.0,           // perceived pain scaling
  bleedBaseMl: 5000        // total blood volume (ml) if you simulate hemorrhage
});
