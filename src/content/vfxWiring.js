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

  // ── Semantic presentation events (ctx.present) ────────────────
  world.on('script:present', ({ entity, id, spec, payload }) => {
    if (!spec) return;
    // Resolve position: entity ID → Position component, or use payload.at for tile targets
    let pos = null;
    if (payload?.at && Number.isFinite(payload.at.x)) {
      pos = payload.at;
    } else {
      pos = getPosition(Number(entity || 0));
    }
    if (!pos || !canShowAt(pos.x, pos.y)) return;

    // Resolve user position for beam origins
    const userPos = payload?.user ? getPosition(Number(payload.user || 0)) : null;

    // Sound
    if (spec.sound) {
      world.emit('audio:play', { id: spec.sound });
    }

    // VFX effects array
    if (Array.isArray(spec.vfx)) {
      for (const effect of spec.vfx) {
        _renderPresentationEffect(effect, pos, userPos, payload, fx, ftext, world);
      }
    }

    // Message
    if (spec.message) {
      const text = _interpolatePresentation(spec.message, payload);
      world.emit('log:message', { text, type: spec.messageType || 'system' });
    }
  });

  /**
   * Render a single presentation VFX effect.
   */
  function _renderPresentationEffect(effect, pos, userPos, payload, fx, ftext, world) {
    if (!effect?.type) return;
    const c = parseHex(effect.color || effect.palette || '#ffffff');

    switch (effect.type) {
      case 'beam': {
        // Real LineFx beam via boltFxController + holy lighting
        const from = userPos || pos;
        const to = pos;
        world.emit('content:beam:vfx', {
          fromX: from.x, fromY: from.y,
          toX: to.x, toY: to.y,
          style: effect.style || 'holy',
          shake: effect.shake ?? 2,
        });
        // Also spawn particles along the beam for extra density
        if (fx?.pool) {
          const steps = 6;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            fx.pool.spawn(new Particle({
              x, y: y - 0.1,
              vx: (Math.random() - 0.5) * 0.3,
              vy: (Math.random() - 0.5) * 0.3 - 0.1,
              ax: 0, ay: 0,
              life: 0.25 + Math.random() * 0.15,
              size0: 0.09, size1: 0.02,
              r: c.r, g: c.g, b: c.b, a0: 0.95,
            }));
          }
        }
        break;
      }
      case 'burst': {
        const n = Math.min(effect.count || 8, 32);
        const spd = effect.speed || 1.0;
        const lt = effect.life || 0.3;
        for (let i = 0; i < n; i++) {
          const angle = Math.random() * Math.PI * 2;
          const s = (0.6 + Math.random() * 0.8) * spd;
          fx.pool.spawn(new Particle({
            x: pos.x, y: pos.y - 0.1,
            vx: Math.cos(angle) * s, vy: Math.sin(angle) * s - 0.3,
            ax: 0, ay: 0.8,
            life: lt + Math.random() * 0.2,
            size0: 0.14, size1: 0.03,
            r: c.r, g: c.g, b: c.b, a0: 0.9,
          }));
        }
        break;
      }
      case 'glow': {
        const rad = effect.radius || 1.0;
        const lt = effect.life || 1.0;
        for (let i = 0; i < 12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * rad * 0.4;
          fx.pool.spawn(new Particle({
            x: pos.x + Math.cos(angle) * dist,
            y: pos.y - 0.1 + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 0.05, vy: Math.sin(angle) * 0.05,
            ax: 0, ay: 0,
            life: lt * (0.5 + Math.random() * 0.5),
            size0: 0.2, size1: 0.08,
            r: c.r, g: c.g, b: c.b, a0: 0.5,
          }));
        }
        break;
      }
      case 'flash': {
        const n = Math.min((effect.radius || 4) * 4, 48);
        for (let i = 0; i < n; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 2.0 + Math.random() * 3.0;
          fx.pool.spawn(new Particle({
            x: pos.x, y: pos.y - 0.1,
            vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
            ax: 0, ay: 0,
            life: 0.15 + Math.random() * 0.15,
            size0: 0.3, size1: 0.02,
            r: c.r, g: c.g, b: c.b, a0: 1.0,
          }));
        }
        break;
      }
      case 'lightPulse': {
        world.emit('content:light:pulse', {
          x: pos.x, y: pos.y,
          radius: effect.radius || 4,
          color: effect.color || '#fff5c8',
          duration: effect.duration || 0.4,
        });
        break;
      }
      case 'floatText': {
        if (!ftext) break;
        const text = _interpolatePresentation(effect.text || '', payload);
        ftext.addStatus(pos.x, pos.y - 0.3, text,
          { color: effect.color || '#ffffff', life: effect.life || 0.8 });
        break;
      }
    }
  }

  function _interpolatePresentation(template, payload) {
    return String(template || '').replace(/\{(\w+)\}/g, (match, key) => {
      const val = payload?.[key];
      return val != null ? String(val) : match;
    });
  }
}
