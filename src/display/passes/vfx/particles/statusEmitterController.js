const INSTALLED_KEY = Symbol.for("jshack:display:statusEmitters:installed");

/**
 * Display-only controller for continuous status/kind particle emitters.
 * Keeps emitter lifecycle and animated origins out of main.js.
 */
export function createStatusEmitterController({ world, fx }) {
  const burningEmitters = new Set();
  const bleedEmitters = new Set();
  const poisonEmitters = new Set();
  const regenEmitters = new Set();
  const shockEmitters = new Set();
  const frozenEmitters = new Set();
  const cursedEmitters = new Set();
  const blessedEmitters = new Set();
  const fountainEmitters = new Set();
  const furnaceEmitters = new Set();
  const cookFireEmitters = new Set();
  const torchEmitters = new Set();
  const familiarEmitters = new Set();
  const familiarCooldowns = new Set();
  const dryFountains = new Set();
  const seenEmitterKeys = new Set();
  const origins = [];

  /** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
  const STATUS_EMITTER_CFG = {
    burning: { tracker: burningEmitters, prefix: "burn", cfg: { rate: 18, angle: -Math.PI / 2, spread: Math.PI / 5, speed: 0.8, speedJitter: 0.4, ax: 0, ay: -0.5, life: 0.7, lifeJitter: 0.3, size: 0.28, sizeEnd: 0.06, color: "#ff8c00", alpha0: 0.9, alpha1: 0.0, offsetX: 0, offsetY: -0.15 } },
    bleeding: { tracker: bleedEmitters, prefix: "bleed", cfg: { rate: 14, angle: Math.PI / 2, spread: Math.PI / 8, speed: 0.55, speedJitter: 0.3, ax: 0, ay: 1.2, life: 0.9, lifeJitter: 0.3, size: 0.14, sizeEnd: 0.05, color: "#bb1111", alpha0: 0.9, alpha1: 0.0 } },
    poisoned: { tracker: poisonEmitters, prefix: "poison", cfg: { rate: 4, angle: 0, spread: Math.PI * 2, speed: 0.15, speedJitter: 0.1, ax: 0, ay: -0.04, life: 1.6, lifeJitter: 0.5, size: 0.08, sizeEnd: 0.03, color: "#33ff55", alpha0: 0.35, alpha1: 0.0 } },
    regen: { tracker: regenEmitters, prefix: "regen", cfg: { rate: 12, angle: -Math.PI / 2, spread: Math.PI / 4, speed: 0.4, speedJitter: 0.15, ax: 0, ay: -0.1, life: 1.0, lifeJitter: 0.4, size: 0.15, sizeEnd: 0.04, color: "#f6faff", alpha0: 0.8, alpha1: 0.0 } },
    shocked: { tracker: shockEmitters, prefix: "shock", cfg: { rate: 30, angle: 0, spread: Math.PI * 2, speed: 1.2, speedJitter: 0.8, ax: 0, ay: 0, life: 0.2, lifeJitter: 0.1, size: 0.1, sizeEnd: 0.02, color: "#00ccff", alpha0: 1.0, alpha1: 0.0 } },
    frozen: { tracker: frozenEmitters, prefix: "frozen", cfg: { rate: 15, angle: 0, spread: Math.PI * 2, speed: 0.22, speedJitter: 0.14, ax: 0, ay: 0.04, life: 1.8, lifeJitter: 0.5, size: 0.12, sizeEnd: 0.04, color: "#aaeeff", alpha0: 0.6, alpha1: 0.0 } },
    cursed: { tracker: cursedEmitters, prefix: "cursed", cfg: { rate: 12, angle: -Math.PI / 2, spread: Math.PI, speed: 0.5, speedJitter: 0.3, ax: 0, ay: -0.25, life: 1.2, lifeJitter: 0.4, size: 0.14, sizeEnd: 0.02, color: "#8822cc", alpha0: 0.7, alpha1: 0.0 } },
    blessed: { tracker: blessedEmitters, prefix: "blessed", cfg: { rate: 10, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.6, speedJitter: 0.2, ax: 0, ay: -0.35, life: 1.0, lifeJitter: 0.3, size: 0.09, sizeEnd: 0.02, color: "#ffcc00", alpha0: 0.8, alpha1: 0.0 } },
  };
  /** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
  const KIND_EMITTER_CFG = {
    fountain: { tracker: fountainEmitters, prefix: "fountain", cfg: { continuous: true, rate: 16, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 1.4, speedJitter: 0.5, ax: 0, ay: 2.5, life: 1.2, lifeJitter: 0.3, size: 0.35, sizeEnd: 0.08, color: "#66ccff", alpha0: 0.7, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
    furnace: { tracker: furnaceEmitters, prefix: "furnace", cfg: { continuous: true, rate: 22, angle: -Math.PI / 2, spread: Math.PI / 5, speed: 0.9, speedJitter: 0.3, ax: 0, ay: -0.1, life: 0.65, lifeJitter: 0.2, size: 0.42, sizeEnd: 0.04, color: "#ff6600", alpha0: 0.88, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
    cooking_fire: { tracker: cookFireEmitters, prefix: "cfire", cfg: { continuous: true, rate: 14, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.65, speedJitter: 0.3, ax: 0, ay: -0.05, life: 0.9, lifeJitter: 0.3, size: 0.35, sizeEnd: 0.04, color: "#ff8800", alpha0: 0.75, alpha1: 0.0, offsetX: 0, offsetY: 0 } },
    torch: { tracker: torchEmitters, prefix: "torch", cfg: { continuous: true, rate: 10, angle: -Math.PI / 2, spread: Math.PI / 6, speed: 0.5, speedJitter: 0.4, ax: 0, ay: -0.3, life: 0.6, lifeJitter: 0.3, size: 0.22, sizeEnd: 0.03, color: "#ffaa33", alpha0: 0.85, alpha1: 0.0, offsetX: 0, offsetY: -0.1 } },
    familiar: { tracker: familiarEmitters, prefix: "fam", cfg: { continuous: true, rate: 8, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.45, speedJitter: 0.25, ax: 0, ay: -0.15, life: 0.55, lifeJitter: 0.2, size: 0.18, sizeEnd: 0.03, color: "#ff6600", alpha0: 0.7, alpha1: 0.0, offsetX: 0, offsetY: -0.1 } },
  };

  function installListeners() {
    if (!world || world[INSTALLED_KEY]) return;
    world[INSTALLED_KEY] = true;

    world.on("fountain:dry", ({ targetId }) => {
      const id = Number(targetId || 0);
      if (!(id > 0)) return;
      dryFountains.add(id);
      fountainEmitters.delete(id);
      fx.removeEmitter(`fountain:${id}`);
    });
    world.on("spawned", ({ id, kind }) => {
      if (String(kind || "") !== "fountain") return;
      dryFountains.delete(Number(id || 0));
    });
    world.on("fountain:refilled", ({ targetId }) => {
      const id = Number(targetId || 0);
      if (!(id > 0)) return;
      dryFountains.delete(id);
    });
    world.on("familiar:fired", ({ id }) => {
      const fid = Number(id || 0);
      if (!(fid > 0)) return;
      familiarCooldowns.add(fid);
      familiarEmitters.delete(fid);
      fx.removeEmitter(`fam:${fid}`);
    });
    world.on("familiar:ready", ({ id }) => {
      const fid = Number(id || 0);
      if (!(fid > 0)) return;
      familiarCooldowns.delete(fid);
    });
  }

  function step(dtSec, view, fxTime) {
    origins.length = 0;
    seenEmitterKeys.clear();
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (Array.isArray(e.tags)) {
        for (let t = 0; t < e.tags.length; t++) {
          const tag = e.tags[t];
          const sc = STATUS_EMITTER_CFG[tag];
          if (!sc) continue;
          const key = `${sc.prefix}:${e.id}`;
          seenEmitterKeys.add(key);
          if (!sc.tracker.has(e.id)) {
            fx.ensureEmitter(key, { continuous: true, ...sc.cfg });
            sc.tracker.add(e.id);
          }
          if (tag === "regen") {
            const phase = (fxTime * 3.2) + (e.id * 0.61803398875);
            const orbitX = Math.cos(phase) * 0.32;
            const orbitY = Math.sin(phase) * 0.16;
            const bobY = Math.sin(phase * 0.5) * 0.04;
            if (orbitY >= 0) {
              origins.push({ key, x: e.pos.x + orbitX, y: e.pos.y + 0.24 + orbitY + bobY });
            }
          } else {
            origins.push({ key, x: e.pos.x, y: e.pos.y });
          }
        }
      }
      const kc = KIND_EMITTER_CFG[e.kind];
      if (kc) {
        if (e.kind === "fountain" && dryFountains.has(e.id)) continue;
        if (e.kind === "familiar" && familiarCooldowns.has(e.id)) continue;
        const key = `${kc.prefix}:${e.id}`;
        seenEmitterKeys.add(key);
        if (!kc.tracker.has(e.id)) {
          fx.ensureEmitter(key, kc.cfg);
          kc.tracker.add(e.id);
        }
        origins.push({ key, x: e.pos.x, y: e.pos.y });
      }
    }
    for (const tag in STATUS_EMITTER_CFG) {
      const sc = STATUS_EMITTER_CFG[tag];
      if (!sc) continue;
      for (const id of sc.tracker) {
        if (!seenEmitterKeys.has(`${sc.prefix}:${id}`)) {
          fx.removeEmitter(`${sc.prefix}:${id}`);
          sc.tracker.delete(id);
        }
      }
    }
    for (const kind in KIND_EMITTER_CFG) {
      const kc = KIND_EMITTER_CFG[kind];
      if (!kc) continue;
      for (const id of kc.tracker) {
        if (!seenEmitterKeys.has(`${kc.prefix}:${id}`)) {
          fx.removeEmitter(`${kc.prefix}:${id}`);
          kc.tracker.delete(id);
        }
      }
    }
    fx.step(dtSec, origins);
  }

  return { installListeners, step };
}
