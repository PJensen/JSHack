// src/main/fx/spellAreaFx.js
// Blink, meteor, blastwave, and frost spell VFX (world-space; display-only).

import { startShake } from "../../display/camera/shake.js";
import { pathPolyline, jitterLine } from "./fxGeom.js";
import { Particle } from "../../display/passes/vfx/particles/particlePool.js";
import { RadialFx, LineFx, BlinkFx, PhaseStrikeFx } from "./fxEntries.js";

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool: { spawn(o:object):void } }, PERF: { quality: string }, getFxTime: () => number }} deps
 */
export function createSpellAreaFxController({ world, cam, fx, PERF, getFxTime }) {
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

  // --- Frost state ---
  /** @type {LineFx[]} */
  const _frostBeamFx = [];
  /** @type {RadialFx[]} */
  const _frostImpactFx = [];

  // --- Phase Strike state ---
  /** @type {PhaseStrikeFx[]} */
  const _phaseStrikeFx = [];

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
    for (let i = _frostBeamFx.length - 1; i >= 0; i--) {
      _frostBeamFx[i].tick(dt);
      if (_frostBeamFx[i].expired) _frostBeamFx.splice(i, 1);
    }
    for (let i = _frostImpactFx.length - 1; i >= 0; i--) {
      _frostImpactFx[i].tick(dt);
      if (_frostImpactFx[i].expired) _frostImpactFx.splice(i, 1);
    }
    for (let i = _phaseStrikeFx.length - 1; i >= 0; i--) {
      _phaseStrikeFx[i].tick(dt);
      if (_phaseStrikeFx[i].expired) _phaseStrikeFx.splice(i, 1);
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
      const ringA = 0.6 * (1 - t);
      ctx.strokeStyle = `rgba(180,210,255,${ringA})`;
      ctx.lineWidth = 0.12 * (1 - t * 0.7);
      ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR, 0, Math.PI * 2); ctx.stroke();
      // Inner filled disc (fades fast)
      if (t < 0.4) {
        const discA = 0.2 * (1 - t / 0.4);
        ctx.fillStyle = `rgba(220,240,255,${discA})`;
        ctx.beginPath(); ctx.arc(bw.x, bw.y, ringR * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      // Bright center flash
      if (t < 0.1) {
        const cFlashA = 0.5 * (1 - t / 0.1);
        ctx.fillStyle = `rgba(255,255,255,${cFlashA})`;
        ctx.beginPath(); ctx.arc(bw.x, bw.y, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- Draw: Frost ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawFrost(ctx) {
    if (!_frostBeamFx.length && !_frostImpactFx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Frost beam: icy ray from caster to target with jittered crystalline edges
    for (const eff of _frostBeamFx) {
      const alpha = eff.alpha;
      const pts = jitterLine(eff.from, eff.to, 14, 0.07 * alpha);

      // Outer frost glow (wide, pale cyan)
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(100,200,255,${0.15 * alpha})`;
      ctx.lineWidth = 0.25;
      pathPolyline(ctx, pts); ctx.stroke();

      // Mid icy shimmer
      ctx.strokeStyle = `rgba(150,230,255,${0.35 * alpha})`;
      ctx.lineWidth = 0.10;
      pathPolyline(ctx, pts); ctx.stroke();

      // Core (bright white-blue)
      const core = jitterLine(eff.from, eff.to, 16, 0.03 * alpha);
      ctx.strokeStyle = `rgba(220,245,255,${0.85 * alpha})`;
      ctx.lineWidth = 0.04;
      pathPolyline(ctx, core); ctx.stroke();
    }

    // Impact crystallisation: expanding hexagonal frost bloom
    for (const imp of _frostImpactFx) {
      const t = imp.progress; // 0→1 over lifetime

      // Phase 1: bright white flash on impact (first 12%)
      if (t < 0.12) {
        const flashT = t / 0.12;
        const flashR = 0.15 + flashT * 0.6;
        const flashA = 0.8 * (1 - flashT);
        ctx.fillStyle = `rgba(230,245,255,${flashA})`;
        ctx.beginPath(); ctx.arc(imp.x, imp.y, flashR, 0, Math.PI * 2); ctx.fill();
      }

      // Phase 2: expanding ice ring (cyan, sharp)
      const ringR = t * (imp.radius + 0.3);
      const ringA = 0.5 * (1 - t);
      ctx.strokeStyle = `rgba(120,210,255,${ringA})`;
      ctx.lineWidth = 0.08 * (1 - t * 0.6);
      ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();

      // Phase 3: inner frost disc (pale blue, fades fast)
      if (t < 0.5) {
        const discA = 0.18 * (1 - t / 0.5);
        ctx.fillStyle = `rgba(180,230,255,${discA})`;
        ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR * 0.55, 0, Math.PI * 2); ctx.fill();
      }

      // Phase 4: crystalline spokes (6 radial lines outward like ice cracks)
      const spokeA = 0.4 * (1 - t);
      if (spokeA > 0.01) {
        ctx.strokeStyle = `rgba(200,240,255,${spokeA})`;
        ctx.lineWidth = 0.03;
        for (let s = 0; s < 6; s++) {
          const angle = (s / 6) * Math.PI * 2 + 0.2; // slight offset for asymmetry
          const spokeLen = ringR * (0.7 + 0.3 * Math.sin(s * 1.7 + t * 4));
          ctx.beginPath();
          ctx.moveTo(imp.x, imp.y);
          ctx.lineTo(imp.x + Math.cos(angle) * spokeLen, imp.y + Math.sin(angle) * spokeLen);
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

    world.on('spell:meteor', ({ actor, origin, radius }) => {
      if (origin && Number.isFinite(origin.x)) {
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

    world.on('spell:blastwave', ({ actor, origin, knockbacks, radius }) => {
      if (origin && Number.isFinite(origin.x)) {
        _blastwaveFx.push(new RadialFx({ x: origin.x, y: origin.y, radius: radius || 2, ttl: 0.35 }));
        startShake(cam, 5, 0.22);
        // Radial particle burst
        const N = 24;
        for (let i = 0; i < N; i++) {
          const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
          const spd = 2.0 + Math.random() * 1.5;
          fx.pool.spawn(new Particle({
            x: origin.x, y: origin.y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 0.25 + Math.random() * 0.15,
            size0: 0.18, size1: 0.03,
            r: 200, g: 220, b: 255,
            a0: 0.8,
          }));
        }
      }
    });

    world.on('spell:frost', ({ actor, targetId, from, at, duration, mass, fizzle }) => {
      if (fizzle) return; // no target; skip VFX
      if (!from || !at) return;
      // Icy beam from caster → target
      _frostBeamFx.push(new LineFx({ from: { x: from.x, y: from.y }, to: { x: at.x, y: at.y }, ttl: 0.22 }));
      // Impact crystallisation burst at target
      _frostImpactFx.push(new RadialFx({ x: at.x, y: at.y, radius: 0.8, ttl: 0.55 }));
      // Light camera shake (cold snap)
      startShake(cam, 3, 0.14);
      // Ice shard particles radiating outward from impact
      const N = 20;
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = 0.6 + Math.random() * 1.8;
        const life = 0.35 + Math.random() * 0.35;
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 0.3,
          y: at.y + (Math.random() - 0.5) * 0.3,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 0.4, // slight upward drift
          ay: 0.3, // gentle downward settle
          life,
          size0: 0.12 + Math.random() * 0.10,
          size1: 0.02,
          r: 140 + (Math.random() * 60 | 0), g: 220 + (Math.random() * 35 | 0), b: 255,
          a0: 0.9,
          rot: Math.random() * Math.PI * 2,
          rotVel: (Math.random() - 0.5) * 4,
        }));
      }
      // Slow-falling snowflake motes (lingering cold)
      const M = 8;
      for (let i = 0; i < M; i++) {
        fx.pool.spawn(new Particle({
          x: at.x + (Math.random() - 0.5) * 1.2,
          y: at.y + (Math.random() - 0.5) * 0.6,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.2 + Math.random() * 0.3,
          life: 0.7 + Math.random() * 0.5,
          size0: 0.06 + Math.random() * 0.05,
          size1: 0.01,
          r: 220, g: 240, b: 255,
          a0: 0.6,
          rotVel: (Math.random() - 0.5) * 2,
        }));
      }
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
  }

  return { tick, drawBlink, drawMeteor, drawBlastwave, drawFrost, drawPhaseStrike, installListeners };
}
