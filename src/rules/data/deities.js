// rules/data/deities.js
// Deity definitions. Pure data — no behavior, no display.

/**
 * @typedef {Object} TagKillReaction
 * Fired on 'died' when the victim's identity has the given monster tag.
 * @property {string}  tag           monster tag matched via monsterHasTag()
 * @property {'action'|'offer'} type
 * @property {string}  verb          deity.action verb (type='action') OR offer type (type='offer')
 * @property {number}  [magnitude]   magnitude for action
 * @property {string}  [target]      target label for action
 * @property {number}  [value]       value for offer
 * @property {string}  [alignment]   alignment for offer
 */

/**
 * @typedef {Object} SpellSchoolReaction
 * Fired on 'castSpell' when the cast spell belongs to the given school.
 * @property {string}  school        must appear in spell.schools[]
 * @property {string}  [spellId]     optional — narrows to one specific spell
 * @property {'action'|'offer'} type
 * @property {string}  verb
 * @property {number}  [magnitude]
 * @property {string}  [target]
 * @property {number}  [value]
 * @property {string}  [alignment]
 */

/**
 * @typedef {Object} KillStreakConfig
 * Consecutive kills within `window` turns escalate the deity reaction.
 * @property {number} window         turns within which kills chain
 * @property {number} minStreak      minimum streak before bonus fires
 * @property {number} bonusPerKill   magnitude added per streak kill
 * @property {number} maxBonus       magnitude cap
 * @property {string} killAction     deity.action verb for the streak bonus
 * @property {string} offerType      deity.offer type for the frenzy offering
 * @property {number} offerFactor    offer value = bonus * offerFactor
 * @property {string} offerAlignment
 */

/**
 * @typedef {Object} DeityDef
 * Full deity definition including deity-js opts and niche interaction specs.
 * @property {TagKillReaction[]}    [tagKillReactions]
 * @property {SpellSchoolReaction[]} [spellSchoolReactions]
 * @property {Record<string,{type:'action'|'offer',verb:string,magnitude?:number,target?:string,value?:number,alignment?:string,message?:string}>} [specialHooks]
 *   Keys: 'trap:triggered:enemy', 'trap:triggered:self', 'altar:offer:cursed', 'cooking:cooked:bonus'
 *         'ascetic:milestone', 'ascetic:lapse'
 *   Use '{deity}' in message as a placeholder for deity.name.
 * @property {KillStreakConfig}     [killStreakConfig]
 */

/** @type {Record<string, import('../../lib/deity-js/deity.js').DeityOpts & DeityDef>} */
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
    tagKillReactions: [
      // Rival planar entities: their blood is a special offering
      { tag: 'demon', type: 'offer', verb: 'rival_blood', value: 0.4, alignment: 'chaotic', target: 'rival_blood' },
    ],
    spellSchoolReactions: [
      // Destructive magic is a form of combat offering
      { school: 'destruction', type: 'offer', verb: 'arcane_violence', value: 0.15, alignment: 'chaotic', target: 'arcane_violence' },
    ],
    killStreakConfig: {
      window: 8, minStreak: 2, bonusPerKill: 0.1, maxBonus: 0.5,
      killAction: 'kill', offerType: 'frenzy', offerFactor: 0.5, offerAlignment: 'chaotic',
    },
    specialHooks: {
      'ascetic:milestone': {
        type: 'action',
        verb: 'betray',
        magnitude: 0.14,
        target: 'austerity',
        message: '{deity} sneers at your self-denial.',
      },
      'ascetic:lapse': {
        type: 'offer',
        verb: 'indulgence',
        value: 0.12,
        alignment: 'chaotic',
        message: '{deity} approves your savage appetite.',
      },
    },
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
    tagKillReactions: [
      // Undead purge offsets the kill penalty — slaying the unnatural is holy purification
      { tag: 'undead', type: 'action', verb: 'protect', magnitude: 0.5, target: 'undead_purge' },
    ],
    spellSchoolReactions: [
      // Phase strike is violent trickery — Seraphine disapproves
      { school: 'trickery', spellId: 'phase_strike', type: 'action', verb: 'betray', magnitude: 0.1, target: 'violent_trickery' },
    ],
    specialHooks: {
      'ascetic:milestone': {
        type: 'offer',
        verb: 'discipline',
        value: 0.2,
        alignment: 'lawful',
        message: '{deity} honors your disciplined restraint.',
      },
      'ascetic:lapse': {
        type: 'action',
        verb: 'betray',
        magnitude: 0.08,
        target: 'gluttony',
        message: '{deity} frowns at your indulgence.',
      },
    },
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
    spellSchoolReactions: [
      // Spatial trickery pleases the trickster
      { school: 'trickery', type: 'action', verb: 'steal', magnitude: 0.3, target: 'spell_trickery' },
      // Phase strike is trickery AND violence — doubly delightful
      { school: 'trickery', spellId: 'phase_strike', type: 'action', verb: 'betray', magnitude: 0.15, target: 'spell_violence_trick' },
    ],
    specialHooks: {
      // Enemies triggering traps amuses the trickster (intentional or not)
      'trap:triggered:enemy': { type: 'action', verb: 'steal', magnitude: 0.25, target: 'trap_prank' },
      // Self-harm also amuses Loki — "you walked right into that one"
      'trap:triggered:self':  { type: 'action', verb: 'betray', magnitude: 0.15, target: 'self_prank' },
      // Loki loves the audacity of offering corrupted items
      'altar:offer:cursed':   { type: 'action', verb: 'steal', magnitude: 0.35, target: 'cursed_offering',
                                message: '{deity} cackles at your brazen offering!' },
      // Strict austerity is boring to a trickster.
      'ascetic:milestone': {
        type: 'action',
        verb: 'betray',
        magnitude: 0.09,
        target: 'austerity',
        message: '{deity} yawns at your monkish restraint.',
      },
      // A lapse is more entertaining than discipline.
      'ascetic:lapse': {
        type: 'action',
        verb: 'steal',
        magnitude: 0.12,
        target: 'indulgent_prank',
        message: '{deity} laughs at your delicious lack of restraint.',
      },
    },
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
    tagKillReactions: [
      // Aberrations against nature: undead are unnatural, slaying them is righteous
      { tag: 'undead', type: 'action', verb: 'protect', magnitude: 0.3, target: 'unnatural_purge' },
      // Killing nature's own children stings beyond the normal kill penalty
      { tag: 'beast',  type: 'action', verb: 'destroy', magnitude: 0.3, target: 'natures_child' },
    ],
    specialHooks: {
      // Cooking corpses closes the cycle — transformation rather than raw consumption
      'cooking:cooked:bonus': { type: 'action', verb: 'protect', magnitude: 0.2, target: 'cycle_of_life' },
      'ascetic:milestone': {
        type: 'action',
        verb: 'protect',
        magnitude: 0.2,
        target: 'inner_balance',
        message: '{deity} approves your balanced restraint.',
      },
      'ascetic:lapse': {
        type: 'action',
        verb: 'destroy',
        magnitude: 0.06,
        target: 'imbalance',
        message: '{deity} sighs as balance slips from your grasp.',
      },
    },
  },
};

/** @param {string} id */
export function getDeity(id) {
  return DEITY_DEFS[id] ?? null;
}
