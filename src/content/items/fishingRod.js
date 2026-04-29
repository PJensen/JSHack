// src/content/items/fishingRod.js
// Fishing Rod: content DSL item matching the equipped-use strategy used by Sunsword.

import { defineItem } from '../define.js';

defineItem('fishing_rod', {
  name:        'Fishing Rod',
  type:        'weapon',
  glyph:       '/',
  color:       '#d6b26d',
  scale:       0.75,
  weight:      1.0,
  value:       16,
  rarity:      'common',
  material:    'wood',
  description: 'A flexible rod, cord, hook, and hope. Cast it near water to channel a catch.',
  tags:        ['tool', 'fishing'],

  bonuses:     { luck: 1 },
  damageDice:  '1d2',
  damageType:  'blunt',
  staminaCost: 4,
  twoHanded:   true,

  abilities: {
    cast_line: {
      name:        'Cast Line',
      icon:        '🎣',
      targeting:   'none',
      cooldown:    0,
      description: 'Cast into nearby water and wait for a bite.',

      onActivate(ctx) {
        ctx.emit('fishing:cast:request', {
          actor: ctx.user,
          itemId: ctx.item,
          turns: 12,
        });
      },
    },
  },

  onUse(ctx) {
    ctx.emit('fishing:cast:request', {
      actor: ctx.user,
      itemId: ctx.item,
      turns: 12,
    });
  },
});
