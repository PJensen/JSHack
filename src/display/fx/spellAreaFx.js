// src/display/fx/spellAreaFx.js
// Blink, meteor, blastwave spell VFX (world-space; display-only).

import { startShake } from "../camera/shake.js";
import { pathPolyline, jitterLine } from "./fxGeom.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";
import { RadialFx, BlinkFx, PhaseStrikeFx, SearchPulseFx } from "./fxEntries.js";

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool: { spawn(o:object):void } }, PERF: { quality: string }, getFxTime: () => number, ftext?: { addDamage: Function, addStatus?: Function } }} deps
 */
export function createSpellAreaFxController({ world, cam, fx, PERF, getFxTime, ftext }) {
  // --- Blink state ---
  /** @type {BlinkFx[]} */
  const _blinkFx = [];

  function spawnBlinkBurst(x, y, intensity = 1) {
    const scale = PERF.quality === 'low' ? 0.7 : (PERF.quality === 'high' ? 1.2 : 1.0);
    const count = Math.max(4, Math.round((8 + intensity * 8) * scale));
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.4;
      const speed = 0.45 + Math.random() * 1.35;
      const life = 0.16 + Math.random() * 0.28;
      fx.pool.spawn(new Particle({
        x: x + (Math.random() - 0.5) * 0.12,
        y: y + (Math.random() - 0.5) * 0.12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.05,
        ay: 0.12,
        life,
        size0: 0.09 + Math.random() * 0.09,
        size1: 0.02,
        r: 130 + ((Math.random() * 50) | 0),
        g: 210 + ((Math.random() * 40) | 0),
        b: 255,
        a0: 0.92,
        rotVel: (Math.random() - 0.5) * 2.2,
      }));
    }
  }

  // --- Meteor state ---
  /** @type {RadialFx[]} */
  const _meteorFx = [];

  // --- Blastwave state ---
  /** @type {RadialFx[]} */
  const _blastwaveFx = [];

  // --- Flash Heal state ---
  /** @type {RadialFx[]} */
  const _flashHealFx = [];

  // --- Phase Strike state ---
  /** @type {PhaseStrikeFx[]} */
  const _phaseStrikeFx = [];

  // --- Smite state ---
  /** @type {RadialFx[]} */
  const _smiteFx = [];

  // --- Rampage state ---
  /** @type {RadialFx[]} */
  const _rampageFx = [];

  // --- Search pulse state ---
  /** @type {SearchPulseFx[]} */
  const _searchPulseFx = [];

  const STORM_VOLLEY_SWAY_MAX_RAD = Math.PI / 36; // +/- 5deg
  const STORM_LOCAL_SWAY_MAX_RAD = Math.PI / 60; // +/- 3deg

  function spawnStormProjectile(to, style, lane = 0, sharedSway = 0) {
    if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
    const localSway = (Math.random() - 0.5) * 2 * STORM_LOCAL_SWAY_MAX_RAD;
    const totalSway = sharedSway + localSway;
    const fallDistance = 4.2 + Math.random() * 1.4;
    const driftX = Math.tan(totalSway) * fallDistance;
    const from = {
      x: Number(to.x) + driftX + (lane * 0.18) + ((Math.random() - 0.5) * 0.24),
      y: Number(to.y) - fallDistance,
    };
    try {
      world.emit?.('projectile:spawn', {
        style,
        from,
        to: { x: Number(to.x), y: Number(to.y) },
        speed: 8,
      });
    } catch (e) { console.debug('[spellAreaFx] emit projectile:spawn failed:', e); }
  }

  function spawnMeteorProjectile(to) {
    if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
    const sway = (Math.random() - 0.5) * 2 * STORM_VOLLEY_SWAY_MAX_RAD;
    const fallDistance = 5.2 + Math.random() * 1.2;
    const driftX = Math.tan(sway) * fallDistance;
    try {
      world.emit?.('projectile:spawn', {
        style: 'fireball',
        from: {
          x: Number(to.x) + driftX + ((Math.random() - 0.5) * 0.18),
          y: Number(to.y) - fallDistance,
        },
        to: { x: Number(to.x), y: Number(to.y) },
        speed: 7,
      });
    } catch (e) { console.debug('[spellAreaFx] emit meteor projectile:spawn failed:', e); }
  }

  function stormImpactRadius(radius) {
    const base = Math.max(0.42, Number(radius || 1) * 0.48);
    return Math.min(0.72, base);
  }

  // --- Tick ---
  /** @param {number} dt */
  function tick(dt) {
    for (let i = _blinkFx.length - 1; i >= 0; i--) {
      _blinkFx[i].tick(dt);
      if (_blinkFx[i].expired) _blinkFx.splice(i, 1);
    }
    for (let i = _meteorFx.length - 1; i >= 0; i--) {
      _meteorFx[i].tick(dt);
      if (_meteorFx[i].expired) _meteorFx.splice(i, 1);
    }
    for (let i = _blastwaveFx.length - 1; i >= 0; i--) {
      _blastwaveFx[i].tick(dt);
      if (_blastwaveFx[i].expired) _blastwaveFx.splice(i, 1);
    }
    for (let i = _flashHealFx.length - 1; i >= 0; i--) {
      _flashHealFx[i].tick(dt);
      if (_flashHealFx[i].expired) _flashHealFx.splice(i, 1);
    }
    for (let i = _phaseStrikeFx.length - 1; i >= 0; i--) {
      _phaseStrikeFx[i].tick(dt);
      if (_phaseStrikeFx[i].expired) _phaseStrikeFx.splice(i, 1);
    }
    for (let i = _smiteFx.length - 1; i >= 0; i--) {
      _smiteFx[i].tick(dt);
      if (_smiteFx[i].expired) _smiteFx.splice(i, 1);
    }
    for (let i = _rampageFx.length - 1; i >= 0; i--) {
      _rampageFx[i].tick(dt);
      if (_rampageFx[i].expired) _rampageFx.splice(i, 1);
    }
    for (let i = _searchPulseFx.length - 1; i >= 0; i--) {
      _searchPulseFx[i].tick(dt);
      if (_searchPulseFx[i].expired) _searchPulseFx.splice(i, 1);
    }
  }

  // --- Draw: Blink ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawBlink(ctx) {
    if (!_blinkFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();

    for (const eff of _blinkFx) {
      const alpha = eff.alpha;
      const t = eff.progress;
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 15.0 + eff.phase);

      const dx = eff.to.x - eff.from.x;
      const dy = eff.to.y - eff.from.y;
      const dist = Math.hypot(dx, dy);
      const segments = Math.max(7, Math.min(18, Math.round(dist * 2.0)));
      const amp = (0.04 + pulse * 0.10) * alpha;
      const arc = jitterLine(eff.from, eff.to, segments, amp);

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(130,220,255,${(0.22 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.18;
      pathPolyline(ctx, arc);
      ctx.stroke();

      ctx.strokeStyle = `rgba(210,245,255,${(0.80 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.045;
      pathPolyline(ctx, jitterLine(eff.from, eff.to, segments + 2, amp * 0.55));
      ctx.stroke();

      const sparkEvery = Math.max(1, Math.floor(arc.length / 6));
      for (let i = 1; i < arc.length - 1; i += sparkEvery) {
        const p = arc[i];
        if (!p) continue;
        const size = 0.03 + pulse * 0.03;
        ctx.fillStyle = `rgba(215,250,255,${(0.55 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, TAU);
        ctx.fill();
      }

      const fromR = 0.20 + t * 0.85 + pulse * 0.05;
      const toR = 0.24 + t * 1.05 + pulse * 0.06;
      const flare = eff.randomized ? 1.2 : 1.0;

      ctx.strokeStyle = `rgba(150,220,255,${(0.65 * alpha * flare).toFixed(3)})`;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(eff.from.x, eff.from.y, fromR, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eff.to.x, eff.to.y, toR, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = `rgba(230,250,255,${(0.20 * alpha * flare).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(eff.from.x, eff.from.y, Math.max(0.05, fromR * 0.42), 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eff.to.x, eff.to.y, Math.max(0.05, toR * 0.40), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Draw: Meteor ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawMeteor(ctx) {
    if (!_meteorFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of _meteorFx) {
      const t = m.progress; // 0→1 over lifetime
      // Phase 1: bright white impact flash
      if (t < 0.15) {
        const flashT = t / 0.15;
        const flashR = 0.3 + flashT * (m.radius + 0.5);
        const flashA = 0.7 * (1 - flashT);
        ctx.fillStyle = `rgba(255,255,220,${flashA})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, flashR, 0, Math.PI * 2); ctx.fill();
      }
      // Phase 2: orange-red glow fading out
      const glowA = 0.35 * (1 - t);
      const glowR = m.radius * 0.8 + t * 0.5;
      ctx.fillStyle = `rgba(255,120,40,${glowA})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, glowR, 0, Math.PI * 2); ctx.fill();
      // Inner hot core
      const coreA = 0.25 * (1 - t * t);
      ctx.fillStyle = `rgba(255,200,100,${coreA})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, glowR * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // --- Draw: Blastwave ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawBlastwave(ctx) {
    if (!_blastwaveFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bw of _blastwaveFx) {
      const t = bw.progress; // 0→1
      // Expanding ring
      const ringR = t * (bw.radius + 0.5);
      const ringA = 0.8 * (1 - t * 0.55);
      ctx.strokeStyle = `rgba(215,235,255,${ringA})`;
      ctx.lineWidth = Math.max(0.12, 0.32 * (1 - t * 0.68));
      ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(140,190,255,${(ringA * 0.65).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.06, 0.14 * (1 - t * 0.55));
      ctx.beginPath(); ctx.arc(bw.x, bw.y, Math.max(0, ringR - 0.28), 0, Math.PI * 2); ctx.stroke();
      // Inner filled disc (fades fast)
      if (t < 0.55) {
        const discA = 0.26 * (1 - t / 0.55);
        ctx.fillStyle = `rgba(220,240,255,${discA})`;
        ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR * 0.68, 0, Math.PI * 2); ctx.fill();
      }
      // Bright center flash
      if (t < 0.16) {
        const cFlashA = 0.7 * (1 - t / 0.16);
        ctx.fillStyle = `rgba(255,255,255,${cFlashA})`;
        ctx.beginPath(); ctx.arc(bw.x, bw.y, 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Draw: Flash Heal ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawFlashHeal(ctx) {
    if (!_flashHealFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();
    for (const eff of _flashHealFx) {
      const t = eff.progress;
      const alpha = eff.alpha;
      const pulse = 0.55 + 0.45 * Math.sin(_fxTime * 13.0 + eff.x * 0.7 + eff.y * 0.4);
      const maxR = Number.isFinite(eff.radius) ? Math.max(0.9, eff.radius) : 1.4;

      if (t < 0.22) {
        const ft = t / 0.22;
        const flashR = 0.20 + ft * (maxR * 0.75);
        const flashA = 0.85 * (1 - ft) * alpha;
        ctx.fillStyle = `rgba(255,255,235,${flashA.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(eff.x, eff.y, flashR, 0, TAU);
        ctx.fill();
      }

      const ringR = 0.20 + t * maxR;
      ctx.strokeStyle = `rgba(255,245,190,${(0.85 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.12 * (1 - t * 0.55);
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, ringR, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255,255,230,${(0.62 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.065;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, ringR * (1.35 + pulse * 0.12), 0, TAU);
      ctx.stroke();

      const glowR = 0.20 + t * (maxR * 0.55) + pulse * 0.06;
      ctx.fillStyle = `rgba(255,240,170,${(0.32 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, glowR, 0, TAU);
      ctx.fill();

      const spokeA = 0.42 * (1 - t) * alpha;
      if (spokeA > 0.02) {
        ctx.strokeStyle = `rgba(255,250,210,${spokeA.toFixed(3)})`;
        ctx.lineWidth = 0.04;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + pulse * 0.08;
          const len = ringR * (0.55 + 0.25 * pulse);
          ctx.beginPath();
          ctx.moveTo(eff.x, eff.y);
          ctx.lineTo(eff.x + Math.cos(a) * len, eff.y + Math.sin(a) * len);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // --- Draw: Phase Strike ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawPhaseStrike(ctx) {
    if (!_phaseStrikeFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();

    for (const eff of _phaseStrikeFx) {
      const alpha = eff.alpha;
      const t = eff.progress;
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 18.0 + eff.phase);

      const dx = eff.to.x - eff.from.x;
      const dy = eff.to.y - eff.from.y;
      const dist = Math.hypot(dx, dy);
      const segments = Math.max(7, Math.min(18, Math.round(dist * 2.0)));
      const amp = (0.06 + pulse * 0.12) * alpha;
      const arc = jitterLine(eff.from, eff.to, segments, amp);

      // Outer violet glow trail
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(180,100,255,${(0.28 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.22;
      pathPolyline(ctx, arc);
      ctx.stroke();

      // Inner bright violet-white core
      ctx.strokeStyle = `rgba(230,180,255,${(0.85 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.05;
      pathPolyline(ctx, jitterLine(eff.from, eff.to, segments + 2, amp * 0.5));
      ctx.stroke();

      // Sparks along the arc
      const sparkEvery = Math.max(1, Math.floor(arc.length / 6));
      for (let i = 1; i < arc.length - 1; i += sparkEvery) {
        const p = arc[i];
        if (!p) continue;
        const size = 0.035 + pulse * 0.035;
        ctx.fillStyle = `rgba(220,170,255,${(0.6 * alpha).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, TAU);
        ctx.fill();
      }

      // Portal rings at origin and destination (purple)
      const fromR = 0.20 + t * 0.85 + pulse * 0.05;
      const toR = 0.24 + t * 1.05 + pulse * 0.06;

      ctx.strokeStyle = `rgba(160,80,255,${(0.65 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(eff.from.x, eff.from.y, fromR, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eff.to.x, eff.to.y, toR, 0, TAU);
      ctx.stroke();

      // Inner portal disc fill
      ctx.fillStyle = `rgba(200,140,255,${(0.20 * alpha).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(eff.from.x, eff.from.y, Math.max(0.05, fromR * 0.42), 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eff.to.x, eff.to.y, Math.max(0.05, toR * 0.40), 0, TAU);
      ctx.fill();

      // Impact flashes at each hit enemy position
      for (const h of eff.hits) {
        const flashR = 0.15 + t * 0.55 + pulse * 0.08;
        const flashA = 0.7 * alpha;
        // Bright violet-white flash
        ctx.fillStyle = `rgba(240,200,255,${(flashA * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(h.x, h.y, flashR * 0.5, 0, TAU);
        ctx.fill();
        // Expanding impact ring
        ctx.strokeStyle = `rgba(200,100,255,${(flashA * 0.6).toFixed(3)})`;
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.arc(h.x, h.y, flashR, 0, TAU);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // --- Draw: Smite ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawSmite(ctx) {
    if (!_smiteFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    for (const eff of _smiteFx) {
      const t = eff.progress; // 0→1
      const alpha = eff.alpha;
      // Vertical beam (descends from above, narrows as it fades)
      const beamH = 3.5;
      const beamTopY = eff.y - beamH;
      const beamW = Math.max(0.02, 0.28 * (1 - t * 0.7));
      const beamA = 0.75 * alpha;
      const grad = ctx.createLinearGradient(eff.x, beamTopY, eff.x, eff.y);
      grad.addColorStop(0, `rgba(255,255,220,0)`);
      grad.addColorStop(0.4, `rgba(255,230,140,${(beamA * 0.5).toFixed(3)})`);
      grad.addColorStop(1, `rgba(255,220,80,${beamA.toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(eff.x - beamW, beamTopY, beamW * 2, beamH);
      // Outer beam glow (wider, softer)
      const outerW = beamW * 3;
      const outerGrad = ctx.createLinearGradient(eff.x, beamTopY, eff.x, eff.y);
      outerGrad.addColorStop(0, `rgba(255,240,180,0)`);
      outerGrad.addColorStop(0.5, `rgba(255,220,120,${(beamA * 0.15).toFixed(3)})`);
      outerGrad.addColorStop(1, `rgba(255,200,60,${(beamA * 0.3).toFixed(3)})`);
      ctx.fillStyle = outerGrad;
      ctx.fillRect(eff.x - outerW, beamTopY, outerW * 2, beamH);
      // Impact flash (bright white-gold at target)
      if (t < 0.25) {
        const flashT = t / 0.25;
        const flashR = 0.15 + flashT * 0.65;
        const flashA = 0.85 * (1 - flashT);
        ctx.fillStyle = `rgba(255,255,230,${flashA.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(eff.x, eff.y, flashR, 0, TAU); ctx.fill();
      }
      // Expanding golden ring
      const ringR = 0.1 + t * 1.2;
      ctx.strokeStyle = `rgba(255,220,80,${(0.7 * alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.04, 0.16 * (1 - t * 0.6));
      ctx.beginPath(); ctx.arc(eff.x, eff.y, ringR, 0, TAU); ctx.stroke();
      // Inner golden glow disc
      const glowR = 0.15 + t * 0.5;
      ctx.fillStyle = `rgba(255,210,80,${(0.25 * alpha).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(eff.x, eff.y, glowR, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // --- Draw: Rampage ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawRampage(ctx) {
    if (!_rampageFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();
    for (const eff of _rampageFx) {
      const t = eff.progress;
      const alpha = eff.alpha;
      // Inner blood-red flash
      if (t < 0.3) {
        const ft = t / 0.3;
        const flashR = 0.2 + ft * 1.0;
        const flashA = 0.8 * (1 - ft) * alpha;
        ctx.fillStyle = `rgba(255,40,20,${flashA.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(eff.x, eff.y, flashR, 0, TAU); ctx.fill();
      }
      // Expanding rage ring
      const ringR = 0.15 + t * 1.6;
      ctx.strokeStyle = `rgba(255,80,20,${(0.7 * alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.04, 0.2 * (1 - t * 0.6));
      ctx.beginPath(); ctx.arc(eff.x, eff.y, ringR, 0, TAU); ctx.stroke();
      // Outer pulsing orange glow
      const pulse = 0.6 + 0.4 * Math.sin(_fxTime * 16 + eff.x * 0.5);
      const glowR = 0.3 + t * 0.8;
      ctx.fillStyle = `rgba(255,100,20,${(0.2 * alpha * pulse).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(eff.x, eff.y, glowR, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // --- Draw: Search Pulse ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawSearchPulse(ctx) {
    if (!_searchPulseFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    for (const eff of _searchPulseFx) {
      const t = eff.progress; // 0→1
      const alpha = eff.alpha;
      // Thin off-white expanding ring: grows from origin to full radius
      const ringR = t * eff.radius;
      const ringA = 0.55 * alpha;          // peak opacity ≈0.55, fades with alpha
      ctx.strokeStyle = `rgba(230,245,255,${ringA.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.02, 0.035 * (1 - t * 0.7)); // starts thin, narrows as it expands
      ctx.beginPath(); ctx.arc(eff.x, eff.y, ringR, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // --- Listeners ---
  function installListeners() {
    world.on('spell:blink', ({ from, to, randomized }) => {
      if (!from || !to) return;
      if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
      if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;

      const src = { x: from.x, y: from.y };
      const dst = { x: to.x, y: to.y };
      _blinkFx.push(new BlinkFx({
        from: src,
        to: dst,
        ttl: 0.26,
        phase: Math.random() * Math.PI * 2,
        randomized: !!randomized,
      }));

      const intensity = randomized ? 1.15 : 1.0;
      spawnBlinkBurst(src.x, src.y, intensity);
      spawnBlinkBurst(dst.x, dst.y, intensity);

      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const dist = Math.hypot(dx, dy);
      const sparkleCount = Math.max(6, Math.min(22, Math.round(dist * 1.8)));
      const sparkScale = PERF.quality === 'low' ? 0.6 : 1.0;
      const sparkleCountScaled = Math.max(4, Math.round(sparkleCount * sparkScale));
      for (let i = 0; i < sparkleCountScaled; i++) {
        const t = (i + Math.random()) / Math.max(1, sparkleCountScaled);
        const x = src.x + dx * t + (Math.random() - 0.5) * 0.18;
        const y = src.y + dy * t + (Math.random() - 0.5) * 0.18;
        fx.pool.spawn(new Particle({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          ay: 0.04,
          life: 0.10 + Math.random() * 0.20,
          size0: 0.05 + Math.random() * 0.04,
          size1: 0.01,
          r: 190 + ((Math.random() * 40) | 0),
          g: 235 + ((Math.random() * 20) | 0),
          b: 255,
          a0: 0.7,
        }));
      }

      startShake(cam, randomized ? 4 : 3, randomized ? 0.14 : 0.12);
    });

    world.on('spell:meteor', ({ actor, from, origin, radius }) => {
      if (origin && Number.isFinite(origin.x)) {
        spawnMeteorProjectile(origin);
        _meteorFx.push(new RadialFx({ x: origin.x, y: origin.y, radius: radius || 2, ttl: 0.45 }));
        startShake(cam, 7, 0.30);
        // Fire particle burst
        const N = 30;
        for (let i = 0; i < N; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 1.0 + Math.random() * 2.5;
          const life = 0.3 + Math.random() * 0.4;
          fx.pool.spawn(new Particle({
            x: origin.x + (Math.random() - 0.5) * 0.4,
            y: origin.y + (Math.random() - 0.5) * 0.4,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            ay: 0.8,
            life,
            size0: 0.25 + Math.random() * 0.15,
            size1: 0.04,
            r: 255, g: 140 + Math.random() * 80 | 0, b: 30,
            a0: 0.95,
          }));
        }
      }
    });

    world.on('spell:blizzard', ({ impacts }) => {
      if (!Array.isArray(impacts) || impacts.length <= 0) return;
      const volleySway = (Math.random() - 0.5) * 2 * STORM_VOLLEY_SWAY_MAX_RAD;
      for (let i = 0; i < impacts.length; i++) {
        const impact = impacts[i];
        if (!impact || !Number.isFinite(impact.x) || !Number.isFinite(impact.y)) continue;
        spawnStormProjectile(impact, 'frostbolt', (i % 3) - 1, volleySway);
        _blastwaveFx.push(new RadialFx({
          x: Number(impact.x),
          y: Number(impact.y),
          radius: stormImpactRadius(impact.radius),
          ttl: 0.14,
        }));
        for (let j = 0; j < 5; j++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.18 + Math.random() * 0.45;
          fx.pool.spawn(new Particle({
            x: Number(impact.x) + (Math.random() - 0.5) * 0.18,
            y: Number(impact.y) + (Math.random() - 0.5) * 0.12,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.05,
            ay: 0.18,
            life: 0.12 + Math.random() * 0.08,
            size0: 0.04 + Math.random() * 0.025,
            size1: 0.02,
            r: 190,
            g: 225 + ((Math.random() * 20) | 0),
            b: 255,
            a0: 0.82,
          }));
        }
      }
      startShake(cam, 2, 0.08);
    });

    world.on('spell:firestorm', ({ impacts }) => {
      if (!Array.isArray(impacts) || impacts.length <= 0) return;
      const volleySway = (Math.random() - 0.5) * 2 * STORM_VOLLEY_SWAY_MAX_RAD;
      for (let i = 0; i < impacts.length; i++) {
        const impact = impacts[i];
        if (!impact || !Number.isFinite(impact.x) || !Number.isFinite(impact.y)) continue;
        spawnStormProjectile(impact, 'fireball', (i % 3) - 1, volleySway);
        _meteorFx.push(new RadialFx({
          x: Number(impact.x),
          y: Number(impact.y),
          radius: stormImpactRadius(impact.radius),
          ttl: 0.16,
        }));
        for (let j = 0; j < 6; j++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.2 + Math.random() * 0.6;
          fx.pool.spawn(new Particle({
            x: Number(impact.x) + (Math.random() - 0.5) * 0.16,
            y: Number(impact.y) + (Math.random() - 0.5) * 0.10,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.08,
            ay: 0.22,
            life: 0.12 + Math.random() * 0.10,
            size0: 0.05 + Math.random() * 0.03,
            size1: 0.02,
            r: 255,
            g: 110 + ((Math.random() * 80) | 0),
            b: 40,
            a0: 0.88,
          }));
        }
      }
      startShake(cam, 3, 0.1);
    });

    world.on('spell:blastwave', ({ actor, origin, knockbacks, radius }) => {
      if (origin && Number.isFinite(origin.x)) {
        const waveRadius = Math.max(2, Number(radius) || 2);
        const ttl = Math.max(0.45, Math.min(1.6, 0.24 + waveRadius * 0.06));
        _blastwaveFx.push(new RadialFx({ x: origin.x, y: origin.y, radius: waveRadius, ttl }));
        if (waveRadius >= 6) {
          _blastwaveFx.push(new RadialFx({ x: origin.x, y: origin.y, radius: Math.max(2, waveRadius * 0.8), ttl: ttl * 0.86 }));
        }
        if (waveRadius >= 10) {
          _blastwaveFx.push(new RadialFx({ x: origin.x, y: origin.y, radius: Math.max(2, waveRadius * 0.58), ttl: ttl * 0.72 }));
        }
        startShake(cam, Math.min(14, 5 + Math.floor(waveRadius / 2)), Math.min(0.55, 0.18 + waveRadius * 0.015));
        // Radial particle burst
        const N = waveRadius >= 10 ? 40 : (waveRadius >= 6 ? 32 : 24);
        for (let i = 0; i < N; i++) {
          const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
          const spd = 2.0 + Math.random() * Math.max(1.5, waveRadius * 0.2);
          fx.pool.spawn(new Particle({
            x: origin.x, y: origin.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 0.3 + Math.random() * 0.22,
            size0: 0.18 + Math.random() * 0.06, size1: 0.03,
            r: 210, g: 225, b: 255,
            a0: 0.85,
          }));
        }
      }
    });

    // Frost + Shadow bolt VFX are handled by projectileFx (projectile style).

    world.on('spell:flash_heal', ({ at, amount }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _flashHealFx.push(new RadialFx({ x: at.x, y: at.y, radius: 1.5, ttl: 0.44 }));
      const scale = PERF.quality === 'low' ? 0.7 : (PERF.quality === 'high' ? 1.25 : 1.0);
      const sparkleCount = Math.max(14, Math.round(30 * scale));
      for (let i = 0; i < sparkleCount; i++) {
        const angle = (Math.PI * 2 * i / sparkleCount) + (Math.random() - 0.5) * 0.55;
        const speed = 0.45 + Math.random() * 1.25;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.16,
          y: at.y + (Math.random() - 0.5) * 0.16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.16,
          ay: 0.18,
          life: 0.28 + Math.random() * 0.40,
          size0: 0.11 + Math.random() * 0.09,
          size1: 0.02,
          r: 250 + ((Math.random() * 5) | 0),
          g: 230 + ((Math.random() * 20) | 0),
          b: 170 + ((Math.random() * 35) | 0),
          a0: 0.92,
          rot: Math.random() * Math.PI * 2,
          rotVel: (Math.random() - 0.5) * 2.4,
        }));
      }
      const shimmerCount = Math.max(5, Math.round(10 * scale));
      for (let i = 0; i < shimmerCount; i++) {
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 1.0,
          y: at.y + (Math.random() - 0.5) * 0.7,
          vx: (Math.random() - 0.5) * 0.25,
          vy: 0.10 + Math.random() * 0.24,
          ay: 0.03,
          life: 0.60 + Math.random() * 0.45,
          size0: 0.06 + Math.random() * 0.05,
          size1: 0.01,
          r: 255,
          g: 245,
          b: 205,
          a0: 0.55,
          rotVel: (Math.random() - 0.5) * 1.8,
        }));
      }
      startShake(cam, Number(amount || 0) > 0 ? 3 : 2, 0.12);
    });

    world.on('spell:smite', ({ actor, targetId, at, amount, missed, fizzle }) => {
      if (fizzle) return;
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _smiteFx.push(new RadialFx({ x: at.x, y: at.y, radius: 1.2, ttl: 0.42 }));
      // Golden radial particle burst
      const scale = PERF.quality === 'low' ? 0.65 : (PERF.quality === 'high' ? 1.25 : 1.0);
      const burstCount = Math.max(10, Math.round(20 * scale));
      for (let i = 0; i < burstCount; i++) {
        const angle = (Math.PI * 2 * i / burstCount) + (Math.random() - 0.5) * 0.5;
        const speed = 0.6 + Math.random() * 1.4;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.14,
          y: at.y + (Math.random() - 0.5) * 0.14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.3,
          ay: 0.2,
          life: 0.25 + Math.random() * 0.35,
          size0: 0.12 + Math.random() * 0.08,
          size1: 0.02,
          r: 255,
          g: 220 + ((Math.random() * 35) | 0),
          b: 60 + ((Math.random() * 60) | 0),
          a0: 0.92,
          rotVel: (Math.random() - 0.5) * 2.0,
        }));
      }
      // Rising motes (holy sparkles drifting upward)
      const moteCount = Math.max(6, Math.round(12 * scale));
      for (let i = 0; i < moteCount; i++) {
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.8,
          y: at.y + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -(0.15 + Math.random() * 0.35),
          ay: -0.02,
          life: 0.5 + Math.random() * 0.5,
          size0: 0.06 + Math.random() * 0.04,
          size1: 0.01,
          r: 255,
          g: 250,
          b: 200,
          a0: 0.6,
          rotVel: (Math.random() - 0.5) * 1.5,
        }));
      }
      startShake(cam, 4, 0.14);
    });

    world.on('spell:phase_strike', ({ from, to, hits, randomized }) => {
      if (!from || !to) return;
      if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) return;
      if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;

      const src = { x: from.x, y: from.y };
      const dst = { x: to.x, y: to.y };
      const hitPositions = Array.isArray(hits) ? hits.map(h => ({ x: h.x, y: h.y })) : [];

      _phaseStrikeFx.push(new PhaseStrikeFx({
        from: src,
        to: dst,
        hits: hitPositions,
        ttl: 0.32,
        phase: Math.random() * Math.PI * 2,
      }));

      // Purple particle burst at source and destination
      const scale = PERF.quality === 'low' ? 0.7 : (PERF.quality === 'high' ? 1.2 : 1.0);
      const burstCount = Math.max(4, Math.round(12 * scale));
      for (const pos of [src, dst]) {
        for (let i = 0; i < burstCount; i++) {
          const angle = (Math.PI * 2 * i / burstCount) + (Math.random() - 0.5) * 0.4;
          const speed = 0.5 + Math.random() * 1.4;
          fx.pool.spawn(new Particle({
            x: pos.x + (Math.random() - 0.5) * 0.12,
            y: pos.y + (Math.random() - 0.5) * 0.12,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.05,
            ay: 0.12,
            life: 0.18 + Math.random() * 0.26,
            size0: 0.10 + Math.random() * 0.09,
            size1: 0.02,
            r: 180 + ((Math.random() * 50) | 0),
            g: 80 + ((Math.random() * 60) | 0),
            b: 255,
            a0: 0.92,
            rotVel: (Math.random() - 0.5) * 2.2,
          }));
        }
      }

      // Violet sparkle trail along the path
      const pdx = dst.x - src.x;
      const pdy = dst.y - src.y;
      const dist = Math.hypot(pdx, pdy);
      const sparkleCount = Math.max(6, Math.min(22, Math.round(dist * 1.8)));
      const sparkScale = PERF.quality === 'low' ? 0.6 : 1.0;
      const sparkleCountScaled = Math.max(4, Math.round(sparkleCount * sparkScale));
      for (let i = 0; i < sparkleCountScaled; i++) {
        const t = (i + Math.random()) / Math.max(1, sparkleCountScaled);
        fx.pool.spawn(new Particle({
          x: src.x + pdx * t + (Math.random() - 0.5) * 0.18,
          y: src.y + pdy * t + (Math.random() - 0.5) * 0.18,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          ay: 0.04,
          life: 0.12 + Math.random() * 0.22,
          size0: 0.05 + Math.random() * 0.04,
          size1: 0.01,
          r: 210 + ((Math.random() * 30) | 0),
          g: 160 + ((Math.random() * 40) | 0),
          b: 255,
          a0: 0.75,
        }));
      }

      // Violet impact bursts at each hit enemy
      for (const h of hitPositions) {
        const impactCount = Math.max(3, Math.round(8 * scale));
        for (let i = 0; i < impactCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.8 + Math.random() * 1.6;
          fx.pool.spawn(new Particle({
            x: h.x + (Math.random() - 0.5) * 0.15,
            y: h.y + (Math.random() - 0.5) * 0.15,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ay: 0.2,
            life: 0.14 + Math.random() * 0.20,
            size0: 0.12 + Math.random() * 0.08,
            size1: 0.02,
            r: 220 + ((Math.random() * 35) | 0),
            g: 120 + ((Math.random() * 60) | 0),
            b: 255,
            a0: 0.95,
            rot: Math.random() * Math.PI * 2,
            rotVel: (Math.random() - 0.5) * 3,
          }));
        }
      }

      startShake(cam, 5, 0.18);
    });

    world.on('spell:rampage', ({ at }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _rampageFx.push(new RadialFx({ x: at.x, y: at.y, radius: 1.8, ttl: 0.5 }));
      // Red/orange particle burst
      const scale = PERF.quality === 'low' ? 0.65 : (PERF.quality === 'high' ? 1.25 : 1.0);
      const burstCount = Math.max(12, Math.round(24 * scale));
      for (let i = 0; i < burstCount; i++) {
        const angle = (Math.PI * 2 * i / burstCount) + (Math.random() - 0.5) * 0.5;
        const speed = 0.7 + Math.random() * 1.6;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.14,
          y: at.y + (Math.random() - 0.5) * 0.14,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.2,
          ay: 0.15,
          life: 0.22 + Math.random() * 0.35,
          size0: 0.13 + Math.random() * 0.09,
          size1: 0.02,
          r: 255,
          g: 50 + ((Math.random() * 60) | 0),
          b: 10 + ((Math.random() * 30) | 0),
          a0: 0.95,
          rotVel: (Math.random() - 0.5) * 2.5,
        }));
      }
      // Rising rage embers
      const emberCount = Math.max(6, Math.round(14 * scale));
      for (let i = 0; i < emberCount; i++) {
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.9,
          y: at.y + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -(0.2 + Math.random() * 0.5),
          ay: -0.03,
          life: 0.5 + Math.random() * 0.5,
          size0: 0.07 + Math.random() * 0.05,
          size1: 0.01,
          r: 255,
          g: 120 + ((Math.random() * 80) | 0),
          b: 20,
          a0: 0.7,
          rotVel: (Math.random() - 0.5) * 2.0,
        }));
      }
      startShake(cam, 4, 0.16);
    });

    world.on('spell:verdant_ward', ({ at }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _flashHealFx.push(new RadialFx({ x: at.x, y: at.y, radius: 1.4, ttl: 0.5 }));
      const count = PERF.quality === 'low' ? 12 : 20;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 0.7;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.2,
          y: at.y + (Math.random() - 0.5) * 0.2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.18,
          ay: -0.02,
          life: 0.35 + Math.random() * 0.35,
          size0: 0.08 + Math.random() * 0.05,
          size1: 0.02,
          r: 100 + ((Math.random() * 40) | 0),
          g: 180 + ((Math.random() * 70) | 0),
          b: 90 + ((Math.random() * 40) | 0),
          a0: 0.85,
          rotVel: (Math.random() - 0.5) * 1.2,
        }));
      }
      startShake(cam, 2, 0.08);
    });

    world.on('spell:harmony_ward', ({ at }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _smiteFx.push(new RadialFx({ x: at.x, y: at.y, radius: 1.25, ttl: 0.46 }));
      const count = PERF.quality === 'low' ? 14 : 24;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i / Math.max(1, count)) + (Math.random() - 0.5) * 0.45;
        const speed = 0.22 + Math.random() * 0.85;
        const warm = (i % 2) === 0;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.18,
          y: at.y + (Math.random() - 0.5) * 0.18,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ay: 0.03,
          life: 0.28 + Math.random() * 0.32,
          size0: 0.08 + Math.random() * 0.04,
          size1: 0.02,
          r: warm ? 250 : 110,
          g: warm ? 220 : 210,
          b: warm ? 90 : 255,
          a0: 0.82,
        }));
      }
      startShake(cam, 2, 0.08);
    });

    world.on('spell:shadow_veil', ({ at }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      _blinkFx.push(new BlinkFx({
        from: { x: at.x, y: at.y },
        to: { x: at.x, y: at.y },
        ttl: 0.34,
        phase: Math.random() * Math.PI * 2,
        randomized: false,
      }));
      const count = PERF.quality === 'low' ? 12 : 20;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.12 + Math.random() * 0.45;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.26,
          y: at.y + (Math.random() - 0.5) * 0.26,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.06,
          ay: -0.01,
          life: 0.30 + Math.random() * 0.38,
          size0: 0.06 + Math.random() * 0.04,
          size1: 0.01,
          r: 165 + ((Math.random() * 35) | 0),
          g: 85 + ((Math.random() * 35) | 0),
          b: 220 + ((Math.random() * 35) | 0),
          a0: 0.72,
          rotVel: (Math.random() - 0.5) * 1.6,
        }));
      }
      startShake(cam, 1, 0.05);
    });

    world.on('spell:earthshatter', ({ origin, radius, enhanced }) => {
      if (!origin || !Number.isFinite(origin.x) || !Number.isFinite(origin.y)) return;
      const r = Math.max(1, Number(radius || 1));
      // Radial dust/rock particle burst.
      const N = enhanced ? 28 : 20;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = 1.2 + Math.random() * Math.max(0.8, r * 0.4);
        const rr = enhanced ? 200 + ((Math.random() * 55) | 0) : 140 + ((Math.random() * 60) | 0);
        const gg = enhanced ? 90 + ((Math.random() * 60) | 0) : 115 + ((Math.random() * 50) | 0);
        const bb = enhanced ? 15 + ((Math.random() * 20) | 0) : 70 + ((Math.random() * 40) | 0);
        fx.pool.spawn(new Particle({
          x: origin.x, y: origin.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 0.28 + Math.random() * 0.22,
          size0: 0.14 + Math.random() * 0.06, size1: 0.03,
          r: rr, g: gg, b: bb,
          a0: 0.82,
        }));
      }
      if (enhanced) {
        // Extra ember burst for volcanic variant.
        for (let i = 0; i < 12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 0.6 + Math.random() * 1.0;
          fx.pool.spawn(new Particle({
            x: origin.x + (Math.random() - 0.5) * 0.3,
            y: origin.y + (Math.random() - 0.5) * 0.3,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 0.3,
            ay: 0.10,
            life: 0.20 + Math.random() * 0.16,
            size0: 0.08 + Math.random() * 0.04, size1: 0.02,
            r: 255, g: 150 + ((Math.random() * 80) | 0), b: 20 + ((Math.random() * 30) | 0),
            a0: 0.90,
          }));
        }
      }
      startShake(cam, enhanced ? 6 : 4, enhanced ? 0.20 : 0.14);
    });

    world.on('search:pulse', ({ at, radius }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      const r = Math.max(1, Number(radius || 6));
      _searchPulseFx.push(new SearchPulseFx({ x: at.x, y: at.y, radius: r, ttl: 0.38 }));
    });
  }

  return { tick, drawBlink, drawMeteor, drawBlastwave, drawFlashHeal, drawSmite, drawPhaseStrike, drawRampage, drawSearchPulse, installListeners };
}
