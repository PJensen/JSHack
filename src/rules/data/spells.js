// rules/data/spells.js
// Pure rules-side spell definitions. No visuals here.
/**
 * @typedef {Object} SpellEffectDef
 * @property {'damage'|'status'|'movement'|'utility'} kind
 * @property {string} [element]
 * @property {string} [amount]
 * @property {string} [status]
 * @property {string} [duration]
 * @property {string} [mode]
 * @property {string} [note]
 */

/**
 * @typedef {Object} SpellDef
 * @property {string} id
 * @property {string} name
 * @property {string} [symbol]  // unicode glyph for UI display
 * @property {number} manaCost
 * @property {number} [minIntelligence]
 * @property {number} [range]   // max casting range in tiles
 * @property {number} [castTime] // turns to channel before casting (0 or omitted = instant)
 * @property {boolean} [channeling] // true = sustained realtime channel until cancelled
 * @property {number} [manaPerTick] // mana drained each channel tick when channeling
 * @property {number} [boltsPerTick] // storm impacts per sustain tick
 * @property {string} [script]  // optional key for scripted behavior
 * @property {string} [description] // flavor-forward tooltip text
 * @property {'self'|'target'|'auto'|'path'|'area'|'enemy'} [targeting]
 * @property {number} [radius]
 * @property {number} [maxTargets]
 * @property {SpellEffectDef[]} [effects]
 * @property {string[]} [schools]           // spell schools, e.g. ['destruction'], ['destruction','trickery']
 * @property {boolean}  [clearMindedCasting] // true = resolves normally even when caster is confused
 */

/** @type {Record<string, SpellDef>} */
export const SPELL_DEFS = {
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    symbol: '\u26A1',       // ⚡
    schools: ['destruction', 'electric', 'nature'],
    manaCost: 7,
    minIntelligence: 8,
    range: 12,
    script: 'lightning',
    targeting: 'auto',
    maxTargets: 3,
    description: 'A needle-bright bolt that leaps from foe to foe.',
    effects: [
      { kind: 'damage', element: 'electric', amount: '7 base, INT-scaled, can crit; reduced per jump' },
      { kind: 'utility', note: 'Chains to additional nearby enemies' },
    ],
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    symbol: '\u2604',       // ☄
    schools: ['destruction', 'fire'],
    manaCost: 12,
    minIntelligence: 0,
    range: 12,
    script: 'meteor',
    targeting: 'target',
    radius: 2,
    description: 'Drag a star to earth and let the blast wave finish the rest.',
    effects: [
      { kind: 'damage', element: 'fire', amount: '10 near impact, 5 on outer ring; INT-scaled, can crit' },
      { kind: 'status', status: 'burn', duration: '4 turns; spell-burn ticks also scale and can crit' },
    ],
  },
  blastwave: {
    id: 'blastwave',
    name: 'Blast Wave',
    symbol: '\u25CE',       // ◎
    schools: ['destruction', 'force'],
    manaCost: 7,
    minIntelligence: 0,
    script: 'blastwave',
    targeting: 'self',
    radius: 2,
    description: 'Release a concussive ring that batters and scatters nearby bodies.',
    effects: [
      { kind: 'damage', element: 'physical', amount: 'distance-scaled, INT-scaled, can crit' },
      { kind: 'movement', mode: 'knockback', note: 'Pushes targets away from caster' },
    ],
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    symbol: '\u{1F3C3}',   // 🏃
    schools: ['trickery', 'illusion', 'alteration'],
    clearMindedCasting: true,
    manaCost: 6,
    minIntelligence: 0,
    range: 10,
    script: 'blink',
    targeting: 'target',
    description: 'Fold space like cloth and step out where the seam opens.',
    effects: [
      { kind: 'movement', mode: 'teleport', note: 'Up to 10 tiles; snaps to nearest safe landing' },
      { kind: 'utility', note: 'Confusion or hallucination can randomize destination' },
    ],
  },
  homecoming: {
    id: 'homecoming',
    name: 'Homecoming',
    symbol: '\u{1F3E0}',   // 🏠
    manaCost: 1,
    minIntelligence: 0,
    script: 'homecoming',
    targeting: 'self',
    description: 'A homesick charm that yanks your soul toward the first stair.',
    effects: [
      { kind: 'movement', mode: 'depth-teleport', note: 'Returns caster to depth 0' },
      { kind: 'utility', note: 'Stores return ticket to prior depth and tile' },
    ],
  },
  hearthstone: {
    id: 'hearthstone',
    name: 'Hearthstone',
    symbol: '\u{1FAA8}',   // 🪨
    manaCost: 0,
    minIntelligence: 0,
    castTime: 10,
    script: 'hearthstone',
    targeting: 'self',
    description: 'Focus your will on hearth and home. After a long channel, you are pulled back to safety.',
    effects: [
      { kind: 'movement', mode: 'depth-teleport', note: 'Returns caster to depth 0 after 10-turn channel' },
      { kind: 'utility', note: 'Stores return ticket to prior depth and tile' },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    symbol: '\u2744',       // ❄
    schools: ['destruction'],
    manaCost: 5,
    minIntelligence: 0,
    script: 'frost',
    targeting: 'auto',
    description: 'Winter-sharp shards bite deep and numb whatever survives.',
    effects: [
      { kind: 'damage', element: 'cold', amount: '4 base, INT-scaled, can crit' },
      { kind: 'status', status: 'frost', duration: '2-5 turns (longer on lighter targets)' },
    ],
  },
  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    symbol: '\u2744', // ❄
    schools: ['destruction'],
    manaCost: 3,
    manaPerTick: 3,
    channeling: true,
    boltsPerTick: 3,
    minIntelligence: 0,
    range: 10,
    radius: 2,
    script: 'blizzard',
    targeting: 'area',
    description: 'Hold the sky open and let winter keep striking the ground you chose.',
    effects: [
      { kind: 'damage', element: 'cold', amount: 'Repeated low-damage ice strikes in the chosen storm area' },
      { kind: 'status', status: 'frost', duration: 'Brief slowing on creatures caught by an impact' },
      { kind: 'utility', note: 'Sustained channel; spends mana every realtime tick until cancelled or emptied' },
    ],
  },
  firestorm: {
    id: 'firestorm',
    name: 'Firestorm',
    symbol: '\u{1F525}', // 🔥
    schools: ['destruction', 'fire'],
    manaCost: 4,
    manaPerTick: 4,
    channeling: true,
    boltsPerTick: 3,
    minIntelligence: 0,
    range: 10,
    radius: 3,
    script: 'firestorm',
    targeting: 'area',
    description: 'Sustain a rain of cinders and falling embers over a marked patch of ground.',
    effects: [
      { kind: 'damage', element: 'fire', amount: 'Repeated low-damage fire strikes in the chosen storm area' },
      { kind: 'status', status: 'burn', duration: 'Short burning applied to survivors struck by an impact' },
      { kind: 'utility', note: 'Sustained channel; spends mana every realtime tick until cancelled or emptied' },
    ],
  },
  heal: {
    id: 'heal',
    name: 'Heal',
    symbol: '\u2764',       // ❤
    schools: ['healing','restoration'],
    manaCost: 8,
    minIntelligence: 0,
    range: 6,
    script: 'heal',
    targeting: 'target',
    description: 'Thread raw mana through wounds until flesh remembers itself.',
    effects: [
      { kind: 'utility', note: 'Heals self or ally; cannot affect enemies' },
      { kind: 'utility', note: 'Restores about 20-35 HP, plus intelligence scaling' },
    ],
  },
  flash_heal: {
    id: 'flash_heal',
    name: 'Flash Heal',
    symbol: '\u2728',       // ✨
    schools: ['healing', 'holy', 'restoration'],
    clearMindedCasting: true,
    manaCost: 14,
    minIntelligence: 0,
    script: 'flash_heal',
    targeting: 'self',
    description: 'A sudden burst of holy light that seals your wounds in an instant.',
    effects: [
      { kind: 'utility', note: 'Self-cast only' },
      { kind: 'utility', note: 'Consumes roughly a quarter of a cleric\'s starting mana' },
      { kind: 'utility', note: 'Restores 22% of max HP (minimum 1)' },
      { kind: 'damage', element: 'holy', amount: '2 base to adjacent hostile creatures; INT-scaled, can crit' },
    ],
  },
  smite: {
    id: 'smite',
    name: 'Smite',
    symbol: '\u2726', // ✦
    schools: ['holy', 'destruction'],
    manaCost: 6,
    minIntelligence: 0,
    range: 8,
    script: 'smite',
    targeting: 'target',
    description: 'Call down a clean spear of judgment on the nearest sinner in sight.',
    effects: [
      { kind: 'damage', element: 'holy', amount: '6 base, INT-scaled, can crit' },
      { kind: 'utility', note: 'Targets a hostile creature in line of sight' },
    ],
  },
  summon_skeleton: {
    id: 'summon_skeleton',
    name: 'Summon Skeleton',
    symbol: '\u{1F480}',   // 💀
    manaCost: 10,
    minIntelligence: 8,
    castTime: 5,
    script: 'summon_skeleton',
    targeting: 'self',
    description: 'Rip a skeleton from the earth to fight at your side.',
    effects: [
      { kind: 'utility', note: 'Summons a friendly skeleton nearby' },
      { kind: 'utility', note: 'Skeleton is always aggressive toward enemies' },
    ],
  },
  shadow_bolt: {
    id: 'shadow_bolt',
    name: 'Shadow Bolt',
    symbol: '\u{1F31A}',   // 🌚
    manaCost: 15,
    minIntelligence: 8,
    range: 10,
    castTime: 2,
    script: 'shadow_bolt',
    targeting: 'auto',
    description: 'A bolt of pure shadow that strikes with devastating force.',
    effects: [
      { kind: 'damage', element: 'shadow', amount: '12 base, INT-scaled, can crit' },
    ],
  },
  agony: {
    id: 'agony',
    name: 'Agony',
    symbol: '\u2620',       // ☠
    schools: ['destruction', 'darkness'],
    manaCost: 8,
    minIntelligence: 8,
    range: 8,
    script: 'agony',
    targeting: 'enemy',
    description: 'Weave shadow into a curse that gnaws at the target\'s life force, dealing damage each turn.',
    effects: [
      { kind: 'damage', element: 'shadow', amount: 'Shadow DOT; cast-time damage scales with INT and each tick can crit' },
      { kind: 'status', status: 'agony', duration: '6-10 turns, snapshotted from cast-time INT' },
    ],
  },
  rampage: {
    id: 'rampage',
    name: 'Rampage',
    symbol: '\u{1F4A2}',    // 💢
    schools: ['alteration'],
    manaCost: 20,
    minIntelligence: 0,
    script: 'rampage',
    targeting: 'self',
    description: 'Spend every drop of mana to fuel a long, savage battle fury.',
    effects: [
      { kind: 'status', status: 'berserk', duration: '100 turns' },
      { kind: 'utility', note: '+3 to-hit accuracy and 1.5x melee damage' },
    ],
  },
  phase_strike: {
    id: 'phase_strike',
    name: 'Phase Strike',
    symbol: '\u2381',       // ⌁
    schools: ['destruction', 'trickery'],
    clearMindedCasting: true,
    manaCost: 10,
    minIntelligence: 0,
    range: 4,
    script: 'phase_strike',
    targeting: 'path',
    description: 'Slip between moments and cut everything standing on your line.',
    effects: [
      { kind: 'movement', mode: 'teleport', note: 'Dash up to 4 tiles' },
      { kind: 'damage', element: 'physical', amount: '6 base to enemies crossed; INT-scaled, can crit' },
      { kind: 'status', status: 'stun', duration: '3 turns' },
    ],
  },
};

/**
 * @param {string} id
 * @returns {SpellDef | null}
 */
export function getSpell(id) {
  return SPELL_DEFS[id] || null;
}

export function listSpells() {
  return Object.values(SPELL_DEFS);
}

/**
 * @param {SpellDef | null | undefined} spell
 * @returns {string[]}
 */
export function describeSpellDetailLines(spell) {
  if (!spell) return [];
  return [
    spell.channeling
      ? `Mana ${Number(spell.manaPerTick ?? spell.manaCost ?? 0)} / tick`
      : `Mana ${Number(spell.manaCost || 0)}`,
    Number.isFinite(spell.range) ? `Range ${Number(spell.range) | 0}` : "",
    Number.isFinite(spell.minIntelligence) && Number(spell.minIntelligence) > 0
      ? `Int ${Number(spell.minIntelligence) | 0}+`
      : "",
    Number.isFinite(spell.castTime) && Number(spell.castTime) > 0
      ? `Cast ${Number(spell.castTime) | 0} turns`
      : "",
    spell.channeling ? "Channel: Sustained" : "",
  ].filter(Boolean);
}

/**
 * @param {SpellDef | null | undefined} spell
 * @returns {string[]}
 */
export function describeSpellTargetEffects(spell) {
  if (!spell) return [];
  /** @type {string[]} */
  const lines = [];
  if (spell.targeting === 'self') lines.push('Targeting: Self');
  else if (spell.targeting === 'target') lines.push('Targeting: Chosen tile/target');
  else if (spell.targeting === 'auto') lines.push('Targeting: Auto-selects valid target');
  else if (spell.targeting === 'path') lines.push('Targeting: Along movement path');
  else if (spell.targeting === 'area') lines.push('Targeting: Area');
  else if (spell.targeting === 'enemy') lines.push('Targeting: Choose a visible enemy');
  if (Number.isFinite(spell.radius) && Number(spell.radius) > 0) {
    lines.push(`Area radius ${Number(spell.radius) | 0}`);
  }
  if (Number.isFinite(spell.maxTargets) && Number(spell.maxTargets) > 1) {
    lines.push(`Hits up to ${Number(spell.maxTargets) | 0} targets`);
  }

  const effects = Array.isArray(spell.effects) ? spell.effects : [];
  for (const effect of effects) {
    if (!effect || typeof effect !== 'object') continue;
    if (effect.kind === 'damage') {
      const element = String(effect.element || 'damage');
      const amount = String(effect.amount || '').trim();
      lines.push(amount ? `${element} damage: ${amount}` : `${element} damage`);
      continue;
    }
    if (effect.kind === 'status') {
      const status = String(effect.status || 'status');
      const duration = String(effect.duration || '').trim();
      lines.push(duration ? `Applies ${status}: ${duration}` : `Applies ${status}`);
      continue;
    }
    if (effect.kind === 'movement') {
      const mode = String(effect.mode || 'movement');
      const note = String(effect.note || '').trim();
      lines.push(note ? `${mode}: ${note}` : mode);
      continue;
    }
    if (effect.kind === 'utility') {
      const note = String(effect.note || '').trim();
      if (note) lines.push(note);
    }
  }
  return lines;
}
