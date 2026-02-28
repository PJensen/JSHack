// src/display/fx/cloudFx.js
// Plasma cloud, poison cloud, and bubble pop VFX (world-space; display-only).

import { startShake } from "../camera/shake.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";
import { BubblePopFx } from "./fxEntries.js";

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool: { spawn(o:object):void } }, getFxTime: () => number, getPosition: (id:number) => ({x:number,y:number}|null) }} deps
 */
export function createCloudFxController({ world, cam, fx, getFxTime, getPosition }) {
  /** @type {Map<number, { x:number, y:number, radius:number, turnsLeft:number, maxTurns:number, flash:number, phase:number, fading:boolean, fadeLeft:number, fadeMax:number }>} */
  const _plasmaCloudFx = new Map();
  /** @type {Map<number, { x:number, y:number, radius:number, turnsLeft:number, maxTurns:number, pulseFlash:number, phase:number, fading:boolean, fadeLeft:number, fadeMax:number, medium:string, bubbleClock:number }>} */
  const _poisonCloudFx = new Map();
  /** @type {BubblePopFx[]} */
  const _poisonBubblePops = [];

  // --- Particle helpers ---
  function spawnPlasmaCloudSparks(x, y, count = 8) {
    if (!fx?.pool) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      fx.pool.spawn(new Particle({
        x: x + (Math.random() - 0.5) * 0.35,
        y: y + (Math.random() - 0.5) * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.22 + Math.random() * 0.18,
        size0: 0.09 + Math.random() * 0.06,
        size1: 0.02,
        r: 170 + ((Math.random() * 60) | 0),
        g: 235 + ((Math.random() * 20) | 0),
        b: 255,
        a0: 0.9,
      }));
    }
  }

  function spawnPoisonCloudMotes(x, y, count = 8) {
    if (!fx?.pool) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.12 + Math.random() * 0.45;
      fx.pool.spawn(new Particle({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (0.08 + Math.random() * 0.12),
        ay: -0.03,
        life: 0.50 + Math.random() * 0.30,
        size0: 0.09 + Math.random() * 0.05,
        size1: 0.03,
        r: 120 + ((Math.random() * 50) | 0),
        g: 205 + ((Math.random() * 45) | 0),
        b: 90 + ((Math.random() * 40) | 0),
        a0: 0.52,
        rotVel: (Math.random() - 0.5) * 0.9,
      }));
    }
  }

  /**
   * Choose a bubbling point within a cloud's Chebyshev footprint.
   * @param {{x:number, y:number, radius:number}} cloud
   */
  function randomPoisonBubblePoint(cloud) {
    const r = Math.max(0, Number(cloud?.radius || 0) | 0);
    if (r <= 0) {
      return {
        x: cloud.x + (Math.random() - 0.5) * 0.28,
        y: cloud.y + (Math.random() - 0.5) * 0.28,
      };
    }
    const ox = (Math.random() * (r * 2 + 1) - r) + (Math.random() - 0.5) * 0.25;
    const oy = (Math.random() * (r * 2 + 1) - r) + (Math.random() - 0.5) * 0.25;
    return { x: cloud.x + ox, y: cloud.y + oy };
  }

  function spawnPoisonBubblePop(x, y, strength = 1) {
    const s = Math.max(1, Number(strength || 1) | 0);

    if (fx?.pool) {
      const count = 2 + s;
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1; // mostly upward
        const speed = 0.08 + Math.random() * 0.24;
        fx.pool.spawn(new Particle({
          x: x + (Math.random() - 0.5) * 0.12,
          y: y + (Math.random() - 0.5) * 0.08,
          vx: Math.cos(angle) * speed * 0.6,
          vy: Math.sin(angle) * speed - 0.04,
          ay: -0.04,
          life: 0.18 + Math.random() * 0.20,
          size0: 0.05 + Math.random() * 0.04,
          size1: 0.01,
          r: 170 + ((Math.random() * 45) | 0),
          g: 240 + ((Math.random() * 15) | 0),
          b: 150 + ((Math.random() * 40) | 0),
          a0: 0.48,
          rotVel: (Math.random() - 0.5) * 0.6,
        }));
      }
    }

    const pops = 1 + ((Math.random() < 0.35 * s) ? 1 : 0);
    for (let i = 0; i < pops; i++) {
      _poisonBubblePops.push(new BubblePopFx({
        x: x + (Math.random() - 0.5) * 0.10,
        y: y + (Math.random() - 0.5) * 0.08,
        ttl: 0.28 + Math.random() * 0.22,
        r0: 0.02 + Math.random() * 0.04,
        r1: 0.15 + Math.random() * 0.10,
        rise: 0.08 + Math.random() * 0.10,
        phase: Math.random() * Math.PI * 2,
      }));
    }
  }

  // --- Tick ---
  /** @param {number} dt */
  function tick(dt) {
    // Plasma clouds
    for (const [cloudId, cloud] of _plasmaCloudFx) {
      cloud.flash = Math.max(0, cloud.flash - dt);
      if (cloud.fading) {
        cloud.fadeLeft = Math.max(0, cloud.fadeLeft - dt);
        if (cloud.fadeLeft <= 0) {
          _plasmaCloudFx.delete(cloudId);
        }
        continue;
      }
      // Safety net: if entity is gone but we missed expired event, start a soft fade.
      if (!world.isAlive(cloudId)) {
        cloud.fading = true;
        cloud.fadeMax = 0.35;
        cloud.fadeLeft = Math.max(cloud.fadeLeft, cloud.fadeMax);
        cloud.flash = Math.max(cloud.flash, 0.12);
      }
    }

    // Poison clouds
    for (const [hazardId, cloud] of _poisonCloudFx) {
      cloud.pulseFlash = Math.max(0, cloud.pulseFlash - dt);
      cloud.bubbleClock = Number.isFinite(cloud.bubbleClock)
        ? Number(cloud.bubbleClock)
        : (0.08 + Math.random() * 0.16);

      if (!cloud.fading) {
        cloud.bubbleClock -= dt;
        while (cloud.bubbleClock <= 0) {
          const p = randomPoisonBubblePoint(cloud);
          const dense = cloud.medium === 'floor';
          const strength = (dense && Math.random() < 0.32) ? 2 : 1;
          spawnPoisonBubblePop(p.x, p.y, strength);
          cloud.bubbleClock += (dense ? 0.10 : 0.15) + Math.random() * (dense ? 0.12 : 0.18);
        }
      }

      if (cloud.fading) {
        cloud.fadeLeft = Math.max(0, cloud.fadeLeft - dt);
        if (cloud.fadeLeft <= 0) {
          _poisonCloudFx.delete(hazardId);
        }
        continue;
      }
      if (!world.isAlive(hazardId)) {
        cloud.fading = true;
        cloud.fadeMax = 0.45;
        cloud.fadeLeft = Math.max(cloud.fadeLeft, cloud.fadeMax);
        cloud.pulseFlash = Math.max(cloud.pulseFlash, 0.10);
      }
    }

    // Bubble pops
    for (let i = _poisonBubblePops.length - 1; i >= 0; i--) {
      _poisonBubblePops[i].tick(dt);
      if (_poisonBubblePops[i].expired) _poisonBubblePops.splice(i, 1);
    }
  }

  // --- Draw: Poison clouds ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawPoison(ctx) {
    if (!_poisonCloudFx.size && !_poisonBubblePops.length) return;
    ctx.save();
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();

    for (const cloud of _poisonCloudFx.values()) {
      const cx = cloud.x;
      const cy = cloud.y;
      const r = Math.max(0, cloud.radius | 0);
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 4.7 + cloud.phase);
      const wobble = 0.5 + 0.5 * Math.sin(_fxTime * 2.1 + cloud.phase * 0.8);
      const lifeFactor = Math.max(0.32, Math.min(1, (cloud.maxTurns > 0) ? (cloud.turnsLeft / cloud.maxTurns) : 1));
      const fadeFactor = cloud.fading
        ? Math.max(0, Math.min(1, (cloud.fadeMax > 0) ? (cloud.fadeLeft / cloud.fadeMax) : 0))
        : 1;
      const pulseBoost = cloud.pulseFlash > 0 ? (cloud.pulseFlash / 0.24) : 0;
      const alphaScale = lifeFactor * fadeFactor;

      // A poisonous fog should read as murky and viscous, not crackling.
      ctx.globalCompositeOperation = 'source-over';
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > r) continue;

          const tx = cx + dx;
          const ty = cy + dy;
          const ring = 1 - (dist / (r + 1));
          const alpha = (0.08 + ring * 0.10 + wobble * 0.04 + pulseBoost * 0.06) * alphaScale;

          ctx.fillStyle = `rgba(78,155,56,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 0.66 + 0.05 * wobble, 0, TAU);
          ctx.fill();

          ctx.fillStyle = `rgba(145,212,102,${(alpha * 0.35).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 0.36 + 0.03 * pulse, 0, TAU);
          ctx.fill();
        }
      }

      // Slowly undulating perimeter, biased toward dense floor-slick pooling.
      const points = [];
      const pointCount = Math.max(10, 12 + r * 6);
      const baseR = r + 0.88;
      const driftX = 0.05 * Math.sin(_fxTime * 1.2 + cloud.phase);
      const driftY = 0.05 * Math.cos(_fxTime * 1.0 + cloud.phase * 0.6);
      for (let i = 0; i < pointCount; i++) {
        const t = i / pointCount;
        const a = t * TAU;
        const noise =
          0.10 * Math.sin(_fxTime * 2.7 + a * 2.4 + cloud.phase) +
          0.06 * Math.sin(_fxTime * 3.6 + a * 4.2 - cloud.phase * 0.4);
        const rr = baseR + noise + 0.05 * wobble;
        points.push({
          x: cx + driftX + Math.cos(a) * rr,
          y: cy + driftY + Math.sin(a) * (rr * 0.92),
        });
      }
      if (points.length >= 3) {
        const p0 = points[0];
        const p1 = points[1];
        const firstMid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
        ctx.beginPath();
        ctx.moveTo(firstMid.x, firstMid.y);
        for (let i = 1; i <= points.length; i++) {
          const p = points[i % points.length];
          const n = points[(i + 1) % points.length];
          const mid = { x: (p.x + n.x) * 0.5, y: (p.y + n.y) * 0.5 };
          ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
        }
        ctx.closePath();

        const fillA = (0.10 + wobble * 0.06 + pulseBoost * 0.08) * alphaScale;
        ctx.fillStyle = `rgba(84,150,62,${fillA.toFixed(3)})`;
        ctx.fill();

        const edgeA = (0.16 + wobble * 0.05 + pulseBoost * 0.08) * alphaScale;
        ctx.strokeStyle = `rgba(168,228,132,${edgeA.toFixed(3)})`;
        ctx.lineWidth = 0.06;
        ctx.stroke();
      }

      // Faint toxic core, intentionally less luminous than plasma.
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(196,248,128,${((0.05 + pulse * 0.05 + pulseBoost * 0.07) * alphaScale).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.24 + pulse * 0.06, 0, TAU);
      ctx.fill();
    }

    if (_poisonBubblePops.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < _poisonBubblePops.length; i++) {
        const pop = _poisonBubblePops[i];
        const u = pop.progress;
        const alive = pop.alpha;
        const rr = pop.radius;
        const wob = 0.015 * Math.sin(_fxTime * 6.5 + pop.phase);
        const x = pop.x + wob;
        const y = pop.y;

        const ringA = (0.24 * alive) + 0.02;
        ctx.strokeStyle = `rgba(176,255,132,${ringA.toFixed(3)})`;
        ctx.lineWidth = 0.045 + (1 - u) * 0.015;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.stroke();

        ctx.strokeStyle = `rgba(90,196,68,${(ringA * 0.65).toFixed(3)})`;
        ctx.lineWidth = 0.028;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.01, rr * 0.68), 0, TAU);
        ctx.stroke();

        const coreA = (0.10 + (1 - u) * 0.18) * alive;
        if (coreA > 0.01) {
          ctx.fillStyle = `rgba(206,255,170,${coreA.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.008, (1 - u) * 0.055), 0, TAU);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // --- Draw: Plasma clouds ---
  /** @param {CanvasRenderingContext2D} ctx */
  function drawPlasma(ctx) {
    if (!_plasmaCloudFx.size) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const TAU = Math.PI * 2;
    const _fxTime = getFxTime();

    for (const cloud of _plasmaCloudFx.values()) {
      const cx = cloud.x;
      const cy = cloud.y;
      const r = Math.max(0, cloud.radius | 0);
      const pulse = 0.5 + 0.5 * Math.sin(_fxTime * 8.5 + cloud.phase);
      const lifeFactor = Math.max(0.35, Math.min(1, (cloud.maxTurns > 0) ? (cloud.turnsLeft / cloud.maxTurns) : 1));
      const fadeFactor = cloud.fading
        ? Math.max(0, Math.min(1, (cloud.fadeMax > 0) ? (cloud.fadeLeft / cloud.fadeMax) : 0))
        : 1;
      const flashBoost = cloud.flash > 0 ? (cloud.flash / 0.26) : 0;
      const alphaScale = lifeFactor * fadeFactor;

      // Mark every hazardous tile with overlapping circular plasma pools (no grid boxes).
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (dist > r) continue;

          const tx = cx + dx;
          const ty = cy + dy;
          const ring = 1 - (dist / (r + 1));
          const alpha = (0.10 + ring * 0.08 + pulse * 0.05 + flashBoost * 0.08) * alphaScale;

          ctx.fillStyle = `rgba(80,220,255,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 0.62 + 0.04 * pulse, 0, TAU);
          ctx.fill();

          ctx.fillStyle = `rgba(180,250,255,${(alpha * 0.45).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 0.34 + 0.03 * pulse, 0, TAU);
          ctx.fill();
        }
      }

      // Wobbling closed quadratic-Bezier contour around the hazardous footprint.
      const points = [];
      const pointCount = Math.max(12, 14 + r * 8);
      const baseR = r + 0.92;
      const driftX = 0.09 * Math.sin(_fxTime * 1.7 + cloud.phase);
      const driftY = 0.09 * Math.cos(_fxTime * 1.5 + cloud.phase * 0.7);
      for (let i = 0; i < pointCount; i++) {
        const t = i / pointCount;
        const a = t * TAU;
        const wobble =
          0.14 * Math.sin(_fxTime * 3.9 + a * 3.0 + cloud.phase) +
          0.09 * Math.sin(_fxTime * 5.3 + a * 5.0 - cloud.phase * 0.6);
        const rrX = baseR + wobble + 0.06 * pulse;
        const rrY = baseR + wobble * 0.75 + 0.05 * pulse;
        points.push({
          x: cx + driftX + Math.cos(a) * rrX,
          y: cy + driftY + Math.sin(a) * rrY,
        });
      }
      if (points.length >= 3) {
        const p0 = points[0];
        const p1 = points[1];
        const firstMid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
        ctx.beginPath();
        ctx.moveTo(firstMid.x, firstMid.y);
        for (let i = 1; i <= points.length; i++) {
          const p = points[i % points.length];
          const n = points[(i + 1) % points.length];
          const mid = { x: (p.x + n.x) * 0.5, y: (p.y + n.y) * 0.5 };
          ctx.quadraticCurveTo(p.x, p.y, mid.x, mid.y);
        }
        ctx.closePath();

        const blobA = (0.12 + pulse * 0.07 + flashBoost * 0.10) * alphaScale;
        ctx.fillStyle = `rgba(95,230,255,${blobA.toFixed(3)})`;
        ctx.fill();

        const edgeA = (0.25 + pulse * 0.08 + flashBoost * 0.16) * alphaScale;
        ctx.strokeStyle = `rgba(190,250,255,${edgeA.toFixed(3)})`;
        ctx.lineWidth = 0.08;
        ctx.stroke();
      }

      // Core energetic haze.
      ctx.fillStyle = `rgba(210,255,255,${((0.12 + pulse * 0.10 + flashBoost * 0.18) * alphaScale).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.28 + pulse * 0.08, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Listeners ---
  function installListeners() {
    world.on('plasmaCloud:spawned', ({ cloudId, at, radius, turnsLeft }) => {
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      const id = Number(cloudId || 0) | 0;
      if (!(id > 0)) return;
      const r = Math.max(0, Number(radius || 1) | 0);
      const ttl = Math.max(1, Number(turnsLeft || 1) | 0);
      _plasmaCloudFx.set(id, {
        x: at.x,
        y: at.y,
        radius: r,
        turnsLeft: ttl,
        maxTurns: ttl,
        flash: 0.24,
        phase: Math.random() * Math.PI * 2,
        fading: false,
        fadeLeft: 0,
        fadeMax: 0,
      });
      // Fill every dangerous tile with initial spark activity.
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
          spawnPlasmaCloudSparks(at.x + dx, at.y + dy, 2);
        }
      }
      startShake(cam, 2, 0.10);
    });

    world.on('plasmaCloud:pulse', ({ cloudId, at, radius, turnsLeft, affectedIds }) => {
      const id = Number(cloudId || 0) | 0;
      if (!(id > 0)) return;
      const r = Math.max(0, Number(radius || 1) | 0);
      const ttl = Math.max(0, Number(turnsLeft || 0) | 0);
      const prev = _plasmaCloudFx.get(id);
      const next = {
        x: (at && Number.isFinite(at.x)) ? at.x : (prev?.x ?? 0),
        y: (at && Number.isFinite(at.y)) ? at.y : (prev?.y ?? 0),
        radius: r,
        turnsLeft: ttl,
        maxTurns: Math.max(prev?.maxTurns ?? 0, ttl),
        flash: 0.26,
        phase: prev?.phase ?? (Math.random() * Math.PI * 2),
        fading: false,
        fadeLeft: 0,
        fadeMax: 0,
      };
      _plasmaCloudFx.set(id, next);

      if (Array.isArray(affectedIds)) {
        for (let i = 0; i < affectedIds.length; i++) {
          const tpos = getPosition(Number(affectedIds[i] || 0));
          if (!tpos) continue;
          spawnPlasmaCloudSparks(tpos.x, tpos.y, 5);
        }
      } else {
        // Fallback: keep it visually loud even if the payload omits affected ids.
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
            if (Math.random() < 0.35) spawnPlasmaCloudSparks(next.x + dx, next.y + dy, 2);
          }
        }
      }
      startShake(cam, 2, 0.08);
    });

    world.on('plasmaCloud:expired', ({ cloudId, at, radius }) => {
      const id = Number(cloudId || 0) | 0;
      if (!(id > 0)) return;
      const cloud = _plasmaCloudFx.get(id);
      if (!cloud) return;
      if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
        cloud.x = at.x;
        cloud.y = at.y;
      }
      if (Number.isFinite(radius)) cloud.radius = Math.max(0, Number(radius) | 0);
      cloud.fading = true;
      cloud.fadeMax = 0.45;
      cloud.fadeLeft = cloud.fadeMax;
      cloud.flash = Math.max(cloud.flash, 0.16);
    });

    world.on('hazard:spawned', ({ hazardId, kind, at, radius, turnsLeft, medium }) => {
      if (String(kind || '').toLowerCase() !== 'poison') return;
      if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
      const id = Number(hazardId || 0) | 0;
      if (!(id > 0)) return;
      const r = Math.max(0, Number(radius || 1) | 0);
      const ttl = Math.max(1, Number(turnsLeft || 1) | 0);
      _poisonCloudFx.set(id, {
        x: at.x,
        y: at.y,
        radius: r,
        turnsLeft: ttl,
        maxTurns: ttl,
        pulseFlash: 0.20,
        phase: Math.random() * Math.PI * 2,
        fading: false,
        fadeLeft: 0,
        fadeMax: 0,
        medium: String(medium || 'air').toLowerCase() === 'floor' ? 'floor' : 'air',
        bubbleClock: 0.08 + Math.random() * 0.16,
      });
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
          if (Math.random() < 0.85) spawnPoisonCloudMotes(at.x + dx, at.y + dy, 2);
        }
      }
      const seedCloud = { x: at.x, y: at.y, radius: r };
      const popBursts = Math.max(2, 1 + r);
      for (let i = 0; i < popBursts; i++) {
        const p = randomPoisonBubblePoint(seedCloud);
        spawnPoisonBubblePop(p.x, p.y, Math.random() < 0.28 ? 2 : 1);
      }
    });

    world.on('hazard:pulse', ({ hazardId, kind, at, radius, turnsLeft, affectedIds, medium }) => {
      if (String(kind || '').toLowerCase() !== 'poison') return;
      const id = Number(hazardId || 0) | 0;
      if (!(id > 0)) return;
      const r = Math.max(0, Number(radius || 1) | 0);
      const ttl = Math.max(0, Number(turnsLeft || 0) | 0);
      const prev = _poisonCloudFx.get(id);
      const next = {
        x: (at && Number.isFinite(at.x)) ? at.x : (prev?.x ?? 0),
        y: (at && Number.isFinite(at.y)) ? at.y : (prev?.y ?? 0),
        radius: r,
        turnsLeft: ttl,
        maxTurns: Math.max(prev?.maxTurns ?? 0, ttl),
        pulseFlash: 0.24,
        phase: prev?.phase ?? (Math.random() * Math.PI * 2),
        fading: false,
        fadeLeft: 0,
        fadeMax: 0,
        medium: String(medium || prev?.medium || 'air').toLowerCase() === 'floor' ? 'floor' : 'air',
        bubbleClock: Number.isFinite(prev?.bubbleClock)
          ? Math.max(0.04, Number(prev?.bubbleClock || 0))
          : (0.08 + Math.random() * 0.14),
      };
      _poisonCloudFx.set(id, next);

      if (Array.isArray(affectedIds)) {
        for (let i = 0; i < affectedIds.length; i++) {
          const tpos = getPosition(Number(affectedIds[i] || 0));
          if (!tpos) continue;
          spawnPoisonCloudMotes(tpos.x, tpos.y, 4);
          if (Math.random() < 0.72) {
            spawnPoisonBubblePop(
              tpos.x + (Math.random() - 0.5) * 0.18,
              tpos.y + (Math.random() - 0.5) * 0.12,
              Math.random() < 0.22 ? 2 : 1,
            );
          }
        }
      } else {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) > r) continue;
            if (Math.random() < 0.28) spawnPoisonCloudMotes(next.x + dx, next.y + dy, 2);
          }
        }
        const popBursts = Math.max(1, r);
        for (let i = 0; i < popBursts; i++) {
          const p = randomPoisonBubblePoint(next);
          spawnPoisonBubblePop(p.x, p.y, 1);
        }
      }
    });

    world.on('hazard:expired', ({ hazardId, kind, at, radius }) => {
      if (String(kind || '').toLowerCase() !== 'poison') return;
      const id = Number(hazardId || 0) | 0;
      if (!(id > 0)) return;
      const cloud = _poisonCloudFx.get(id);
      if (!cloud) return;
      if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
        cloud.x = at.x;
        cloud.y = at.y;
      }
      if (Number.isFinite(radius)) cloud.radius = Math.max(0, Number(radius) | 0);
      cloud.fading = true;
      cloud.fadeMax = 0.55;
      cloud.fadeLeft = cloud.fadeMax;
      cloud.pulseFlash = Math.max(cloud.pulseFlash, 0.12);
      const popBursts = Math.max(1, 1 + (cloud.radius | 0));
      for (let i = 0; i < popBursts; i++) {
        const p = randomPoisonBubblePoint(cloud);
        spawnPoisonBubblePop(p.x, p.y, 1);
      }
    });
  }

  return { tick, drawPoison, drawPlasma, installListeners };
}
