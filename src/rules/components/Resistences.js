import { defineComponent } from "../../lib/ecs-js/index.js";
/**
 * Resistances — tissue/armor response per channel.
 * Use multipliers and thresholds; keep it numeric, fast, and portable.
 */
export const Resistances = defineComponent(
  "Resistances",
  {
    kinetic: { DR: 0, bluntMult: 1.0, slashMult: 1.0, pierceMult: 1.0 }, // DR ~ flat J shaved off; mode multipliers
    thermal: { igniteC: Infinity, burnMult: 1.0 }, // ignition & burn scaling
    chemical: { acidMult: 1.0, baseMult: 1.0, solventMult: 1.0, toxMult: 1.0 },
    electric: { ohms: Infinity, fibrillationA: 0.03 }, // crude body resistance & hazard threshold
    radiation: { alpha: 1.0, beta: 1.0, gamma: 1.0, neutron: 1.0 }, // lower = better shielding
  },
  {
    validate() {
      return true;
    },
  }
);
