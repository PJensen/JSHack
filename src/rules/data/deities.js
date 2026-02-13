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
    killsAreOfferings: true, // blood of enemies feeds the war god
  },

  seraphine: {
    name: "Seraphine",
    alignment: 'lawful',
    personality: {
      serenity: 0.35,
      sorrow: 0.20,
      wrath: 0.15,
      hunger: 0.15,
      amusement: 0.10,
      chaos: 0.05,
    },
    favorMap: {
      heal: 0.8,
      protect: 0.7,
      create: 0.4,
      kill: -0.3,
      steal: -0.5,
      betray: -0.9,  // lawful god despises betrayal
      destroy: -0.4,
    },
    moodOpts: { hysteresis: 0.4, attractorStrength: 0.06 },  // sticky moods, strong personality pull
    ledgerOpts: { decayHalfLife: 120 },  // remembers longer
    thresholds: { wrath: 0.45, miracle: 0.4, demand: 0.38, omen: 0.35 },
    neglectThreshold: 100,  // patient with neglect
  },

  loki: {
    name: "Loki",
    alignment: 'chaotic',
    personality: {
      amusement: 0.30,
      chaos: 0.25,
      serenity: 0.15,
      hunger: 0.15,
      wrath: 0.10,
      sorrow: 0.05,
    },
    favorMap: {
      steal: 0.8,
      betray: 0.6,  // trickster loves betrayal
      destroy: 0.3,
      kill: 0.1,
      heal: 0.2,  // mildly amused by kindness
      protect: -0.1,
      create: 0.0,
    },
    moodOpts: { hysteresis: 0.15, attractorStrength: 0.03 },  // volatile, weak personality pull
    ledgerOpts: { decayHalfLife: 60 },  // short memory
    thresholds: { wrath: 0.5, miracle: 0.6, demand: 0.25, omen: 0.2 },
    neglectThreshold: 30,  // gets bored quickly
  },

  gaia: {
    name: "Gaia the Eternal",
    alignment: 'neutral',
    personality: {
      serenity: 0.25,
      sorrow: 0.20,
      wrath: 0.20,
      hunger: 0.15,
      amusement: 0.10,
      chaos: 0.10,
    },
    favorMap: {
      create: 0.7,
      protect: 0.5,
      heal: 0.4,
      destroy: -0.6,
      betray: -0.4,
      kill: -0.2,  // nature god dislikes unnecessary death
      steal: 0.0,
    },
    moodOpts: { hysteresis: 0.35, attractorStrength: 0.05 },
    ledgerOpts: { decayHalfLife: 150 },  // ancient memory
    thresholds: { wrath: 0.4, miracle: 0.45, demand: 0.35, omen: 0.3 },
    neglectThreshold: 80,
  },
};

/** @param {string} id */
export function getDeity(id) {
  return DEITY_DEFS[id] ?? null;
}
