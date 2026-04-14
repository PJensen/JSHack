// src/content/vfxWiring.js
// Display-side event handlers for script:vfx:* events emitted by the
// content DSL's ScriptCtx. Install once alongside floatTextWiring.

import { Particle } from "../display/passes/vfx/particles/particlePool.js";

const _installed = Symbol.for('jshack:content:vfxWiring:installed');

/**
 * Parse a hex color string "#rrggbb" into { r, g, b }.
 */
function parseHex(hex) {
  const s = String(hex || '#ffffff');
  return {
    r: parseInt(s.slice(1, 3), 16) || 255,
    g: parseInt(s.slice(3, 5), 16) || 255,
    b: parseInt(s.slice(5, 7), 16) || 255,
  };
}

/**
 * Install content-DSL VFX wiring on the world event bus.
 * @param {{ world: any, ftext: any, fx: any, getPosition: Function, isVisibleAt?: Function }} deps
 */
export function installContentVfxWiring({ world, ftext, fx, getPosition, isVisibleAt }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;

  const canShowAt = (x, y) => (
    Number.isFinite(Number(x))
    && Number.isFinite(Number(y))
    && (typeof isVisibleAt !== 'function' || !!isVisibleAt(Number(x), Number(y)))
  );

  // ── Float text ────────────────────────────────────────────────
  world.on('script:vfx:floatText', ({ entity, text, color, life }) => {
    const pos = getPosition(Number(entity || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    ftext.addStatus(pos.x, pos.y - 0.3, String(text || ''),
      { color: color || '#ffffff', life: life || 0.8 });
  });

  // ── Particle burst ────────────────────────────────────────────
  world.on('script:vfx:burst', ({ entity, color, count, speed, life }) => {
    const pos = getPosition(Number(entity || 0));
    if (!pos || !canShowAt(pos.x, pos.y) || !fx?.pool) return;
    const c = parseHex(color);
    const n = Math.min(count || 8, 32);
    const spd = speed || 1.0;
    const lt = life || 0.3;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const s = (0.6 + Math.random() * 0.8) * spd;
      fx.pool.spawn(new Particle({
        x: pos.x, y: pos.y - 0.1,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s - 0.3,
        ax: 0, ay: 0.8,
        life: lt + Math.random() * 0.2,
        size0: 0.14, size1: 0.03,
        r: c.r, g: c.g, b: c.b,
        a0: 0.9,
      }));
    }
  });

  // ── Beam ──────────────────────────────────────────────────────
  world.on('script:vfx:beam', ({ from, to, color, width, life }) => {
    const p1 = getPosition(Number(from || 0));
    const p2 = getPosition(Number(to || 0));
    if (!p1 || !p2 || !fx?.pool) return;
    const c = parseHex(color);
    const steps = 6;
    const lt = life || 0.4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p1.x + (p2.x - p1.x) * t;
      const y = p1.y + (p2.y - p1.y) * t;
      fx.pool.spawn(new Particle({
        x, y: y - 0.1,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        ax: 0, ay: 0,
        life: lt + Math.random() * 0.15,
        size0: (width || 2) * 0.06,
        size1: 0.01,
        r: c.r, g: c.g, b: c.b,
        a0: 0.95,
      }));
    }
  });

  // ── Glow aura ─────────────────────────────────────────────────
  world.on('script:vfx:glow', ({ entity, color, radius, life }) => {
    const pos = getPosition(Number(entity || 0));
    if (!pos || !canShowAt(pos.x, pos.y) || !fx?.pool) return;
    const c = parseHex(color);
    const rad = radius || 1.0;
    const lt = life || 1.0;
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * rad * 0.4;
      fx.pool.spawn(new Particle({
        x: pos.x + Math.cos(angle) * dist,
        y: pos.y - 0.1 + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 0.05,
        vy: Math.sin(angle) * 0.05,
        ax: 0, ay: 0,
        life: lt * (0.5 + Math.random() * 0.5),
        size0: 0.2, size1: 0.08,
        r: c.r, g: c.g, b: c.b,
        a0: 0.5,
      }));
    }
  });

  // ── Explosion ─────────────────────────────────────────────────
  world.on('script:vfx:explosion', ({ entity, color, radius, count }) => {
    const pos = getPosition(Number(entity || 0));
    if (!pos || !canShowAt(pos.x, pos.y) || !fx?.pool) return;
    const c = parseHex(color);
    const n = Math.min(count || 16, 48);
    const rad = radius || 2;
    // Core burst
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (1.5 + Math.random() * 2.0) * (rad / 2);
      fx.pool.spawn(new Particle({
        x: pos.x, y: pos.y - 0.1,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 0.5,
        ax: 0, ay: 1.5,
        life: 0.3 + Math.random() * 0.4,
        size0: 0.22, size1: 0.04,
        r: c.r, g: c.g, b: c.b,
        a0: 1.0,
      }));
    }
    // Float text
    if (ftext) {
      ftext.addStatus(pos.x, pos.y - 0.3, '💥',
        { color: color || '#ff6633', life: 0.6 });
    }
  });
}
