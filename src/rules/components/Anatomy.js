import { defineComponent } from "../../lib/ecs-js/index.js";

export const HEARING_TIERS = Object.freeze({
  deaf: "deaf",
  near: "near",
  mid: "mid",
  far: "far",
  super: "super",
});

// Hearing-loss thresholds in dB HL; lower threshold means better hearing.
export const HEARING_HL_RANGES = Object.freeze({
  super: Object.freeze({ min: 0, max: 20 }),
  far: Object.freeze({ min: 25, max: 40 }),
  mid: Object.freeze({ min: 45, max: 60 }),
  near: Object.freeze({ min: 65, max: 85 }),
  deaf: Object.freeze({ min: 90, max: Infinity }),
});

// Representative dB HL threshold by hearing tier (used for quick calculations).
export const HEARING_HL_THRESHOLD = Object.freeze({
  super: 20,
  far: 30,
  mid: 50,
  near: 70,
  deaf: 95,
});

export const HEARING_SOURCE_DB = Object.freeze({
  footsteps: 30,
  conversation: 60,
  shout: 80,
  explosion: 110,
});

function isValidHearingTier(value) {
  return value === HEARING_TIERS.deaf
    || value === HEARING_TIERS.near
    || value === HEARING_TIERS.mid
    || value === HEARING_TIERS.far
    || value === HEARING_TIERS.super;
}

/**
 * Anatomy — minimal, fast, snapshot-friendly.
 * parts[]. Required fields:
 *   - id: string (stable key)
 *   - vol: number (>0, will be normalized)
 * Optional:
 *   - vital?: boolean
 *   - tags?: string[]
 *
 * Notes:
 * - Keep Anatomy lean. Move *dynamic* state (bleeding, wounds) to other components.
 * - Choose a builder (UltraLite/Lite/Full) per archetype; same component, different density.
 */
export const Anatomy = defineComponent(
  "Anatomy",
  { parts: [], hearing: HEARING_TIERS.super },
  {
    validate(rec) {
      if (!Array.isArray(rec.parts))
        throw new Error("Anatomy.parts must be an array");
      if (!isValidHearingTier(rec.hearing))
        throw new Error(`Anatomy.hearing must be one of: ${Object.keys(HEARING_TIERS).join(", ")}`);
      return true;
    },
  }
);

/* ---------------------------------------
   Helpers
----------------------------------------*/
function normalizeVolumes(parts) {
  const sum = parts.reduce((s, p) => s + p.vol, 0);
  if (sum <= 0) return parts;
  for (const p of parts) p.vol = p.vol / sum;
  return parts;
}

/**
 * Weighted hit resolver (deterministic if you pass a deterministic RNG).
 * rng(): returns [0,1).
 */
export function pickHitPart(anatomy, rng) {
  const r = rng();
  let acc = 0;
  for (const p of anatomy.parts) {
    acc += p.vol;
    if (r < acc) return p.id;
  }
  // numerical edge
  return anatomy.parts[anatomy.parts.length - 1]?.id ?? null;
}

/* ---------------------------------------
   Builders (choose per archetype)
----------------------------------------*/

/** ULTRALITE — coarse target map (~10 parts). Great default. */
export function buildHumanoidAnatomyUltraLite() {
  const V = {
    head: 0.10,
    torso: 0.50,
    arm: 0.10,
    hand: 0.03,
    leg: 0.20,
    foot: 0.07,
  };

  const parts = [
    { id: "torso", vol: V.torso, vital: true, tags: ["core"] },
    { id: "head",  vol: V.head,  vital: true, tags: ["vision","brain"] },

    { id: "armL",  vol: V.arm,  tags: ["manipulation"] },
    { id: "handL", vol: V.hand, tags: ["grasp","fine"] },
    { id: "armR",  vol: V.arm,  tags: ["manipulation"] },
    { id: "handR", vol: V.hand, tags: ["grasp","fine"] },

    { id: "legL",  vol: V.leg,  tags: ["locomotion"] },
    { id: "footL", vol: V.foot, tags: ["stance","balance"] },
    { id: "legR",  vol: V.leg,  tags: ["locomotion"] },
    { id: "footR", vol: V.foot, tags: ["stance","balance"] },
  ];

  return normalizeVolumes(parts);
}

/** LITE — keeps digits aggregated (no per-finger parts). */
export function buildHumanoidAnatomyLite({
  fingersPerHand = 5,
  toesPerFoot = 5,
  hasNeck = true,
} = {}) {
  const V = {
    head: 0.08,
    neck: 0.02,
    torso: 0.48,
    upperArm: 0.07,
    foreArm: 0.05,
    palm: 0.015,
    fingerUnit: 0.002, // per finger
    thigh: 0.12,
    shin: 0.09,
    foot: 0.02,
    toeUnit: 0.001,    // per toe
  };

  const parts = [
    { id: "torso", vol: V.torso, vital: true, tags: ["core"] },
    { id: "head",  vol: V.head,  vital: true, tags: ["vision","brain"] },
  ];

  if (hasNeck) parts.push({ id: "neck", vol: V.neck, vital: true, tags: ["airway"] });

  for (const side of ["L","R"]) {
    parts.push({ id: `upperArm${side}`, vol: V.upperArm, tags: ["manipulation"] });
    parts.push({ id: `foreArm${side}`,  vol: V.foreArm,  tags: ["manipulation"] });
    parts.push({ id: `palm${side}`,     vol: V.palm,     tags: ["grasp"] });

    // aggregate digits per hand
    const fingersVol = V.fingerUnit * fingersPerHand;
    parts.push({ id: `digitsHand${side}`, vol: fingersVol, tags: ["digit","fine","grasp"] });
  }

  for (const side of ["L","R"]) {
    parts.push({ id: `thigh${side}`, vol: V.thigh, tags: ["locomotion"] });
    parts.push({ id: `shin${side}`,  vol: V.shin,  tags: ["locomotion"] });
    parts.push({ id: `foot${side}`,  vol: V.foot,  tags: ["locomotion","stance"] });

    // aggregate toes per foot
    const toesVol = V.toeUnit * toesPerFoot;
    parts.push({ id: `digitsFoot${side}`, vol: toesVol, tags: ["digit","balance"] });
  }

  return normalizeVolumes(parts);
}

/**
 * FULL — placeholder for a more granular builder.
 * For now, alias to Lite to avoid breaking imports.
 */
export { buildHumanoidAnatomyLite as buildHumanoidAnatomyFull };

// Back-compat: provide a default builder expected by components/index.js
export function buildHumanoidAnatomy(opts = {}) {
  // Default to UltraLite for performance; switch to Lite based on opts if needed later
  return buildHumanoidAnatomyUltraLite();
}
