// src/content/items/sunVessel.js
// ──────────────────────────────────────────────────────────────────
// The Sun-Vessel — a complex stateful artifact.
//
// A sealed reliquary of captive daylight. Carries charge that can be
// invoked for holy bursts, or thrown for a devastating explosion.
// While carried, it pulses near undead, draining stability.
// When cracked, it leaks radiance that scorches the dead.
//
// One file. Everything the thing is, does, and looks like.
// ──────────────────────────────────────────────────────────────────

import { defineItem } from '../define.js';

defineItem('sun_vessel', {
  name:        'Sun-Vessel',
  type:        'tool',
  glyph:       '{',
  color:       '#f6d365',
  glow:        '#ffb347',
  scale:       0.55,
  weight:      1.5,
  value:       350,
  rarity:      'legendary',
  material:    'bronze',
  description: 'A sealed reliquary of captive daylight. It hums with quiet warmth.',
  tags:        ['light', 'holy', 'volatile'],

  // ── Local persistent state ──────────────────────────────────────
  state: {
    charge:     8,
    maxCharge:  8,
    stability:  10,
    cracked:    false,
  },

  // ── TOOLTIP STATUS ──────────────────────────────────────────────
  // Receives live ScriptState.data, returns lines for the item tooltip.
  status(st) {
    const lines = [];
    const chargePct = st.charge / st.maxCharge;
    lines.push({
      text: `Charges: ${'◈'.repeat(st.charge)}${'◇'.repeat(st.maxCharge - st.charge)} ${st.charge}/${st.maxCharge}`,
      color: chargePct > 0.5 ? '#f6d365' : chargePct > 0 ? '#ffb347' : '#666666',
    });
    if (st.cracked) {
      lines.push({ text: 'CRACKED — leaking radiance', color: '#ff6644' });
    } else if (st.stability < 10) {
      lines.push({ text: `Stability: ${st.stability}/10`, color: st.stability < 4 ? '#ff9944' : '#aaaaaa' });
    }
    return lines;
  },

  // ── USE: Invoke ─────────────────────────────────────────────────
  // Spend one charge for a holy burst: damages nearby undead,
  // heals the bearer slightly, emits light.
  onUse(ctx) {
    const st = ctx.state();

    if (st.charge <= 0) {
      ctx.message('The {item} is spent — only cold glass remains.', 'system');
      return;
    }

    // Spend charge
    ctx.setState({ charge: st.charge - 1 });

    // Holy burst: find undead in radius 3
    const undead = ctx.entitiesInRadius(ctx.user, 3, { tag: 'undead' });
    let totalDmg = 0;
    for (const uid of undead) {
      totalDmg += ctx.damage(uid, '2d6', 'radiant');
    }

    // Heal bearer
    const healed = ctx.heal(ctx.user, '1d6+2');

    // Message
    if (undead.length > 0) {
      ctx.message('{user} raises the {item} — golden fire lashes the dead!', 'good');
    } else {
      ctx.message('{user} raises the {item} — warm light floods outward.', 'system');
    }

    // Presentation
    ctx.present('invoke', {
      target: ctx.user,
      healed,
      damaged: totalDmg,
      undeadHit: undead.length,
      remaining: st.charge - 1,
    });
  },

  // ── THROW: Shatter ──────────────────────────────────────────────
  // Shatters the vessel, releasing ALL remaining charge at once.
  // Massive radiant explosion proportional to stored charge.
  onThrow(ctx) {
    const st = ctx.state();
    const chargeLeft = Math.max(0, st.charge);
    const landing = ctx.targetPos;

    if (chargeLeft === 0) {
      ctx.message('The empty {item} shatters harmlessly.', 'system');
      ctx.consume();
      return;
    }

    // Release all charge
    ctx.setState({ charge: 0, cracked: true });

    // Scale damage with remaining charge
    const baseDmg = 2 + chargeLeft * 3;
    const undead = landing ? ctx.entitiesInRadius(landing, 4, { tag: 'undead' }) : [];
    for (const uid of undead) {
      ctx.damage(uid, baseDmg, 'radiant');
    }

    // Also damages non-undead nearby, but less
    const others = landing ? ctx.entitiesInRadius(landing, 2, { faction: 'enemy' }) : [];
    for (const oid of others) {
      if (!undead.includes(oid)) {
        ctx.damage(oid, Math.floor(baseDmg / 2), 'radiant');
        ctx.apply(oid, 'blind', 3);
      }
    }

    ctx.message('The {item} detonates — a pillar of captured sunlight erupts!', 'danger');
    ctx.present('shatter', {
      at: landing,
      charge: chargeLeft,
    });
    ctx.consume();
  },

  // ── TICK: While carried ─────────────────────────────────────────
  // Each turn, if undead are nearby, the vessel pulses.
  // Drains stability. When stability hits 0, the vessel cracks.
  // While cracked, leaks radiance that damages nearby undead.
  onTurnWhileCarried(ctx) {
    const st = ctx.state();
    if (st.charge <= 0) {
      ctx.light(ctx.user, 0);
      return;
    }

    // ── Dynamic light ───────────────────────────────────────────
    // The vessel's light IS its mood. Four axes drive it:
    //   charge    → radius (how far it reaches)
    //   stability → speed/wobble (how anxious it feels)
    //   cracked   → jitter/color (bleeding, volatile)
    //   undead    → sway amplitude (reacting to the dead)

    const chargeRatio = st.charge / st.maxCharge;         // 0–1
    const stabRatio   = st.stability / 10;                // 0–1 (1 = calm)
    const undead      = ctx.entitiesInRadius(ctx.user, 4, { tag: 'undead' });
    const threat      = Math.min(undead.length / 3, 1.0); // 0–1

    // Radius: charge drives reach, cracked bleeds brighter
    const radius = st.cracked
      ? 2.0 + chargeRatio * 3.5                           // cracked: 2.0–5.5
      : 1.5 + chargeRatio * 2.5;                          // intact:  1.5–4.0

    // Color: gold → amber → orange as it destabilizes
    const color = st.cracked  ? '#ff9933'                  // cracked: deep amber
      : threat > 0.5          ? '#f5b840'                  // sensing undead: warm
      : stabRatio < 0.5       ? '#f0c040'                  // stressed: shifting
                              : '#f6d365';                 // calm: soft gold

    // Temporal: every axis nudges the waveform
    ctx.light(ctx.user, radius, {
      color,
      temporal: {
        speed:  0.6 + (1 - stabRatio) * 1.2 + threat * 0.8,   // calm=0.6, panicked=2.6
        sway:   0.04 + threat * 0.12,                           // reacts to undead
        wobble: 0.02 + (1 - stabRatio) * 0.10,                 // anxiety → wobble
        jitter: st.cracked ? 0.08 + (1 - chargeRatio) * 0.06   // cracked: noisy, worse when low
                           : 0.01,                              // intact: rock steady
        rShift: st.cracked ? 0.06 : threat * 0.03,             // warm shift under stress
        gShift: st.cracked ? -0.04 : 0,                        // cracked loses green
        bShift: -threat * 0.03,                                 // undead drain blue
      },
    });

    if (undead.length === 0) {
      if (st.stability < 10) {
        ctx.setState({ stability: Math.min(10, st.stability + 1) });
      }
      return;
    }

    // Drain stability proportional to undead count
    const drain = Math.min(undead.length, 3);
    const newStab = Math.max(0, st.stability - drain);
    ctx.setState({ stability: newStab });

    // Pulse presentation
    ctx.present('pulse', { target: ctx.user, intensity: drain });

    // Crack threshold
    if (newStab <= 0 && !st.cracked) {
      ctx.setState({ cracked: true });
      ctx.message('The Sun-Vessel shudders — hairline fractures race across the glass!', 'danger');
      ctx.present('crack', { target: ctx.user });
    }

    // Cracked: leak radiance — bleed charge, damage undead, pulse light
    if (st.cracked) {
      for (const uid of undead) {
        ctx.damage(uid, '1d4', 'radiant');
      }
      ctx.setState({ charge: st.charge - 1 });
      ctx.present('leak', { target: ctx.user });

      if (st.charge - 1 <= 0) {
        ctx.message('The last light drains from the Sun-Vessel.', 'system');
      }
    }
  },

  // ── AI HINTS ────────────────────────────────────────────────────
  aiHints: {
    threatIfSeenBy: {
      undead: 'extreme',
      thief: 'high_value',
    },
  },

  // ── PRESENTATIONS ───────────────────────────────────────────────
  // Co-located. One file. Simulation calls ctx.present(id, payload),
  // display reads these specs. In headless mode, ignored entirely.
  presentations: {
    // USE: holy burst — golden explosion of light + particles + heal text
    invoke: {
      sound: 'holy_chime',
      vfx: [
        { type: 'lightPulse', color: '#f6d365', radius: 5, duration: 0.5 },
        { type: 'burst', color: '#f6d365', count: 14, speed: 1.4, life: 0.4 },
        { type: 'glow', color: '#ffb347', radius: 1.8, life: 1.5 },
        { type: 'floatText', text: '+{healed} HP', color: '#f6d365' },
      ],
    },

    // THROW: full detonation — massive flash + radiant cascade
    shatter: {
      sound: 'glass_shatter',
      vfx: [
        { type: 'lightPulse', color: '#fffbe6', radius: 8, duration: 0.6 },
        { type: 'flash', color: '#fffbe6', radius: 6 },
        { type: 'burst', color: '#f6d365', count: 24, speed: 3.0, life: 0.6 },
        { type: 'glow', color: '#ffb347', radius: 2.5, life: 1.0 },
      ],
      message: 'Radiant energy cascades outward — {charge} charges released!',
      messageType: 'danger',
    },

    // TICK: undead sensed — vessel pulses, brief light flare
    pulse: {
      vfx: [
        { type: 'lightPulse', color: '#f6d365', radius: 3, duration: 0.25 },
        { type: 'glow', color: '#f6d365', radius: 0.8, life: 0.4 },
      ],
    },

    // TICK: stability hits zero — vessel cracks, sharp flash + text
    crack: {
      sound: 'glass_crack',
      vfx: [
        { type: 'lightPulse', color: '#ff9933', radius: 4, duration: 0.35 },
        { type: 'burst', color: '#ffb347', count: 8, speed: 0.6, life: 0.25 },
        { type: 'floatText', text: 'CRACKED', color: '#ff8844' },
      ],
    },

    // TICK: cracked vessel leaking — dim pulse each turn, fading warmth
    leak: {
      vfx: [
        { type: 'lightPulse', color: '#ffb347', radius: 2, duration: 0.2 },
        { type: 'burst', color: '#ff9933', count: 3, speed: 0.3, life: 0.15 },
      ],
    },
  },
});
