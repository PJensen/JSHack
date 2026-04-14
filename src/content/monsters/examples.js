// src/content/monsters/examples.js
// Example monster definitions using the content DSL.
//
// Note: monster hooks still use the existing callback factory pattern
// (statusEffectOnHit, castSpellOnLOS, etc.) since those are already
// composable. The DSL just gives you a single-file definition.

import { defineMonster } from '../define.js';

// ═══════════════════════════════════════════════════════════════════
//  Magma Slime — tier 1 fire creature
//  Immune to fire, vulnerable to cold. Leaves fire on death.
// ═══════════════════════════════════════════════════════════════════

defineMonster('magma_slime', {
  name:         'Magma Slime',
  glyph:        'j',
  color:        '#ff6633',
  glow:         '#cc3300',
  tags:         ['beast', 'ooze', 'fire'],
  tier:         1,
  description:  'A blob of molten rock that oozes across the floor, igniting everything it touches.',

  hp:           18,
  hpPerLevel:   2,
  attack:       3,
  defense:      1,
  damageDice:   '1d6',
  speed:        1,
  sizeClass:    'M',
  massKg:       40,
  intelligence: 2,
  goreType:     'fire',

  immune:       ['fire', 'poison'],
  vulnerable:   ['cold'],
});


// ═══════════════════════════════════════════════════════════════════
//  Frost Wraith — tier 2 undead caster
//  Cold attacks, retreats when low, casts chill_touch.
// ═══════════════════════════════════════════════════════════════════

defineMonster('frost_wraith', {
  name:         'Frost Wraith',
  glyph:        'W',
  color:        '#aaddff',
  glow:         '#6699cc',
  tags:         ['undead', 'caster'],
  tier:         2,
  description:  'A spectral figure wreathed in frozen mist. Its touch saps warmth from the living.',

  hp:           28,
  hpPerLevel:   2.5,
  attack:       4,
  defense:      3,
  damageDice:   '1d8',
  speed:        2,
  sizeClass:    'M',
  massKg:       15,
  intelligence: 7,
  goreType:     'none',

  immune:       ['cold', 'poison'],
  vulnerable:   ['fire'],
  retreatHpPct: 0.2,

  learnedSpellIds: ['chill_touch'],
  maxMana:      30,
  manaRegen:    1,

  lootTable:    'drop:undead',
  specials:     ['Cold immune', 'Casts Chill Touch', 'Retreats at 20% HP'],
});
