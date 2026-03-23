// src/display/fx/projectileFx.js
// Arrow / ranged-shot tracer VFX + shadow bolt + familiar fireball projectile (world-space; display-only).

import { startShake } from "../camera/shake.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";
import { ArrowFx, ArrowSparkFx, RadialFx } from "./fxEntries.js";

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool: { spawn(o:object):void } }, getPosition: (id:number) => ({x:number,y:number}|null) }} deps
 */
export function createProjectileFxController({ world, cam, fx, getPosition }) {
  /** @type {ArrowFx[]} */
  const _arrowFx = [];
  /** @type {ArrowSparkFx[]} */
  const _arrowSparks = [];

  // --- Shadow Bolt projectile state ---
  /** @type {ArrowFx[]} */
  const _sboltFx = [];
  /** @type {RadialFx[]} */
  const _sboltImpact = [];

  // --- Familiar Fireball projectile state ---
  /** @type {ArrowFx[]} */
  const _fireballFx = [];
  /** @type {RadialFx[]} */
  const _fireballImpact = [];

  // --- Frost Bolt projectile state ---
  /** @type {ArrowFx[]} */
  const _frostboltFx = [];
  /** @type {RadialFx[]} */
  const _frostboltImpact = [];

  // --- Ricochet Theology projectile state ---
  /** @type {ArrowFx[]} */
  const _ricochetFx = [];
  /** @type {RadialFx[]} */
  const _ricochetImpact = [];

  /** @param {number} dt */
  function tick(dt) {
    // Arrows
    for (let i = _arrowFx.length - 1; i >= 0; i--) {
      const a = _arrowFx[i];
      a.tick(dt);
      if (a.arrived) {
        // Arrow arrived — spawn impact spark
        _arrowSparks.push(new ArrowSparkFx({ x: a.to.x, y: a.to.y, ttl: 0.18, style: a.style || 'plain' }));
        _arrowFx.splice(i, 1);
      }
    }
    for (let i = _arrowSparks.length - 1; i >= 0; i--) {
      _arrowSparks[i].tick(dt);
      if (_arrowSparks[i].expired) _arrowSparks.splice(i, 1);
    }

    // Shadow Bolt projectiles
    for (let i = _sboltFx.length - 1; i >= 0; i--) {
      const sb = _sboltFx[i];

      // Spawn trailing purple flame particles during flight
      if (fx?.pool && sb.progress < 1) {
        const hx = sb.from.x + (sb.to.x - sb.from.x) * sb.progress;
        const hy = sb.from.y + (sb.to.y - sb.from.y) * sb.progress;
        const count = Math.max(1, Math.ceil(dt * 100));
        for (let j = 0; j < count; j++) {
          fx.pool.spawn(new Particle({
            x: hx + (Math.random() - 0.5) * 0.08,
            y: hy + (Math.random() - 0.5) * 0.08,
            vx: -sb.dx * 1.2 + (Math.random() - 0.5) * 0.7,
            vy: -sb.dy * 1.2 + (Math.random() - 0.5) * 0.7,
            life: 0.18 + Math.random() * 0.22,
            size0: 0.09 + Math.random() * 0.07,
            size1: 0.01,
            r: 140 + (Math.random() * 70 | 0),
            g: 30 + (Math.random() * 50 | 0),
            b: 200 + (Math.random() * 55 | 0),
            a0: 0.75,
          }));
        }
      }

      sb.tick(dt);

      if (sb.arrived) {
        // Impact radial burst
        _sboltImpact.push(new RadialFx({ x: sb.to.x, y: sb.to.y, radius: 0.9, ttl: 0.50 }));
        startShake(cam, 4, 0.16);

        // Purple particle burst at impact
        if (fx?.pool) {
          for (let k = 0; k < 24; k++) {
            const angle = (k / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const spd = 0.8 + Math.random() * 2.0;
            const life = 0.30 + Math.random() * 0.35;
            fx.pool.spawn(new Particle({
              x: sb.to.x + (Math.random() - 0.5) * 0.3,
              y: sb.to.y + (Math.random() - 0.5) * 0.3,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd - 0.3,
              ay: 0.25,
              life,
              size0: 0.14 + Math.random() * 0.10,
              size1: 0.02,
              r: 130 + (Math.random() * 70 | 0),
              g: 40 + (Math.random() * 40 | 0),
              b: 220 + (Math.random() * 35 | 0),
              a0: 0.9,
              rot: Math.random() * Math.PI * 2,
              rotVel: (Math.random() - 0.5) * 4,
            }));
          }
          // Lingering dark motes (shadow dissipation)
          for (let k = 0; k < 10; k++) {
            fx.pool.spawn(new Particle({
              x: sb.to.x + (Math.random() - 0.5) * 1.0,
              y: sb.to.y + (Math.random() - 0.5) * 0.6,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -0.1 + Math.random() * -0.3,
              life: 0.6 + Math.random() * 0.5,
              size0: 0.07 + Math.random() * 0.05,
              size1: 0.01,
              r: 80, g: 20, b: 140,
              a0: 0.55,
              rotVel: (Math.random() - 0.5) * 2,
            }));
          }
        }
        _sboltFx.splice(i, 1);
      }
    }
    // Shadow bolt impacts
    for (let i = _sboltImpact.length - 1; i >= 0; i--) {
      _sboltImpact[i].tick(dt);
      if (_sboltImpact[i].expired) _sboltImpact.splice(i, 1);
    }

    // Familiar Fireball projectiles
    for (let i = _fireballFx.length - 1; i >= 0; i--) {
      const fb = _fireballFx[i];

      // Spawn trailing flame particles during flight
      if (fx?.pool && fb.progress < 1) {
        const hx = fb.from.x + (fb.to.x - fb.from.x) * fb.progress;
        const hy = fb.from.y + (fb.to.y - fb.from.y) * fb.progress;
        const count = Math.max(1, Math.ceil(dt * 80));
        for (let j = 0; j < count; j++) {
          fx.pool.spawn(new Particle({
            x: hx + (Math.random() - 0.5) * 0.1,
            y: hy + (Math.random() - 0.5) * 0.1,
            vx: -fb.dx * 0.8 + (Math.random() - 0.5) * 0.9,
            vy: -fb.dy * 0.8 + (Math.random() - 0.5) * 0.9 - 0.4,
            ay: -0.3,
            life: 0.2 + Math.random() * 0.25,
            size0: 0.1 + Math.random() * 0.08,
            size1: 0.02,
            r: 255,
            g: 100 + (Math.random() * 100 | 0),
            b: 10 + (Math.random() * 30 | 0),
            a0: 0.8,
          }));
        }
      }

      fb.tick(dt);

      if (fb.arrived) {
        // Impact radial burst
        _fireballImpact.push(new RadialFx({ x: fb.to.x, y: fb.to.y, radius: 0.7, ttl: 0.40 }));
        startShake(cam, 3, 0.12);

        // Fiery particle burst at impact
        if (fx?.pool) {
          for (let k = 0; k < 18; k++) {
            const angle = (k / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const spd = 0.6 + Math.random() * 1.8;
            fx.pool.spawn(new Particle({
              x: fb.to.x + (Math.random() - 0.5) * 0.25,
              y: fb.to.y + (Math.random() - 0.5) * 0.25,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd - 0.5,
              ay: -0.2,
              life: 0.25 + Math.random() * 0.3,
              size0: 0.13 + Math.random() * 0.09,
              size1: 0.02,
              r: 255,
              g: 80 + (Math.random() * 120 | 0),
              b: 10 + (Math.random() * 30 | 0),
              a0: 0.9,
              rotVel: (Math.random() - 0.5) * 3,
            }));
          }
          // Lingering smoke/ember motes
          for (let k = 0; k < 8; k++) {
            fx.pool.spawn(new Particle({
              x: fb.to.x + (Math.random() - 0.5) * 0.8,
              y: fb.to.y + (Math.random() - 0.5) * 0.5,
              vx: (Math.random() - 0.5) * 0.3,
              vy: -0.15 + Math.random() * -0.35,
              life: 0.5 + Math.random() * 0.4,
              size0: 0.06 + Math.random() * 0.04,
              size1: 0.01,
              r: 180, g: 60, b: 10,
              a0: 0.5,
              rotVel: (Math.random() - 0.5) * 2,
            }));
          }
        }
        _fireballFx.splice(i, 1);
      }
    }
    // Fireball impacts
    for (let i = _fireballImpact.length - 1; i >= 0; i--) {
      _fireballImpact[i].tick(dt);
      if (_fireballImpact[i].expired) _fireballImpact.splice(i, 1);
    }

    // Frost Bolt projectiles
    for (let i = _frostboltFx.length - 1; i >= 0; i--) {
      const fb = _frostboltFx[i];

      // Spawn trailing ice particles during flight
      if (fx?.pool && fb.progress < 1) {
        const hx = fb.from.x + (fb.to.x - fb.from.x) * fb.progress;
        const hy = fb.from.y + (fb.to.y - fb.from.y) * fb.progress;
        const count = Math.max(1, Math.ceil(dt * 80));
        for (let j = 0; j < count; j++) {
          fx.pool.spawn(new Particle({
            x: hx + (Math.random() - 0.5) * 0.1,
            y: hy + (Math.random() - 0.5) * 0.1,
            vx: -fb.dx * 0.8 + (Math.random() - 0.5) * 0.9,
            vy: -fb.dy * 0.8 + (Math.random() - 0.5) * 0.9 - 0.3,
            ay: 0.2,
            life: 0.2 + Math.random() * 0.25,
            size0: 0.1 + Math.random() * 0.08,
            size1: 0.02,
            r: 140 + (Math.random() * 60 | 0),
            g: 210 + (Math.random() * 40 | 0),
            b: 255,
            a0: 0.8,
          }));
        }
      }

      fb.tick(dt);

      if (fb.arrived) {
        // Impact radial burst
        _frostboltImpact.push(new RadialFx({ x: fb.to.x, y: fb.to.y, radius: 0.7, ttl: 0.40 }));
        startShake(cam, 3, 0.14);

        // Ice shard particle burst at impact
        if (fx?.pool) {
          for (let k = 0; k < 20; k++) {
            const angle = (k / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
            const spd = 0.6 + Math.random() * 1.8;
            fx.pool.spawn(new Particle({
              x: fb.to.x + (Math.random() - 0.5) * 0.3,
              y: fb.to.y + (Math.random() - 0.5) * 0.3,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd - 0.4,
              ay: 0.3,
              life: 0.35 + Math.random() * 0.35,
              size0: 0.12 + Math.random() * 0.10,
              size1: 0.02,
              r: 140 + (Math.random() * 60 | 0),
              g: 220 + (Math.random() * 35 | 0),
              b: 255,
              a0: 0.9,
              rot: Math.random() * Math.PI * 2,
              rotVel: (Math.random() - 0.5) * 4,
            }));
          }
          // Slow-falling snowflake motes (lingering cold)
          for (let k = 0; k < 8; k++) {
            fx.pool.spawn(new Particle({
              x: fb.to.x + (Math.random() - 0.5) * 1.0,
              y: fb.to.y + (Math.random() - 0.5) * 0.6,
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
        }
        _frostboltFx.splice(i, 1);
      }
    }
    // Frost bolt impacts
    for (let i = _frostboltImpact.length - 1; i >= 0; i--) {
      _frostboltImpact[i].tick(dt);
      if (_frostboltImpact[i].expired) _frostboltImpact.splice(i, 1);
    }

    // Ricochet Theology projectiles
    for (let i = _ricochetFx.length - 1; i >= 0; i--) {
      const bolt = _ricochetFx[i];
      bolt.tick(dt);

      if (bolt.arrived) {
        _ricochetImpact.push(new RadialFx({ x: bolt.to.x, y: bolt.to.y, radius: 0.55, ttl: 0.22 }));
        startShake(cam, 2, 0.08);

        if (fx?.pool) {
          for (let k = 0; k < 10; k++) {
            const angle = (k / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
            const spd = 0.55 + Math.random() * 1.15;
            fx.pool.spawn(new Particle({
              x: bolt.to.x + (Math.random() - 0.5) * 0.18,
              y: bolt.to.y + (Math.random() - 0.5) * 0.18,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd - 0.15,
              ay: 0.18,
              life: 0.12 + Math.random() * 0.16,
              size0: 0.06 + Math.random() * 0.04,
              size1: 0.01,
              r: 110 + (Math.random() * 45 | 0),
              g: 205 + (Math.random() * 35 | 0),
              b: 255,
              a0: 0.82,
            }));
          }
        }

        _ricochetFx.splice(i, 1);
      }
    }
    for (let i = _ricochetImpact.length - 1; i >= 0; i--) {
      _ricochetImpact[i].tick(dt);
      if (_ricochetImpact[i].expired) _ricochetImpact.splice(i, 1);
    }
  }

  function spawnTransientProjectile({
    from,
    to,
    style = 'plain',
    speed = 18,
    minDuration = 0.06,
    maxDuration = 0.4,
  }) {
    if (!from || !to) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const duration = Math.max(minDuration, Math.min(maxDuration, len / Math.max(0.01, Number(speed || 18))));
    const entry = new ArrowFx({
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      duration,
      dx: dx / len,
      dy: dy / len,
      len,
      style,
    });

    if (style === 'shadow_bolt') {
      _sboltFx.push(entry);
      return;
    }
    if (style === 'fireball') {
      _fireballFx.push(entry);
      return;
    }
    if (style === 'frostbolt') {
      _frostboltFx.push(entry);
      return;
    }
    if (style === 'ricochet_theology') {
      _ricochetFx.push(entry);
      return;
    }
    _arrowFx.push(entry);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    const hasArrows = _arrowFx.length || _arrowSparks.length;
    const hasSbolt = _sboltFx.length || _sboltImpact.length;
    const hasFireball = _fireballFx.length || _fireballImpact.length;
    const hasFrostbolt = _frostboltFx.length || _frostboltImpact.length;
    const hasRicochet = _ricochetFx.length || _ricochetImpact.length;
    if (!hasArrows && !hasSbolt && !hasFireball && !hasFrostbolt && !hasRicochet) return;
    ctx.save();

    // Draw flying arrows
    for (const a of _arrowFx) {
      const progress = a.progress;
      const isFire = a.style === 'fire';
      const isBlunt = a.style === 'blunt';
      // Current head position (lerp from→to)
      const hx = a.from.x + (a.to.x - a.from.x) * progress;
      const hy = a.from.y + (a.to.y - a.from.y) * progress;
      // Tail trails behind the head
      const tailLen = Math.min(isFire ? 0.8 : (isBlunt ? 0.68 : 0.6), a.len * progress);
      const tx = hx - a.dx * tailLen;
      const ty = hy - a.dy * tailLen;

      if (isFire) {
        // Fire arrow: outer glow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,100,20,0.25)';
        ctx.lineWidth = 0.18;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.restore();
        // Fire arrow: bright orange shaft
        ctx.strokeStyle = 'rgba(255,160,40,0.95)';
        ctx.lineWidth = 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // Fire arrowhead (hot white-yellow tip)
        ctx.fillStyle = 'rgba(255,240,180,1.0)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.09, 0, Math.PI * 2); ctx.fill();
      } else if (isBlunt) {
        // Blunt arrow: heavier-looking shaft and tip.
        ctx.strokeStyle = 'rgba(175,155,125,0.95)';
        ctx.lineWidth = 0.085;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = 'rgba(215,215,225,0.98)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.09, 0, Math.PI * 2); ctx.fill();
      } else {
        // Normal arrow: warm wood shaft
        ctx.strokeStyle = 'rgba(210,180,110,0.9)';
        ctx.lineWidth = 0.06;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // Arrowhead (bright tip)
        ctx.fillStyle = 'rgba(240,230,200,0.95)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.07, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Impact sparks
    for (const s of _arrowSparks) {
      const alpha = s.alpha;
      const isFire = s.style === 'fire';
      const isBlunt = s.style === 'blunt';
      if (isFire) {
        // Fire impact: orange-red burst
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,120,30,${0.5 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.3 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,200,80,${0.4 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.15 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (isBlunt) {
        // Blunt impact: brighter, wider hit flash for a more obvious impact read.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,240,210,${0.72 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.34 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(220,200,170,${0.48 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.54 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // Normal impact: small warm flash
        ctx.fillStyle = `rgba(255,220,140,${0.5 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.2 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,250,230,${0.3 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.1 * alpha, 0, Math.PI * 2); ctx.fill();
      }
    }

    // --- Shadow Bolt projectile ---
    if (_sboltFx.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sb of _sboltFx) {
        const progress = sb.progress;
        const hx = sb.from.x + (sb.to.x - sb.from.x) * progress;
        const hy = sb.from.y + (sb.to.y - sb.from.y) * progress;
        // Tail trails behind the head (energy wake)
        const tailLen = Math.min(0.8, sb.len * progress);
        const tx = hx - sb.dx * tailLen;
        const ty = hy - sb.dy * tailLen;

        // Outer purple glow trail
        ctx.strokeStyle = 'rgba(100,30,180,0.28)';
        ctx.lineWidth = 0.24;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // Inner bright purple energy shaft
        ctx.strokeStyle = 'rgba(170,80,255,0.85)';
        ctx.lineWidth = 0.09;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

        // Outer head glow (large dim purple)
        ctx.fillStyle = 'rgba(130,50,230,0.40)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.24, 0, Math.PI * 2); ctx.fill();
        // Bright purple-white energy core
        ctx.fillStyle = 'rgba(210,170,255,1.0)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.11, 0, Math.PI * 2); ctx.fill();
        // Hot white center
        ctx.fillStyle = 'rgba(240,220,255,0.7)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.055, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- Familiar Fireball projectile ---
    if (_fireballFx.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const fb of _fireballFx) {
        const progress = fb.progress;
        const hx = fb.from.x + (fb.to.x - fb.from.x) * progress;
        const hy = fb.from.y + (fb.to.y - fb.from.y) * progress;
        // Tail trails behind the head
        const tailLen = Math.min(0.9, fb.len * progress);
        const tx = hx - fb.dx * tailLen;
        const ty = hy - fb.dy * tailLen;

        // Wide fiery glow trail
        ctx.strokeStyle = 'rgba(255,60,5,0.25)';
        ctx.lineWidth = 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // Inner bright orange trail
        ctx.strokeStyle = 'rgba(255,130,20,0.6)';
        ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

        // Outer heat glow
        ctx.fillStyle = 'rgba(255,70,10,0.3)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.28, 0, Math.PI * 2); ctx.fill();
        // Bright orange-yellow core orb
        ctx.fillStyle = 'rgba(255,170,40,0.9)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.16, 0, Math.PI * 2); ctx.fill();
        // Hot white center
        ctx.fillStyle = 'rgba(255,240,190,0.95)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.07, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- Familiar Fireball impact ---
    if (_fireballImpact.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const imp of _fireballImpact) {
        const t = imp.progress;
        // Bright flash on impact
        if (t < 0.2) {
          const flashT = t / 0.2;
          const flashR = 0.2 + flashT * 0.45;
          const flashA = 0.8 * (1 - flashT);
          ctx.fillStyle = `rgba(255,200,80,${flashA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, flashR, 0, Math.PI * 2); ctx.fill();
        }
        // Expanding heat ring
        const ringR = t * (imp.radius + 0.3);
        const ringA = 0.45 * (1 - t);
        ctx.strokeStyle = `rgba(255,100,20,${ringA.toFixed(3)})`;
        ctx.lineWidth = 0.1 * (1 - t * 0.5);
        ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();
        // Inner hot disc
        if (t < 0.35) {
          const discA = 0.25 * (1 - t / 0.35);
          ctx.fillStyle = `rgba(255,160,30,${discA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // --- Frost Bolt projectile ---
    if (_frostboltFx.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const fb of _frostboltFx) {
        const progress = fb.progress;
        const hx = fb.from.x + (fb.to.x - fb.from.x) * progress;
        const hy = fb.from.y + (fb.to.y - fb.from.y) * progress;
        // Tail trails behind the head
        const tailLen = Math.min(0.9, fb.len * progress);
        const tx = hx - fb.dx * tailLen;
        const ty = hy - fb.dy * tailLen;

        // Wide icy glow trail
        ctx.strokeStyle = 'rgba(80,180,255,0.25)';
        ctx.lineWidth = 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        // Inner bright cyan trail
        ctx.strokeStyle = 'rgba(150,220,255,0.6)';
        ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();

        // Outer frost glow
        ctx.fillStyle = 'rgba(100,200,255,0.3)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.28, 0, Math.PI * 2); ctx.fill();
        // Bright icy-white core orb
        ctx.fillStyle = 'rgba(180,235,255,0.9)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.16, 0, Math.PI * 2); ctx.fill();
        // White center
        ctx.fillStyle = 'rgba(230,245,255,0.95)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.07, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- Frost Bolt impact ---
    if (_frostboltImpact.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const imp of _frostboltImpact) {
        const t = imp.progress;
        // Bright white-blue flash on impact
        if (t < 0.2) {
          const flashT = t / 0.2;
          const flashR = 0.2 + flashT * 0.45;
          const flashA = 0.8 * (1 - flashT);
          ctx.fillStyle = `rgba(200,235,255,${flashA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, flashR, 0, Math.PI * 2); ctx.fill();
        }
        // Expanding ice ring
        const ringR = t * (imp.radius + 0.3);
        const ringA = 0.45 * (1 - t);
        ctx.strokeStyle = `rgba(120,210,255,${ringA.toFixed(3)})`;
        ctx.lineWidth = 0.1 * (1 - t * 0.5);
        ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();
        // Inner frost disc
        if (t < 0.35) {
          const discA = 0.25 * (1 - t / 0.35);
          ctx.fillStyle = `rgba(160,230,255,${discA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // --- Ricochet Theology projectile ---
    if (_ricochetFx.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const bolt of _ricochetFx) {
        const progress = bolt.progress;
        const hx = bolt.from.x + (bolt.to.x - bolt.from.x) * progress;
        const hy = bolt.from.y + (bolt.to.y - bolt.from.y) * progress;
        const tailLen = Math.min(0.7, bolt.len * progress);
        const tx = hx - bolt.dx * tailLen;
        const ty = hy - bolt.dy * tailLen;

        ctx.strokeStyle = 'rgba(90,190,255,0.25)';
        ctx.lineWidth = 0.18;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = 'rgba(180,240,255,0.92)';
        ctx.lineWidth = 0.06;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.fillStyle = 'rgba(235,250,255,0.98)';
        ctx.beginPath(); ctx.arc(hx, hy, 0.08, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- Ricochet Theology impact ---
    if (_ricochetImpact.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const imp of _ricochetImpact) {
        const t = imp.progress;
        const ringR = t * (imp.radius + 0.16);
        const ringA = 0.4 * (1 - t);
        ctx.strokeStyle = `rgba(150,225,255,${ringA.toFixed(3)})`;
        ctx.lineWidth = 0.07;
        ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();
        if (t < 0.3) {
          const flashA = 0.55 * (1 - t / 0.3);
          ctx.fillStyle = `rgba(220,245,255,${flashA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, 0.14 + t * 0.12, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // --- Shadow Bolt impact ---
    if (_sboltImpact.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const imp of _sboltImpact) {
        const t = imp.progress;
        // Bright flash on impact
        if (t < 0.15) {
          const flashT = t / 0.15;
          const flashR = 0.2 + flashT * 0.5;
          const flashA = 0.85 * (1 - flashT);
          ctx.fillStyle = `rgba(200,140,255,${flashA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, flashR, 0, Math.PI * 2); ctx.fill();
        }
        // Expanding shadow ring
        const ringR = t * (imp.radius + 0.4);
        const ringA = 0.5 * (1 - t);
        ctx.strokeStyle = `rgba(140,60,255,${ringA.toFixed(3)})`;
        ctx.lineWidth = 0.09 * (1 - t * 0.5);
        ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR, 0, Math.PI * 2); ctx.stroke();
        // Inner dark disc
        if (t < 0.4) {
          const discA = 0.22 * (1 - t / 0.4);
          ctx.fillStyle = `rgba(80,20,140,${discA.toFixed(3)})`;
          ctx.beginPath(); ctx.arc(imp.x, imp.y, ringR * 0.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  function installListeners() {
    world.on('ranged:shot', ({ attacker, target, hit, style, projectileSpeed }) => {
      const apos = getPosition(Number(attacker || 0));
      const dpos = getPosition(Number(target || 0));
      if (!apos || !dpos) return;
      const s = String(style || 'plain');
      const speed = Number(projectileSpeed || 18);
      spawnTransientProjectile({
        from: apos,
        to: dpos,
        style: s,
        speed,
        minDuration: 0.06,
        maxDuration: 0.4,
      });
      startShake(
        cam,
        s === 'fire' ? 3 : (s === 'blunt' ? 4 : 2),
        s === 'fire' ? 0.10 : (s === 'blunt' ? 0.12 : 0.08),
      );
      // Fire arrow: spawn trailing embers
      if (s === 'fire' && fx?.pool) {
        const dx = dpos.x - apos.x;
        const dy = dpos.y - apos.y;
        const len = Math.hypot(dx, dy) || 1;
        for (let i = 0; i < 4; i++) {
          fx.pool.spawn(new Particle({
            x: apos.x + dx / len * 0.5, y: apos.y + dy / len * 0.5,
            vx: (dx / len) * 3 + (Math.random() - 0.5) * 1.5,
            vy: (dy / len) * 3 + (Math.random() - 0.5) * 1.5,
            ay: 0.4, life: 0.25 + Math.random() * 0.15,
            size0: 0.12 + Math.random() * 0.08, size1: 0.02,
            r: 255, g: 160 + Math.random() * 60 | 0, b: 30,
            a0: 0.9,
          }));
        }
      }
    });

    // Familiar Fireball: fiery orb projectile from familiar to target
    world.on('familiar:fireball', ({ from, to }) => {
      spawnTransientProjectile({
        from,
        to,
        style: 'fireball',
        speed: 8,
        minDuration: 0.1,
        maxDuration: 0.6,
      });
    });

    // Frost Bolt: icy projectile from caster to target
    world.on('spell:frost', ({ from, at, fizzle }) => {
      if (fizzle) return;
      if (!from || !at) return;
      spawnTransientProjectile({
        from,
        to: at,
        style: 'frostbolt',
        speed: 8,
        minDuration: 0.1,
        maxDuration: 0.6,
      });
    });

    // Shadow Bolt: purple energy projectile from caster to target
    world.on('spell:shadow_bolt', ({ actor, targetId, from, to, fizzle }) => {
      if (fizzle) return;
      spawnTransientProjectile({
        from,
        to,
        style: 'shadow_bolt',
        speed: 10,
        minDuration: 0.08,
        maxDuration: 0.7,
      });
    });

    world.on('projectile:spawn', ({ style, from, to, sourceId, targetId, speed }) => {
      const start = from || getPosition(Number(sourceId || 0));
      const end = to || getPosition(Number(targetId || 0));
      spawnTransientProjectile({
        from: start,
        to: end,
        style: String(style || 'plain'),
        speed: Number(speed || 18),
        minDuration: 0.05,
        maxDuration: 0.4,
      });
    });
  }

  return { tick, draw, installListeners };
}
