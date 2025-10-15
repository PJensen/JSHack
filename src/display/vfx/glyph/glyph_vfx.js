// src/display/vfx/glyph/glyph_vfx.js
// Early sketch of a glyph VFX module for the engine. Provides envelope computation
// and a small manager to run overlay FX over already-rendered glyphs.

// EASING
export function easeShape(x, type) {
  x = Math.max(0, Math.min(1, x));
  switch (type) {
    case 'quad': // smooth
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'exp': // strong S-curve
      if (x === 0 || x === 1) return x;
      return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : 1 - Math.pow(2, -20 * x + 10) / 2;
    case 'linear':
    default:
      return x;
  }
}

// Small hash noise for deterministic jitter
function hash(n) {
  n |= 0;
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = n * 0x27d4eb2d;
  n = n ^ (n >>> 15);
  return n >>> 0;
}
function noise01(seed, x) {
  const n = hash((seed * 73856093 ^ (x * 1e6 | 0)) | 0);
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

// Compute an envelope compatible with the FX Builder
export function computeEnv(effT, params, size, seed) {
  const onsetMs = Math.max(0, params?.onsetMs | 0);
  const steadyMs = Math.max(0, params?.steadyMs | 0);
  const offMs = Math.max(0, params?.comedownMs | 0);
  const ease = params?.easing || 'linear';
  const hold = !!params?.holdSteady;
  const scaleMax = params?.scaleMax || 0; // e.g., 0.12
  const jitterMax = params?.jitterMax || 0; // pixels

  const totalMsRaw = onsetMs + steadyMs + offMs;
  const totalMs = Math.max(1, totalMsRaw);
  const on = onsetMs / totalMs;
  const pk = steadyMs / totalMs;
  const off = offMs / totalMs;

  let phase = 'steady', u = 1, uLocal = 1, gain = 1;
  const tMs = effT * 1000;

  if (onsetMs === 0 && offMs === 0) {
    phase = pk > 0 || hold ? 'steady' : 'peak';
    u = 1; uLocal = 1; gain = 1;
  } else if (tMs < onsetMs) {
    phase = 'onset';
    uLocal = Math.max(0, Math.min(1, tMs / Math.max(1, onsetMs)));
    u = uLocal * on;
    gain = easeShape(uLocal, ease);
  } else if (hold || tMs < onsetMs + steadyMs) {
    phase = 'steady';
    uLocal = steadyMs > 0 ? (tMs - onsetMs) / Math.max(1, steadyMs) : 1;
    u = on + uLocal * pk;
    gain = 1;
  } else {
    phase = 'comedown';
    uLocal = offMs > 0 ? (tMs - onsetMs - steadyMs) / Math.max(1, offMs) : 1;
    u = on + pk + uLocal * off;
    gain = 1 - easeShape(uLocal, ease);
  }
  gain = Math.max(0, Math.min(1, gain));

  // transform helpers
  const bellCenter = on;
  const bellWidth = Math.max(1e-6, on * 0.75);
  const bell = Math.max(0, 1 - Math.abs((u - bellCenter) / bellWidth));
  const jitter = jitterMax * bell * 0.8;
  const jx = (noise01(seed || 0, u + 0.13) - 0.5) * 2 * jitter;
  const jy = (noise01(seed || 0, u + 0.71) - 0.5) * 2 * jitter;
  const scale = 1 + scaleMax * gain;

  return { phase, u, uLocal, gain, scale, jitter, jx, jy, bias: Math.sin(Math.PI * u), on, pk, off };
}

// Glyph VFX Manager: holds overlay FX instances and renders them.
export class GlyphVfxManager {
  constructor(opts = {}) {
    this.effects = new Map();
    this.nextId = 1;
    this.now = 0;
    this.last = 0;
    // Defaults for envelope
    this.defaults = {
      onsetMs: 200,
      steadyMs: 400,
      comedownMs: 200,
      easing: 'linear',
      holdSteady: true,
      scaleMax: 0.12,
      jitterMax: 4,
      ...opts.envelopeDefaults,
    };
    this.drawBase = !!opts.drawBase; // debug option; engine normally draws base itself
  }

  addEffect({ fn, glyph, x, y, size, seed = 1, params = {}, opts = {} }) {
    const id = this.nextId++;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : this.now;
    this.effects.set(id, {
      id, fn, glyph, x, y, size, seed,
      startedAt: now,
      comedownAt: null, // set when we trigger comedown explicitly (for holdSteady cases)
      lastT: now,
      params: { ...this.defaults, ...params },
      opts,
      done: false,
    });
    return id;
  }

  // For holdSteady effects: trigger comedown now; they will end after comedownMs
  requestComedown(id) {
    const e = this.effects.get(id);
    if (!e || e.done) return;
    if (!e.params.holdSteady) return; // already non-held; they will end naturally
    if (e.comedownAt == null) {
      e.comedownAt = this.now;
      e.params.holdSteady = false; // drop hold to allow comedown
      // Adjust timing origin so env sees comedown from zero
      // We emulate by setting startedAt = now - onsetMs - steadyMs (so t maps into comedown window)
      const onsetSec = (e.params.onsetMs || 0) / 1000;
      const steadySec = (e.params.steadyMs || 0) / 1000;
      e.startedAt = this.now - onsetSec - steadySec;
    }
  }

  removeEffect(id) { this.effects.delete(id); }
  clear() { this.effects.clear(); }

  // Drive time; call once per frame
  update(nowSec) {
    if (typeof nowSec !== 'number') {
      nowSec = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : (this.now + 1 / 60);
    }
    this.last = this.now;
    this.now = nowSec;
  }

  // Render all current effects; engine should have already drawn the base glyphs.
  // ctx: CanvasRenderingContext2D
  render(ctx) {
    const dt = Math.max(0, this.now - this.last);
    const toRemove = [];

    for (const e of this.effects.values()) {
      const t = Math.max(0, this.now - e.startedAt);
      const env = computeEnv(t, e.params, e.size, e.seed);

      // End condition when not holding steady: after full cycle
      if (!e.params.holdSteady) {
        const total = (e.params.onsetMs + e.params.steadyMs + e.params.comedownMs) / 1000;
        if (t >= total + 1e-6) { toRemove.push(e.id); continue; }
      }

      ctx.save();
      // Optional debug: render base glyph here (engine normally does this earlier)
      if (this.drawBase || e.opts.drawBase) {
        ctx.save();
        ctx.font = e.size + 'px monospace';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'white';
        ctx.fillText(e.glyph, e.x - e.size / 2, e.y);
        ctx.restore();
      }

      // Apply global transforms similar to the builder when requested
      if (e.opts.applyGlobally) {
        ctx.translate(e.x, e.y);
        ctx.scale(env.scale, env.scale);
        ctx.translate(-e.x, -e.y);
        ctx.translate(env.jx, env.jy);
        ctx.globalAlpha *= env.gain;
      }

      try {
        // Preferred signature with opts
        if (e.fn.length >= 11) {
          e.fn(ctx, e.glyph, e.x, e.y, e.size, t, dt, e.seed, e.y, env, e.opts);
        } else {
          // Backward compatible (builder-style) signature
          e.fn(ctx, e.glyph, e.x, e.y, e.size, t, dt, e.seed, e.y, env);
        }
      } catch (err) {
        // Fail-safe: remove effect on error to avoid spamming
        console && console.error && console.error('GlyphVfx error:', err);
        toRemove.push(e.id);
      }
      ctx.restore();
    }

    for (const id of toRemove) this.effects.delete(id);
  }
}

// Example usage (engine):
// const vfx = new GlyphVfxManager({ envelopeDefaults: { onsetMs:200, steadyMs:0, comedownMs:200, easing:'quad', holdSteady:true }, drawBase:false });
// const id = vfx.addEffect({ fn: neonPulse, glyph:'@', x:gx, y:gy, size:sz, seed:seed, params:{ holdSteady:true }, opts:{ applyGlobally:true, teamColor:'#6cf' } });
// vfx.update(timeNowSec); vfx.render(ctx);
// vfx.requestComedown(id); // when you want to ramp out
