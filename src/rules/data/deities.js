// rules/data/deities.js
// Deity definitions. Pure data — no behavior, no display.

/** @type {Record<string, import('../../lib/deity-js/deity.js').DeityOpts>} */
export const DEITY_DEFS = {
  molkhar: {
    name: "Mol'Khar",
    alignment: 'chaotic',
    personality: {
      wrath: 0.25,
      hunger: 0.25,
      amusement: 0.20,
      serenity: 0.10,
      sorrow: 0.10,
      chaos: 0.10,
    },
    favorMap: {
      kill: 0.7,
      destroy: 0.5,
      steal: 0.3,
      betray: 0.2,
      heal: -0.4,
      protect: -0.3,
      create: -0.1,
    },
    moodOpts: { hysteresis: 0.25, attractorStrength: 0.04 },
    ledgerOpts: { decayHalfLife: 80 },
    thresholds: { wrath: 0.38, miracle: 0.55, demand: 0.32, omen: 0.28 },
    neglectThreshold: 50,
  },
};

/** @param {string} id */
export function getDeity(id) {
  return DEITY_DEFS[id] ?? null;
}
