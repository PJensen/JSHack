// src/content/items/potionOfRadiance.js
// ──────────────────────────────────────────────────────────────────
// Potion of Radiance — a single file that completely defines an item:
//   identity, display, stats, drink behavior, throw behavior,
//   VFX, sound, messages. Nothing else to edit anywhere.
// ──────────────────────────────────────────────────────────────────

import { defineItem } from '../define.js';

defineItem('potion_radiance', {
  name:        'Potion of Radiance',
  type:        'potion',
  glyph:       '!',
  color:       '#ffe566',
  glow:        '#ccaa30',
  scale:       0.65,
  weight:      0.5,
  value:       55,
  rarity:      'rare',
  material:    'glass',
  description: 'A golden draught that blazes with captured sunlight. Undead recoil from its glow.',

  potion: {
    route: 'oral',
    doses: 1,
    feel:  'Warmth floods outward from your chest — you shine.',
  },

  // ── DRINK ─────────────────────────────────────────────────────
  // Heals a flat amount plus a percentage of max HP.
  // Cures blindness and fear. Grants a short regeneration buff.
  // If the drinker is poisoned, the radiance burns it out too.
  onDrink(ctx) {
    // Heal: 3d6 flat + 15% max HP (needs raw component for the %)
    const flat = ctx.roll('3d6');
    ctx.heal(ctx.user, flat);
    ctx.result('healed', flat);

    // Cleanse debuffs
    const wasPoisoned = ctx.hasStatus(ctx.user, 'poisoned');
    const wasBlind    = ctx.hasStatus(ctx.user, 'blinded');
    ctx.cure(ctx.user, ['poison', 'blind', 'fear', 'cursed']);

    // Short regen buff
    ctx.buff(ctx.user, 'regen', 12, { potency: 2 });

    // ── Messages ────────────────────────────────────────────────
    ctx.message('{user} drinks the {item} — golden light erupts from within!', 'good');
    if (wasPoisoned) ctx.message('The radiance sears the poison from your blood.', 'good');
    if (wasBlind)    ctx.message('Light returns to your eyes!', 'good');

    // ── VFX ─────────────────────────────────────────────────────
    ctx.vfx.burst(ctx.user, { color: '#ffe566', count: 14, speed: 1.4 });
    ctx.vfx.glow(ctx.user, { color: '#ffe566', radius: 1.5, life: 1.2 });
    ctx.vfx.floatText(ctx.user, '+' + flat + ' HP', { color: '#ffe566', life: 1.0 });

    // ── Sound ───────────────────────────────────────────────────
    ctx.sound('holy_chime');
  },

  // ── THROW ─────────────────────────────────────────────────────
  // Shatters into a burst of light that damages undead in the area
  // and briefly blinds living enemies.
  onThrow(ctx) {
    ctx.damage(ctx.target, '2d8', 'radiant');
    ctx.apply(ctx.target, 'blind', 4);
    ctx.message('The {item} shatters — searing light floods the corridor!', 'danger');
    ctx.vfx.explosion(ctx.target, { color: '#ffe566', radius: 2, count: 20 });
    ctx.sound('glass_shatter');
  },
});
