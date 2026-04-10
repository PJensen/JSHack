// display/fx/rootedVineFx.js
// Procedural vine tangle drawn at the feet of rooted entities.
// 4-6 curved vine tendrils that slowly rotate, giving a "bound in place" feel.

const VINE_COUNT = 5;
const VINE_COLOR = '#2d8840';
const VINE_COLOR_DARK = '#1a5c2a';
const VINE_ALPHA = 0.75;
const ROTATION_SPEED = 0.4;

/**
 * Draw spinning vine tendrils around the base of a rooted entity.
 * @param {CanvasRenderingContext2D} ctx — world-space canvas
 * @param {number} wx — world X of entity
 * @param {number} wy — world Y of entity
 * @param {number} fxTime — elapsed display time (seconds)
 * @param {number} entityId — for phase offset so multiple rooted mobs look distinct
 */
export function drawRootedVines(ctx, wx, wy, fxTime, entityId) {
  const phase = fxTime * ROTATION_SPEED + (entityId * 0.7);
  const baseY = wy + 0.35; // feet level

  ctx.save();
  ctx.globalAlpha = VINE_ALPHA;
  ctx.lineWidth = 0.04;
  ctx.lineCap = 'round';

  for (let i = 0; i < VINE_COUNT; i++) {
    const angle = (Math.PI * 2 * i / VINE_COUNT) + phase;
    const r = 0.22 + Math.sin(phase * 1.3 + i * 1.1) * 0.06;

    const x0 = wx + Math.cos(angle) * r * 0.3;
    const y0 = baseY + Math.sin(angle) * r * 0.15;
    const x1 = wx + Math.cos(angle + 0.8) * r;
    const y1 = baseY + Math.sin(angle + 0.8) * r * 0.4;
    const cpx = wx + Math.cos(angle + 0.4) * r * 0.8;
    const cpy = baseY - 0.08 + Math.sin(angle * 0.7 + i) * 0.05;

    ctx.strokeStyle = (i % 2 === 0) ? VINE_COLOR : VINE_COLOR_DARK;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cpx, cpy, x1, y1);
    ctx.stroke();
  }

  ctx.restore();
}
