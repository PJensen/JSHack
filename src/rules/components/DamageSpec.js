import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DamageSpec — multi-channel “what the hit delivers”.
 * channels: array of discriminated records.
 * Each entry has { kind, dose, unit } plus kind-specific fields.
 *
 * Examples:
 *  { kind:'kinetic', dose:450, unit:'J', mode:'pierce', areaCM2:0.1, penetrationMM:18 }
 *  { kind:'thermal', dose:800, unit:'C', durationMs:400 }
 *  { kind:'chemical', dose:3, unit:'pHΔ', agent:'acid', durationMs:2000 }
 *  { kind:'electric', dose:220, unit:'V', durationMs:60 }
 *  { kind:'bio', dose:0.4, unit:'mg/kg', toxinId:'neurotoxin-X' }
 *  { kind:'radiation', dose:75, unit:'mSv', radType:'gamma' }
 */
export const DamageSpec = defineComponent(
  "DamageSpec",
  {
    channels: [],
  },
  {
    validate(rec) {
      if (!Array.isArray(rec.channels))
        throw new Error("DamageSpec.channels[]");
      for (const c of rec.channels) {
        if (!c || typeof c !== "object")
          throw new Error("DamageSpec.channel object");
        if (
          ![
            "kinetic",
            "thermal",
            "chemical",
            "electric",
            "bio",
            "radiation",
          ].includes(c.kind)
        )
          throw new Error("DamageSpec.kind invalid");
        if (!Number.isFinite(c.dose) || c.dose < 0)
          throw new Error("DamageSpec.dose >=0");
        if (typeof c.unit !== "string" || !c.unit)
          throw new Error("DamageSpec.unit");
        // light kind-specific sanity:
        if (c.kind === "kinetic") {
          if (c.mode && !["blunt", "slash", "pierce"].includes(c.mode))
            throw new Error("kinetic.mode");
          if (
            c.penetrationMM != null &&
            (!Number.isFinite(c.penetrationMM) || c.penetrationMM < 0)
          )
            throw new Error("kinetic.penetrationMM >=0");
        }
        if (c.kind === "thermal") {
          if (
            c.durationMs != null &&
            (!Number.isFinite(c.durationMs) || c.durationMs < 0)
          )
            throw new Error("thermal.durationMs >=0");
        }
        if (c.kind === "chemical") {
          if (
            c.agent &&
            !["acid", "base", "solvent", "oxidizer", "toxin"].includes(c.agent)
          )
            throw new Error("chemical.agent");
        }
        if (c.kind === "electric") {
          if (
            c.durationMs != null &&
            (!Number.isFinite(c.durationMs) || c.durationMs < 0)
          )
            throw new Error("electric.durationMs >=0");
        }
        if (c.kind === "bio") {
          if (c.toxinId && typeof c.toxinId !== "string")
            throw new Error("bio.toxinId string");
        }
        if (c.kind === "radiation") {
          if (
            c.radType &&
            !["alpha", "beta", "gamma", "neutron"].includes(c.radType)
          )
            throw new Error("radiation.radType");
        }
      }
      return true;
    },
  }
);
