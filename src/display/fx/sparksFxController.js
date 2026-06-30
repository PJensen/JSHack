import { defineExtension } from "../../lib/ecs-js/index.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";

const INSTALLED_KEY = Symbol.for("jshack:display:sparksFx");
const SPARK_LIFE_SEC = 0.22;
const SPARK_LIGHT_RADIUS = 1.05;

function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function signDelta(value) {
  const n = finiteOr(value, 0);
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function normalizeDirection(dx, dy) {
  const sx = signDelta(dx);
  const sy = signDelta(dy);
  if (sx !== 0 || sy !== 0) return { dx: sx, dy: sy };
  return { dx: 0, dy: -1 };
}

/**
 * Display-only transient sparks for hard impacts such as digging.
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   fx: { pool?: { spawn(p:object): void } },
 *   getPosition: (id:number) => ({x:number,y:number}|null),
 *   isVisibleAt?: (x:number,y:number) => boolean,
 * }} deps
 */
export function createSparksFxController({ world, fx, getPosition, isVisibleAt }) {
  /** @type {Array<{x:number,y:number,age:number,maxAge:number,seed:number}>} */
  const sparks = [];

  const canShowAt = (x, y) => (
    Number.isFinite(Number(x))
    && Number.isFinite(Number(y))
    && (typeof isVisibleAt !== "function" || !!isVisibleAt(Number(x), Number(y)))
  );

  function spawnBurst(x, y, dx, dy, seed) {
    const pool = fx?.pool;
    if (!pool || typeof pool.spawn !== "function") return;
    const normal = normalizeDirection(dx, dy);
    const baseAngle = Math.atan2(normal.dy, normal.dx);
    const colors = [
      [255, 255, 255, 0.12, 0.055, 1.0],
      [255, 238, 185, 0.16, 0.040, 0.88],
      [255, 172, 72, 0.20, 0.030, 0.68],
    ];
    for (let i = 0; i < 14; i++) {
      const lane = colors[Math.min(colors.length - 1, i % colors.length)];
      const phase = ((seed * 1103515245 + i * 2654435761) >>> 0) / 0xffffffff;
      const phase2 = ((seed * 1664525 + i * 1013904223) >>> 0) / 0xffffffff;
      const spread = (phase - 0.5) * Math.PI * 1.15;
      const speed = 1.55 + phase2 * 1.45;
      const angle = baseAngle + Math.PI + spread;
      pool.spawn(new Particle({
        x,
        y,
        vx: Math.cos(angle) * speed + normal.dx * 0.18,
        vy: Math.sin(angle) * speed + normal.dy * 0.18,
        ax: -normal.dx * 2.6,
        ay: 0.85 - normal.dy * 1.4,
        life: lane[3] + phase2 * 0.055,
        size0: lane[4],
        size1: 0.012,
        r: lane[0],
        g: lane[1],
        b: lane[2],
        a0: lane[5],
        a1: 0,
      }));
    }
  }

  function installListeners() {
    world.install(defineExtension("jshack:display:sparksFx", (installedWorld) => {
      installedWorld.on("tile:dug", ({ actor, x, y }) => {
        const actorPos = getPosition(Number(actor || 0) | 0);
        const tx = finiteOr(x, actorPos ? actorPos.x : 0);
        const ty = finiteOr(y, actorPos ? actorPos.y : 0);
        const fromX = actorPos ? finiteOr(actorPos.x, tx) : tx;
        const fromY = actorPos ? finiteOr(actorPos.y, ty) : ty;
        const dir = normalizeDirection(tx - fromX, ty - fromY);
        const sx = actorPos ? fromX + dir.dx * 0.5 : tx + 0.5;
        const sy = actorPos ? fromY + dir.dy * 0.5 : ty + 0.5;
        if (!canShowAt(sx, sy)) return;
        const seed = ((((Number(actor || 0) | 0) * 73856093) ^ ((tx | 0) * 19349663) ^ ((ty | 0) * 83492791)) >>> 0);
        sparks.push({ x: sx, y: sy, age: 0, maxAge: SPARK_LIFE_SEC, seed });
        spawnBurst(sx, sy, dir.dx, dir.dy, seed);
      });
    }, { key: INSTALLED_KEY }));
  }

  function tick(dtSec) {
    const dt = Math.max(0, finiteOr(dtSec, 0));
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.age += dt;
      if (spark.age >= spark.maxAge) sparks.splice(i, 1);
    }
  }

  function getActiveLights() {
    const out = [];
    for (let i = 0; i < sparks.length; i++) {
      const spark = sparks[i];
      const life = Math.max(0, 1 - spark.age / spark.maxAge);
      const hot = life * life;
      out.push({
        x: spark.x,
        y: spark.y,
        radius: Math.max(0.05, SPARK_LIGHT_RADIUS * hot),
        color: [255, 245 * hot + 115 * (1 - hot), 210 * hot + 35 * (1 - hot)],
        flicker: hot,
        softness: 2,
      });
    }
    return out;
  }

  return { installListeners, tick, getActiveLights };
}
