// src/content/items/examples.js
// Example item definitions using the content DSL.
// Each defineItem() call is self-contained: one file, one item, all behavior.
//
// Import this file at startup to register these items.
// They become available through createItemById() like any other item.

import { defineItem } from '../define.js';

// ═══════════════════════════════════════════════════════════════════
//  FOOD: Antidote Salve
//  Heals, cures poison, green sparkle VFX.
//  Previously would have required: Food.js, itemFactory.js,
//  itemCatalogMagic.js, itemCatalogHooks.js, base.js,
//  floatTextWiring.js, itemMessages.js — 7 files.
//  Now: this one file.
// ═══════════════════════════════════════════════════════════════════

defineItem('food_antidote_salve', {
  name:        'Antidote Salve',
  type:        'food',
  glyph:       '%',
  color:       '#55dd55',
  glow:        '#22aa22',
  scale:       0.65,
  weight:      0.3,
  value:       30,
  rarity:      'rare',
  material:    'organic',
  description: 'A shimmering green salve brewed from moonleaf and venom frond.',
  nutrition:   25,
  shelfLife:   'medium',

  onUse(ctx) {
    const healed = ctx.heal(ctx.user, '2d6+4');
    ctx.cure(ctx.user, 'poison');
    ctx.message('{user} applies the {item} — the toxins recede.', 'good');
    ctx.vfx.floatText(ctx.user, 'CURED', { color: '#55dd55' });
    ctx.vfx.burst(ctx.user, { color: '#55dd55', count: 8 });
    ctx.sound('potion_drink');
    ctx.consume();
  },

  recipe: ['reagent_moonleaf', 'reagent_venom_frond'],
});


// ═══════════════════════════════════════════════════════════════════
//  POTION: Liquid Flame
//  Drink: short fire immunity + burning aura.
//  Throw: AoE fire splash.
// ═══════════════════════════════════════════════════════════════════

defineItem('potion_liquid_flame', {
  name:        'Potion of Liquid Flame',
  type:        'potion',
  glyph:       '!',
  color:       '#ff6633',
  glow:        '#cc4400',
  scale:       0.65,
  weight:      0.5,
  value:       45,
  rarity:      'magic',
  material:    'glass',
  description: 'A volatile brew that crackles with contained heat.',

  potion: {
    route:  'oral',
    doses:  1,
    feel:   'Liquid fire courses through your veins.',
  },

  onDrink(ctx) {
    ctx.buff(ctx.user, 'fire_resist', 40, { potency: 3 });
    ctx.apply(ctx.user, 'burning_aura', 20, {
      potency: 1,
      meta: { source: 'potion_liquid_flame', kind: 'aura' },
    });
    ctx.message('{user} drinks the {item} — flames wreath {user}!', 'danger');
    ctx.vfx.glow(ctx.user, { color: '#ff6633', radius: 1.2 });
    ctx.sound('fire_ignite');
  },

  onThrow(ctx) {
    ctx.damage(ctx.target, '2d6', 'fire');
    ctx.apply(ctx.target, 'burning', 5);
    ctx.message('The {item} shatters in a gout of flame!', 'danger');
    ctx.vfx.explosion(ctx.target, { color: '#ff6633', radius: 2 });
    ctx.sound('fire_explosion');
  },
});


// ═══════════════════════════════════════════════════════════════════
//  WEAPON: Frostbrand
//  Enchanted longsword — cold damage on hit, slows target.
// ═══════════════════════════════════════════════════════════════════

defineItem('frostbrand', {
  name:        'Frostbrand',
  type:        'weapon',
  glyph:       ')',
  color:       '#88ccff',
  glow:        '#4488cc',
  scale:       0.8,
  weight:      2.8,
  value:       200,
  rarity:      'rare',
  material:    'steel',
  description: 'An ancient blade rimmed with never-melting ice.',
  bonuses:     { attack: 3, accuracy: 2, damagePower: 2 },
  damageDice:  '1d8',
  damageType:  'slash',
  staminaCost: 11,
  twoHanded:   false,
  maxSockets:  1,
});


// ═══════════════════════════════════════════════════════════════════
//  TOOL: Lodestone
//  Use: reveals all metallic items on the floor.
// ═══════════════════════════════════════════════════════════════════

defineItem('stone_lodestone', {
  name:        'Lodestone',
  type:        'tool',
  glyph:       '`',
  color:       '#9999aa',
  glow:        '#666677',
  scale:       0.5,
  weight:      2.0,
  value:       35,
  rarity:      'uncommon',
  material:    'mineral',
  description: 'A dark, heavy stone that hums faintly near metal.',

  onUse(ctx) {
    ctx.message('{user} holds the {item} aloft — it thrums and pulls northward.');
    ctx.emit('lodestone:pulse', { actor: ctx.user });
    ctx.vfx.glow(ctx.user, { color: '#9999ff', radius: 2.0, life: 1.5 });
    ctx.sound('magic_hum');
    // Does not consume — reusable tool
  },
});
