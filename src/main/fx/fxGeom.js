// src/main/fx/fxGeom.js
// Shared geometry/color utilities for FX modules.

/** @param {number} v @returns {number} */
export function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

/** @param {[number,number,number]} rgb @param {number} alpha @returns {string} */
export function rgba(rgb, alpha) {
  const a = Math.max(0, Math.min(1, Number(alpha || 0)));
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** @param {CanvasRenderingContext2D} ctx @param {{x:number,y:number}[]} pts */
export function pathPolyline(ctx, pts) {
  if (!pts.length) return;
  const first = pts[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (!p) continue;
    ctx.lineTo(p.x, p.y);
  }
}

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {number} [segments] @param {number} [amp] @returns {{x:number,y:number}[]} */
export function jitterLine(a, b, segments = 9, amp = 0.08) {
  const out = [];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len; // perpendicular
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const j = (i === 0 || i === segments) ? 0 : (Math.random() * 2 - 1) * amp;
    out.push({ x: a.x + dx * t + nx * j, y: a.y + dy * t + ny * j });
  }
  return out;
}
