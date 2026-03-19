// display/fx/weatherFx.js
// Full-screen weather particle overlay for the overworld.
// Rain particles fall diagonally across the viewport in world space.

import { ParticlePool } from "../passes/vfx/particles/particlePool.js";

const RAIN_RATE = 80;        // particles per second (light rain)
const HEAVY_RAIN_RATE = 200; // particles per second (heavy rain)

// Rain streak length in world units (drawn backward along velocity)
const STREAK_LEN = 0.6;
const HEAVY_STREAK_LEN = 0.75;

// Rain particle colours (blue tints)
const RAIN_R = 100;
const RAIN_G = 160;
const RAIN_B = 220;

/**
 * Create a weather VFX controller.
 * Manages its own ParticlePool for rain/weather particles.
 *
 * @returns {{ tick(dtSec: number, weather: string, viewport: {vx0:number,vx1:number,vy0:number,vy1:number}, cam: any): void, draw(bctx: CanvasRenderingContext2D, cam: any): void }}
 */
export function createWeatherFxController() {
  const pool = new ParticlePool(2048);
  let _accum = 0;

  /**
   * Advance weather particles and spawn new ones.
   * @param {number} dtSec — frame delta in seconds
   * @param {string} weather — current weather type from worldView
   * @param {{ vx0:number, vx1:number, vy0:number, vy1:number }} vp — viewport in world coords
   * @param {{ scale:number }} cam — camera (for worldToScreen sizing)
   */
  function tick(dtSec, weather, vp, cam) {
    pool.step(dtSec);

    if (weather !== "rain" && weather !== "heavy_rain") {
      _accum = 0;
      return;
    }

    const rate = weather === "heavy_rain" ? HEAVY_RAIN_RATE : RAIN_RATE;
    _accum += dtSec * rate;

    const vpW = (vp.vx1 - vp.vx0) + 4; // slight padding
    const vpH = (vp.vy1 - vp.vy0) + 4;

    while (_accum >= 1) {
      _accum -= 1;

      // Spawn across entire viewport area (uniform coverage)
      const spawnX = vp.vx0 - 2 + Math.random() * (vpW + 4);
      const spawnY = vp.vy0 - 2 + Math.random() * vpH;

      // Slight variation in speed and angle
      const speedJitter = 0.8 + Math.random() * 0.4;
      const vx = -1.2 * speedJitter;
      const vy = 4.5 * speedJitter;
      const life = 0.5 + Math.random() * 0.3;

      // Rain droplet — short-lived, blue
      const intensity = weather === "heavy_rain" ? 0.7 : 0.5;
      pool.spawn({
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        ax: 0,
        ay: 0.5, // slight downward accel
        life,
        size0: weather === "heavy_rain" ? 0.08 : 0.06,
        size1: 0.03,
        r: RAIN_R + Math.floor(Math.random() * 30 - 15),
        g: RAIN_G + Math.floor(Math.random() * 20 - 10),
        b: RAIN_B + Math.floor(Math.random() * 20 - 10),
        a0: intensity,
        a1: 0,
        rot: 0,
        rotVel: 0,
      });
    }
  }

  /**
   * Render weather particles as diagonal rain streaks into the world-space backbuffer.
   * @param {CanvasRenderingContext2D} bctx — backbuffer context (already has camera transform)
   * @param {{ scale:number }} cam — camera for worldToScreen conversion
   */
  function draw(bctx, cam) {
    if (pool.count === 0) return;

    // Custom streak renderer — draw each particle as a short line
    // from its current position backward along its velocity vector.
    bctx.save();
    bctx.globalCompositeOperation = "source-over";
    bctx.lineCap = "round";

    for (let i = 0; i < pool.count; i++) {
      const u = 1 - (pool.life[i] / pool.lifeMax[i]); // 0→1 over lifetime
      const alpha = pool.a0[i] + (pool.a1[i] - pool.a0[i]) * u;
      if (alpha < 0.01) continue;

      const px = pool.x[i];
      const py = pool.y[i];
      const pvx = pool.vx[i];
      const pvy = pool.vy[i];

      // Normalize velocity and scale to streak length
      const speed = Math.sqrt(pvx * pvx + pvy * pvy);
      if (speed < 0.001) continue;
      const invSpd = 1 / speed;
      const streakLen = pool.size0[i] > 0.07 ? HEAVY_STREAK_LEN : STREAK_LEN;
      const dx = pvx * invSpd * streakLen;
      const dy = pvy * invSpd * streakLen;

      bctx.globalAlpha = alpha;
      bctx.strokeStyle = `rgb(${pool.r[i] | 0},${pool.g[i] | 0},${pool.b[i] | 0})`;
      bctx.lineWidth = 0.06;
      bctx.beginPath();
      bctx.moveTo(px, py);
      bctx.lineTo(px - dx, py - dy);
      bctx.stroke();
    }

    bctx.globalAlpha = 1;
    bctx.restore();
  }

  /**
   * Draw a dark tint overlay for heavy rain.
   * Call AFTER presenting the backbuffer, in screen space.
   * @param {CanvasRenderingContext2D} ctx — screen context
   * @param {number} W — canvas width
   * @param {number} H — canvas height
   * @param {string} weather — current weather type
   */
  function drawScreenTint(ctx, W, H, weather) {
    if (weather !== "heavy_rain") return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(10, 15, 30, 0.12)";
    // Use physical canvas dimensions so the tint covers the full canvas on
    // high-DPR (mobile) screens where canvas.width = cssW * dpr > W.
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  return { tick, draw, drawScreenTint };
}
