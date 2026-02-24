// display/fx/particles/particles.js
// Pure display-side particle system (no ECS, no rules/ imports).
// - SoA pool for performance
// - Emitter class supports continuous + burst
// - ParticleFX manager to wire multiple emitters by key (e.g., entity id)
// - Optional deterministic RNG via seed (visual-only determinism)

import { makeRng } from '../../../../shared/utils/rng.js';

// Scratch object reused on every worldToScreen call — avoids per-particle allocation.
const _P = { x: 0, y: 0, size: 0 };
// Cache packed-integer rgb key → rgb string; particle colours come from a small emitter
// palette so hit rate is near 100% and the Map stays tiny.
const _rgbCache = new Map();
function cachedRgb(r, g, b) {
  const key = ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  let s = _rgbCache.get(key);
  if (s === undefined) { s = `rgb(${r},${g},${b})`; _rgbCache.set(key, s); }
  return s;
}

/**
 * Rigid data class for a single particle spawn payload.
 * Enforces the exact field contract that ParticlePool.spawn() reads,
 * with sensible defaults for the commonly-zero fields.
 */
export class Particle {
  constructor({ x, y, vx, vy, ax = 0, ay = 0, life,
                size0, size1, r, g, b, a0, a1 = 0,
                rot = 0, rotVel = 0 }) {
    this.x = x;        this.y = y;
    this.vx = vx;      this.vy = vy;
    this.ax = ax;       this.ay = ay;
    this.life = life;
    this.size0 = size0; this.size1 = size1;
    this.r = r;         this.g = g;   this.b = b;
    this.a0 = a0;       this.a1 = a1;
    this.rot = rot;     this.rotVel = rotVel;
  }
}

export class ParticlePool {
  constructor(capacity = 4096) {
    this.cap = capacity;
    this.count = 0;
    // Structure-of-Arrays
    this.x  = new Float32Array(capacity);
    this.y  = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.ax = new Float32Array(capacity);
    this.ay = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.lifeMax = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.r = new Float32Array(capacity);
    this.g = new Float32Array(capacity);
    this.b = new Float32Array(capacity);
    this.a0 = new Float32Array(capacity);
    this.a1 = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.rotVel = new Float32Array(capacity);
  }

  get available() { return this.cap - this.count; }

  spawn(p) {
    // If full, overwrite oldest (visual-only OK)
    const i = this.count < this.cap ? this.count++ : (this.count = this.cap, 0);
    this.x[i]=p.x; this.y[i]=p.y;
    this.vx[i]=p.vx; this.vy[i]=p.vy;
    this.ax[i]=p.ax; this.ay[i]=p.ay;
    this.life[i]=p.life; this.lifeMax[i]=p.life;
    this.size0[i]=p.size0; this.size1[i]=p.size1;
    this.r[i]=p.r; this.g[i]=p.g; this.b[i]=p.b;
    this.a0[i]=p.a0; this.a1[i]=p.a1;
    this.rot[i]=p.rot||0; this.rotVel[i]=p.rotVel||0;
  }

  step(dt) {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const life = this.life[i] - dt;
      if (life <= 0) continue;

      const vx = this.vx[i] += this.ax[i]*dt;
      const vy = this.vy[i] += this.ay[i]*dt;
      this.x[i] += vx*dt;
      this.y[i] += vy*dt;
      this.life[i] = life;
      this.rot[i] += this.rotVel[i]*dt;

      if (w !== i) {
        this.x[w]=this.x[i]; this.y[w]=this.y[i];
        this.vx[w]=this.vx[i]; this.vy[w]=this.vy[i];
        this.ax[w]=this.ax[i]; this.ay[w]=this.ay[i];
        this.life[w]=this.life[i]; this.lifeMax[w]=this.lifeMax[i];
        this.size0[w]=this.size0[i]; this.size1[w]=this.size1[i];
        this.r[w]=this.r[i]; this.g[w]=this.g[i]; this.b[w]=this.b[i];
        this.a0[w]=this.a0[i]; this.a1[w]=this.a1[i];
        this.rot[w]=this.rot[i]; this.rotVel[w]=this.rotVel[i];
      }
      w++;
    }
    this.count = w;
  }

  render(ctx, worldToScreen, opts = {}) {
    const mode = opts.mode || 'lighter';
    const alphaScale = opts.alphaScale ?? 0.95;
    const shape = opts.shape || 'circle'; // 'circle' | 'rect'
    ctx.save();
    ctx.globalCompositeOperation = mode;

    for (let i = 0; i < this.count; i++) {
      const u = 1 - (this.life[i] / this.lifeMax[i]);         // 0→1 over life
      const size = this.size0[i] + (this.size1[i]-this.size0[i])*u;
      const alpha = (this.a0[i] + (this.a1[i]-this.a0[i])*u) * alphaScale;
      worldToScreen(this.x[i], this.y[i], size, _P);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = cachedRgb(this.r[i]|0, this.g[i]|0, this.b[i]|0);
      if (shape === 'rect') {
        const r = _P.size * 0.5;
        ctx.fillRect(_P.x - r, _P.y - r, _P.size, _P.size);
      } else {
        // Circle
        ctx.beginPath();
        ctx.arc(_P.x, _P.y, _P.size*0.5, 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function hexToRgb(hex) {
  const h = String(hex).replace('#','');
  const n = parseInt(h.length===3? h.split('').map(c=>c+c).join(''):h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}

export class ParticleEmitter {
  constructor(opts = {}) {
    const {
      enabled = true,
      continuous = true,
      rate = 12,              // particles/sec
      burstCount = 0,

      angle = -Math.PI/2,
      spread = Math.PI/8,
      speed = 1.2,
      speedJitter = 0.4,      // fraction [0..1]
      vx = 0, vy = 0,
      ax = 0, ay = -0.6,

      life = 0.9,
      lifeJitter = 0.3,       // fraction [0..1]
      size = 0.9,
      sizeEnd = 0.1,
      color = '#ffa500',
      alpha0 = 0.95, alpha1 = 0.0,
      rotVel = 0,             // optional rotation velocity

      offsetX = 0,
      offsetY = -0.2,

      seed = 0                // per-emitter seed for visual determinism
    } = opts;

    this.enabled = enabled;
    this.continuous = continuous;
    this.rate = rate;
    this.burstCount = burstCount;

    this.angle = angle;
    this.spread = spread;
    this.speed = speed;
    this.speedJitter = speedJitter;
    this.vx = vx; this.vy = vy;
    this.ax = ax; this.ay = ay;

    this.life = life;
    this.lifeJitter = lifeJitter;
    this.size = size;
    this.sizeEnd = sizeEnd;
    const { r,g,b } = hexToRgb(color);
    this.r = r; this.g = g; this.b = b;
    this.alpha0 = alpha0; this.alpha1 = alpha1;
    this.rotVel = rotVel;

    this.offsetX = offsetX; this.offsetY = offsetY;

    this._rng = makeRng(seed>>>0);
    this._acc = 0;
    this._didBurst = false;
  }

  onEnable(pool, ox, oy) {
    this._didBurst = false;
    if (this.burstCount > 0) this._burst(pool, ox, oy);
  }

  step(pool, dt, ox, oy, ovx = 0, ovy = 0) {
    if (!this.enabled) return;

    if (this.continuous && this.rate > 0) {
      this._acc += dt * this.rate;
      const n = this._acc | 0;
      if (n > 0) {
        this._acc -= n;
        for (let i = 0; i < n; i++) this._spawnOne(pool, ox, oy, ovx, ovy);
      }
    } else if (this.burstCount > 0 && !this._didBurst) {
      this._burst(pool, ox, oy, ovx, ovy);
    }
  }

  _burst(pool, ox, oy, ovx = 0, ovy = 0) {
    this._didBurst = true;
    for (let i = 0; i < this.burstCount; i++) this._spawnOne(pool, ox, oy, ovx, ovy);
    if (!this.continuous) this.enabled = false;
  }

  _spawnOne(pool, ox, oy, ovx = 0, ovy = 0) {
    const rnd = this._rng;
    const sj = Math.max(0, Math.min(1, this.speedJitter));
    const lj = Math.max(0, Math.min(1, this.lifeJitter));
    const theta = this.angle + (rnd()*2 - 1) * this.spread;
    const spd   = this.speed * (1 - sj*0.5 + rnd()*sj);
    const life  = this.life  * (1 - lj*0.5 + rnd()*lj);

    pool.spawn(new Particle({
      x: ox + this.offsetX,
      y: oy + this.offsetY,
      vx: Math.cos(theta)*spd + this.vx + ovx,
      vy: Math.sin(theta)*spd + this.vy + ovy,
      ax: this.ax, ay: this.ay,
      life,
      size0: this.size, size1: this.sizeEnd,
      r: this.r, g: this.g, b: this.b,
      a0: this.alpha0, a1: this.alpha1,
      rotVel: this.rotVel,
    }));
  }
}

export class ParticleFX {
  constructor({ capacity = 4096, seedBase = 0 } = {}) {
    this.pool = new ParticlePool(capacity);
    this.emitters = new Map(); // key -> ParticleEmitter
    this.seedBase = seedBase >>> 0;
    this.ctx = null;
    this.worldToScreen = (x, y, size, out) => { out.x = x; out.y = y; out.size = size; }; // inject real camera
  }

  // key is arbitrary: entity id, "room:3", etc.
  ensureEmitter(key, opts) {
    if (this.emitters.has(key)) return this.emitters.get(key);
    const seed = (this.seedBase ^ (hashKey(key))) >>> 0;
    const e = new ParticleEmitter({ ...opts, seed });
    this.emitters.set(key, e);
    return e;
  }

  removeEmitter(key) { this.emitters.delete(key); }

  step(dt, origins = []) {
    // origins: array of { key, x, y, vx?, vy? }
    for (const o of origins) {
      const e = this.emitters.get(o.key);
      if (!e) continue;
      e.step(this.pool, dt, o.x, o.y, o.vx||0, o.vy||0);
    }
    this.pool.step(dt);
  }

  render(opts = {}) {
    if (!this.ctx) return;
    this.pool.render(this.ctx, this.worldToScreen, opts);
  }

  stats() {
    return {
      active: this.pool.count,
      capacity: this.pool.cap,
      emitters: this.emitters.size
    };
  }
}

function hashKey(k) {
  const s = String(k);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
