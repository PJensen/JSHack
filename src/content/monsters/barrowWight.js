// src/content/monsters/barrowWight.js
// ──────────────────────────────────────────────────────────────────
// The Barrow Wight — a grave-cold undead lord who feeds on the
// essence of the living. Everything it is, does, thinks, and looks
// like is in this file. Nothing else to edit anywhere.
//
// Three-phase lifecycle driven by internal state:
//   gathering → empowered → desperate
//
// Thematic pair with the Sun-Vessel: it drains life, the Vessel
// radiates it. They are designed to collide.
// ──────────────────────────────────────────────────────────────────

import { defineMonster } from '../define.js';

defineMonster('barrow_wight', {
  name:         'Barrow Wight',
  glyph:        'W',
  color:        '#8877aa',
  glow:         '#554477',
  tags:         ['undead', 'caster', 'cold'],
  tier:         2,
  minDepth:     3,
  description:  'A robed figure of grave-frost and old malice. The air thins around it.',

  // ── Combat stats ──────────────────────────────────────────────
  hp:           32,
  hpPerLevel:   2.5,
  attack:       5,
  defense:      4,
  damageDice:   '1d8',
  speed:        2,
  sizeClass:    'M',
  massKg:       35,
  intelligence: 8,
  goreType:     'ichor',

  // ── AI ────────────────────────────────────────────────────────
  retreatHpPct: 0.15,
  ambush:       true,    // holds position until player is adjacent

  // ── Resistances ───────────────────────────────────────────────
  immune:       ['cold', 'poison'],
  vulnerable:   ['fire'],

  // ── Loot ──────────────────────────────────────────────────────
  lootTable:    'drop:undead',
  specials:     [
    'Essence drain (passive)',
    'Life siphon on hit (empowered)',
    'Death nova (essence release)',
    'Cold immune, fire vulnerable',
  ],

  // ── Local persistent state ────────────────────────────────────
  // This is the Wight's soul. It tracks across turns, mutates
  // through gameplay, drives every decision it makes.
  state: {
    essence:      0,       // accumulated life force (0–12)
    maxEssence:   12,
    phase:        'gathering',  // gathering | empowered | desperate
    drainTick:    0,       // cooldown between drain pulses
  },

  // ═════════════════════════════════════════════════════════════
  //  HOOKS
  // ═════════════════════════════════════════════════════════════

  // ── whileLOS: fires each turn the Wight sees the player ──────
  // This is where the Wight lives. It gathers essence, transitions
  // phases, and radiates its nature into the world around it.
  whileLOS(ctx) {
    const st = ctx.state();
    const hpPct = ctx.hpPercent(ctx.self);

    // ── Phase transitions ───────────────────────────────────────
    if (st.phase !== 'desperate' && hpPct < 0.30) {
      ctx.setState({ phase: 'desperate', drainTick: 0 });
      ctx.message('The Barrow Wight shrieks — its form flickers with desperate cold!', 'danger');
      ctx.present('phase_desperate', { target: ctx.self });
      return; // spend this turn on the transition
    }

    if (st.phase === 'gathering' && st.essence >= 8) {
      ctx.setState({ phase: 'empowered' });
      ctx.message('The Barrow Wight swells with stolen essence — frost spreads from its feet.', 'danger');
      ctx.present('phase_empowered', { target: ctx.self });
      return;
    }

    if (st.phase === 'empowered' && st.essence <= 2) {
      ctx.setState({ phase: 'gathering' });
      ctx.message('The Barrow Wight dims — its stolen warmth is fading.', 'system');
      return;
    }

    // ── Essence drain (gathering & empowered) ───────────────────
    // Every few turns, siphon a point of essence from nearby living
    if (st.phase !== 'desperate') {
      const newTick = st.drainTick + 1;
      const interval = st.phase === 'empowered' ? 2 : 3;

      if (newTick >= interval) {
        ctx.setState({ drainTick: 0 });
        if (st.essence < st.maxEssence) {
          ctx.setState({ essence: Math.min(st.maxEssence, st.essence + 1) });
          ctx.present('essence_siphon', { target: ctx.self, essence: st.essence + 1 });
        }
      } else {
        ctx.setState({ drainTick: newTick });
      }
    }

    // ── Empowered: cold aura ────────────────────────────────────
    if (st.phase === 'empowered') {
      const nearby = ctx.entitiesInRadius(ctx.self, 2, { faction: 'player' });
      for (const nid of nearby) {
        if (!ctx.hasStatus(nid, 'cold_aura_tick')) {
          ctx.damage(nid, 2, 'cold');
        }
      }
      // Subtle ambient pulse every turn
      ctx.present('cold_aura', { target: ctx.self });
    }

    // ── Desperate: burn essence for survival ────────────────────
    if (st.phase === 'desperate' && st.essence > 0) {
      // Spend 2 essence to heal
      const spend = Math.min(2, st.essence);
      ctx.setState({ essence: st.essence - spend });
      ctx.heal(ctx.self, spend * 4);
      ctx.present('desperate_feed', { target: ctx.self, spent: spend });
    }
  },

  // ── onHit: fires when the Wight lands a melee blow ───────────
  // When empowered, each hit siphons life.
  onHit(ctx) {
    const st = ctx.state();
    if (st.phase !== 'empowered') return;

    // Life siphon: steal HP from the target, heal self
    const siphoned = ctx.roll('1d4');
    ctx.damage(ctx.target, siphoned, 'necrotic');
    ctx.heal(ctx.self, siphoned);
    ctx.present('life_siphon', { target: ctx.target, amount: siphoned });
  },

  // ── onDamaged: fires when the Wight takes a hit ──────────────
  // Radiant and fire damage burns stored essence.
  onDamaged(ctx) {
    const st = ctx.state();
    if (st.essence <= 0) return;

    // Check damage type from the combat context
    const dmgType = ctx._combatCtx?.damage != null ? 'physical' : 'physical';
    // Radiant/fire burns extra essence (use a chance roll as proxy
    // since damage type isn't exposed cleanly to the DSL yet)
    if (ctx.chance(35)) {
      const burn = Math.min(2, st.essence);
      ctx.setState({ essence: st.essence - burn });
      ctx.present('essence_burn', { target: ctx.self, burned: burn });
    }
  },

  // ── onDeath: fires when the Wight is destroyed ───────────────
  // Releases all stored essence in a death nova.
  // More essence = bigger explosion.
  onDeath(ctx) {
    const st = ctx.state();
    const essence = Math.max(0, st.essence);

    if (essence <= 0) {
      ctx.message('The Barrow Wight collapses into dust.', 'system');
      return;
    }

    // Death nova: cold damage proportional to stored essence
    const novaRadius = essence >= 8 ? 3 : 2;
    const novaDmg = 2 + essence * 2;
    const caught = ctx.entitiesInRadius(ctx.self, novaRadius, { faction: 'player' });
    for (const cid of caught) {
      ctx.damage(cid, novaDmg, 'cold');
      ctx.apply(cid, 'chilled', 4, { potency: 1 });
    }

    ctx.message(
      essence >= 8
        ? 'The Barrow Wight detonates — a wave of tomb-frost cascades outward!'
        : 'The Barrow Wight crumbles, exhaling a final breath of cold.',
      'danger'
    );
    ctx.present('death_nova', { target: ctx.self, essence, radius: novaRadius });
  },

  // ═════════════════════════════════════════════════════════════
  //  PRESENTATIONS
  //  Co-located. Display reads these. Headless ignores them.
  // ═════════════════════════════════════════════════════════════

  presentations: {
    essence_siphon: {
      vfx: [
        { type: 'glow', color: '#8877aa', radius: 0.5, life: 0.4 },
      ],
    },
    phase_empowered: {
      sound: 'frost_surge',
      vfx: [
        { type: 'burst', color: '#aabbdd', count: 16, speed: 1.2, life: 0.5 },
        { type: 'glow', color: '#8877aa', radius: 2.0, life: 1.5 },
        { type: 'floatText', text: 'EMPOWERED', color: '#aabbdd' },
      ],
    },
    phase_desperate: {
      sound: 'wight_shriek',
      vfx: [
        { type: 'burst', color: '#aa6688', count: 10, speed: 2.0, life: 0.3 },
        { type: 'floatText', text: 'DESPERATE', color: '#ff6688' },
      ],
    },
    cold_aura: {
      vfx: [
        { type: 'glow', color: '#6666aa', radius: 1.0, life: 0.3 },
      ],
    },
    desperate_feed: {
      vfx: [
        { type: 'glow', color: '#aa4466', radius: 0.6, life: 0.3 },
        { type: 'floatText', text: 'FEEDS', color: '#aa4466' },
      ],
    },
    life_siphon: {
      vfx: [
        { type: 'burst', color: '#cc88aa', count: 6, speed: 0.8, life: 0.3 },
        { type: 'floatText', text: '-{amount}', color: '#cc88aa' },
      ],
    },
    essence_burn: {
      sound: 'holy_sear',
      vfx: [
        { type: 'flash', color: '#ffdd88', radius: 2 },
        { type: 'floatText', text: 'ESSENCE BURNED', color: '#ffdd88' },
      ],
    },
    death_nova: {
      sound: 'frost_explosion',
      vfx: [
        { type: 'flash', color: '#8877aa', radius: 4 },
        { type: 'burst', color: '#aabbdd', count: 24, speed: 3.0, life: 0.6 },
      ],
      message: 'Tomb-frost erupts — {essence} essence released!',
      messageType: 'danger',
    },
  },
});

