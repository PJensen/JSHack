// src/display/fx/projectileFx.js
// Arrow / ranged-shot tracer VFX (world-space; display-only).

import { startShake } from "../camera/shake.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";
import { ArrowFx, ArrowSparkFx } from "./fxEntries.js";

/**
 * @param {{ world: import('../../lib/ecs-js/index.js').World, cam: object, fx: { pool: { spawn(o:object):void } }, getPosition: (id:number) => ({x:number,y:number}|null) }} deps
 */
export function createProjectileFxController({ world, cam, fx, getPosition }) {
  /** @type {ArrowFx[]} */
  const _arrowFx = [];
  /** @type {ArrowSparkFx[]} */
  const _arrowSparks = [];

  /** @param {number} dt */
  function tick(dt) {
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
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (!_arrowFx.length && !_arrowSparks.length) return;
    ctx.save();

    // Draw flying arrows
    for (const a of _arrowFx) {
      const progress = a.progress;
      const isFire = a.style === 'fire';
      // Current head position (lerp from→to)
      const hx = a.from.x + (a.to.x - a.from.x) * progress;
      const hy = a.from.y + (a.to.y - a.from.y) * progress;
      // Tail trails behind the head
      const tailLen = Math.min(isFire ? 0.8 : 0.6, a.len * progress);
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
      if (isFire) {
        // Fire impact: orange-red burst
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,120,30,${0.5 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.3 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,200,80,${0.4 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.15 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else {
        // Normal impact: small warm flash
        ctx.fillStyle = `rgba(255,220,140,${0.5 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.2 * alpha, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,250,230,${0.3 * alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, 0.1 * alpha, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();
  }

  function installListeners() {
    world.on('ranged:shot', ({ attacker, target, hit, style }) => {
      const apos = getPosition(Number(attacker || 0));
      const dpos = getPosition(Number(target || 0));
      if (!apos || !dpos) return;
      const dx = dpos.x - apos.x, dy = dpos.y - apos.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 18; // tiles per second
      const duration = Math.max(0.06, Math.min(0.4, len / speed));
      const s = String(style || 'plain');
      _arrowFx.push(new ArrowFx({
        from: { x: apos.x, y: apos.y }, to: { x: dpos.x, y: dpos.y },
        duration, dx: dx / len, dy: dy / len, len, style: s
      }));
      startShake(cam, s === 'fire' ? 3 : 2, s === 'fire' ? 0.10 : 0.08);
      // Fire arrow: spawn trailing embers
      if (s === 'fire' && fx?.pool) {
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
  }

  return { tick, draw, installListeners };
}
