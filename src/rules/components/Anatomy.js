import { defineComponent } from "../../lib/ecs-js/index.js";

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
  { parts: [] },
  {
    validate(rec) {
      if (!Array.isArray(rec.parts))
        throw new Error("Anatomy.parts must be an array");
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
export function pickHitPart(anatomy, rng = Math.random) {
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

/** FULL — your original per-digit builder can stay, gated behind a flag when you truly need it. */
export { buildHumanoidAnatomy as buildHumanoidAnatomyFull };
