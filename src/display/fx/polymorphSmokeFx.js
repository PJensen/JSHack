import { defineExtension } from "../../lib/ecs-js/index.js";
import { Particle } from "../passes/vfx/particles/particlePool.js";

const POLYMORPH_SMOKE_EXTENSION_KEY = Symbol.for("jshack:display:polymorphSmokeFx");

export function spawnPolymorphSmoke(fx, at, random = Math.random) {
  const x = Number(at?.x);
  const y = Number(at?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;

  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const speed = 0.12 + random() * 0.42;
    const violet = i % 3 === 0;
    fx.pool.spawn(new Particle({
      x: x + 0.5 + (random() - 0.5) * 0.22,
      y: y + 0.5 + (random() - 0.5) * 0.18,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.28 - random() * 0.18,
      ax: 0,
      ay: -0.08,
      life: 0.42 + random() * 0.34,
      size0: 0.11 + random() * 0.08,
      size1: 0.30 + random() * 0.18,
      r: violet ? 174 : 116,
      g: violet ? 116 : 108,
      b: violet ? 214 : 132,
      a0: violet ? 0.72 : 0.62,
      a1: 0,
    }));
  }
  return count;
}

export function createPolymorphSmokeExtension({ fx }) {
  return defineExtension("jshack:display:polymorphSmokeFx", (world) => {
    return world.on("polymorph:after", ({ at, trigger, reason }) => {
      if (String(trigger || "") !== "scroll" && String(reason || "") !== "scroll_polymorph") return;
      spawnPolymorphSmoke(fx, at);
    });
  }, { key: POLYMORPH_SMOKE_EXTENSION_KEY });
}

