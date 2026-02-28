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
  * @property {string} [script]  // optional key for scripted behavior
 * @property {string} [description] // flavor-forward tooltip text
 * @property {'self'|'target'|'auto'|'path'|'area'} [targeting]
 * @property {number} [radius]
 * @property {number} [maxTargets]
 * @property {SpellEffectDef[]} [effects]
 */

/** @type {Record<string, SpellDef>} */
export const SPELL_DEFS = {
  lightning: {
    id: 'lightning',
    name: 'Lightning',
    symbol: '\u26A1',       // ⚡
    manaCost: 7,
    minIntelligence: 8,
    range: 12,
    script: 'lightning',
    targeting: 'auto',
    maxTargets: 3,
    description: 'A needle-bright bolt that leaps from foe to foe.',
    effects: [
      { kind: 'damage', element: 'electric', amount: '7, then reduced per jump' },
      { kind: 'utility', note: 'Chains to additional nearby enemies' },
    ],
  },
  meteor: {
    id: 'meteor',
    name: 'Meteor',
    symbol: '\u2604',       // ☄
    manaCost: 12,
    minIntelligence: 0,
    range: 12,
    script: 'meteor',
    targeting: 'target',
    radius: 2,
    description: 'Drag a star to earth and let the blast wave finish the rest.',
    effects: [
      { kind: 'damage', element: 'fire', amount: '10 near impact, 5 on outer ring' },
      { kind: 'status', status: 'burn', duration: '4 turns (stacks)' },
    ],
  },
  blastwave: {
    id: 'blastwave',
    name: 'Blast Wave',
    symbol: '\u25CE',       // ◎
    manaCost: 7,
    minIntelligence: 0,
    script: 'blastwave',
    targeting: 'self',
    radius: 2,
    description: 'Release a concussive ring that batters and scatters nearby bodies.',
    effects: [
      { kind: 'damage', element: 'physical', amount: 'distance-scaled' },
      { kind: 'movement', mode: 'knockback', note: 'Pushes targets away from caster' },
    ],
  },
  blink: {
    id: 'blink',
    name: 'Blink',
    symbol: '\u{1F3C3}',   // 🏃
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
  frost: {
    id: 'frost',
    name: 'Frost',
    symbol: '\u2744',       // ❄
    manaCost: 5,
    minIntelligence: 0,
    script: 'frost',
    targeting: 'auto',
    description: 'Winter-sharp shards bite deep and numb whatever survives.',
    effects: [
      { kind: 'damage', element: 'cold', amount: '4' },
      { kind: 'status', status: 'frost', duration: '2-5 turns (longer on lighter targets)' },
    ],
  },
  heal: {
    id: 'heal',
    name: 'Heal',
    symbol: '\u2764',       // ❤
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
    manaCost: 14,
    minIntelligence: 0,
    script: 'flash_heal',
    targeting: 'self',
    description: 'A sudden burst of holy light that seals your wounds in an instant.',
    effects: [
      { kind: 'utility', note: 'Self-cast only' },
      { kind: 'utility', note: 'Consumes roughly a quarter of a cleric\'s starting mana' },
      { kind: 'utility', note: 'Restores 25% of max HP (minimum 1)' },
    ],
  },
  phase_strike: {
    id: 'phase_strike',
    name: 'Phase Strike',
    symbol: '\u2381',       // ⌁
    manaCost: 10,
    minIntelligence: 0,
    range: 4,
    script: 'phase_strike',
    targeting: 'path',
    description: 'Slip between moments and cut everything standing on your line.',
    effects: [
      { kind: 'movement', mode: 'teleport', note: 'Dash up to 4 tiles' },
      { kind: 'damage', element: 'physical', amount: '6 to enemies crossed' },
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
    `Mana ${Number(spell.manaCost || 0)}`,
    Number.isFinite(spell.range) ? `Range ${Number(spell.range) | 0}` : "",
    Number.isFinite(spell.minIntelligence) && Number(spell.minIntelligence) > 0
      ? `Int ${Number(spell.minIntelligence) | 0}+`
      : "",
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
