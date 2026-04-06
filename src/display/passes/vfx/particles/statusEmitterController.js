import { isGoreDisabled } from "../../../ui/wiring/goreEngine.js";

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
  const agonyEmitters = new Set();
  const blindedEmitters = new Set();
  const fountainEmitters = new Set();
  const furnaceEmitters = new Set();
  const cookFireEmitters = new Set();
  const torchEmitters = new Set();
  const familiarEmitters = new Set();
  const weaponProfileEmitterKeys = new Set();
  const familiarCooldowns = new Set();
  const dryFountains = new Set();
  const seenEmitterKeys = new Set();
  const origins = [];
  const lightProbes = [];
  let _fxTime = 0;

  function computeCarryOrigin(entity, slot, carryAnchor) {
    const dx = Math.sign(Number(entity?.facing?.dx || 0));
    const dy = Math.sign(Number(entity?.facing?.dy || 0));
    const hasFacing = dx !== 0 || dy !== 0;
    const fxv = hasFacing ? dx : 0;
    const fyv = hasFacing ? dy : -1;
    const lx = -fyv;
    const ly = fxv;
    const handSign = String(slot || "weapon").toLowerCase() === "offhand" ? -1 : 1;
    const forward = Number.isFinite(Number(carryAnchor?.forward)) ? Number(carryAnchor.forward) : 0.40;
    const lateral = Number.isFinite(Number(carryAnchor?.lateral)) ? Number(carryAnchor.lateral) : 0.17;
    const vertical = Number.isFinite(Number(carryAnchor?.vertical)) ? Number(carryAnchor.vertical) : -0.02;
    return {
      x: Number(entity?.pos?.x || 0) + (fxv * forward) + (lx * lateral * handSign),
      y: Number(entity?.pos?.y || 0) + (fyv * forward) + (ly * lateral * handSign) + vertical,
    };
  }

  function computeProfileLightFlicker(light, id, fxTime) {
    const flicker = light?.flicker;
    if (!flicker || flicker.mode !== "sin") return 1.0;
    const base = Number.isFinite(Number(flicker.base)) ? Number(flicker.base) : 1.0;
    const amp = Number.isFinite(Number(flicker.amp)) ? Number(flicker.amp) : 0.0;
    const speed = Number.isFinite(Number(flicker.speed)) ? Number(flicker.speed) : 1.0;
    const phase = Number.isFinite(Number(flicker.phase)) ? Number(flicker.phase) : 0.5;
    return Math.max(0.35, base + amp * Math.sin(Number(fxTime || 0) * speed + (Number(id || 0) * phase)));
  }

  /** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
  const TAG_EMITTER_CFG = {
    burning: { tracker: burningEmitters, prefix: "burn", cfg: { rate: 24, angle: -Math.PI / 2, spread: Math.PI / 7, speed: 0.95, speedJitter: 0.32, ax: 0, ay: -0.72, life: 0.95, lifeJitter: 0.28, size: 0.36, sizeEnd: 0.08, color: "#ffb347", alpha0: 0.98, alpha1: 0.0, offsetX: 0, offsetY: -0.18 } },
    bleeding: { tracker: bleedEmitters, prefix: "bleed", cfg: { rate: 34, angle: Math.PI / 2, spread: Math.PI / 5, speed: 0.85, speedJitter: 0.45, ax: 0, ay: 1.4, life: 1.0, lifeJitter: 0.34, size: 0.17, sizeEnd: 0.05, color: "#d21a1a", alpha0: 0.95, alpha1: 0.0 } },
    poisoned: { tracker: poisonEmitters, prefix: "poison", cfg: { rate: 4, angle: 0, spread: Math.PI * 2, speed: 0.15, speedJitter: 0.1, ax: 0, ay: -0.04, life: 1.6, lifeJitter: 0.5, size: 0.08, sizeEnd: 0.03, color: "#33ff55", alpha0: 0.35, alpha1: 0.0 } },
    regen: { tracker: regenEmitters, prefix: "regen", cfg: { rate: 12, angle: -Math.PI / 2, spread: Math.PI / 4, speed: 0.4, speedJitter: 0.15, ax: 0, ay: -0.1, life: 1.0, lifeJitter: 0.4, size: 0.15, sizeEnd: 0.04, color: "#f6faff", alpha0: 0.8, alpha1: 0.0 } },
    shocked: { tracker: shockEmitters, prefix: "shock", cfg: { rate: 30, angle: 0, spread: Math.PI * 2, speed: 1.2, speedJitter: 0.8, ax: 0, ay: 0, life: 0.2, lifeJitter: 0.1, size: 0.1, sizeEnd: 0.02, color: "#00ccff", alpha0: 1.0, alpha1: 0.0 } },
    frozen: { tracker: frozenEmitters, prefix: "frozen", cfg: { rate: 15, angle: 0, spread: Math.PI * 2, speed: 0.22, speedJitter: 0.14, ax: 0, ay: 0.04, life: 1.8, lifeJitter: 0.5, size: 0.12, sizeEnd: 0.04, color: "#aaeeff", alpha0: 0.6, alpha1: 0.0 } },
    cursed: { tracker: cursedEmitters, prefix: "cursed", cfg: { rate: 12, angle: -Math.PI / 2, spread: Math.PI, speed: 0.5, speedJitter: 0.3, ax: 0, ay: -0.25, life: 1.2, lifeJitter: 0.4, size: 0.14, sizeEnd: 0.02, color: "#8822cc", alpha0: 0.7, alpha1: 0.0 } },
    blessed: { tracker: blessedEmitters, prefix: "blessed", cfg: { rate: 10, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.6, speedJitter: 0.2, ax: 0, ay: -0.35, life: 1.0, lifeJitter: 0.3, size: 0.09, sizeEnd: 0.02, color: "#ffcc00", alpha0: 0.8, alpha1: 0.0 } },
    agony: { tracker: agonyEmitters, prefix: "agony", cfg: { rate: 14, angle: -Math.PI / 2, spread: Math.PI, speed: 0.55, speedJitter: 0.30, ax: 0, ay: -0.22, life: 1.0, lifeJitter: 0.4, size: 0.18, sizeEnd: 0.05, color: "#bb44ee", alpha0: 0.85, alpha1: 0.0 } },
    blinded: { tracker: blindedEmitters, prefix: "blind", cfg: { rate: 10, angle: -Math.PI / 2, spread: Math.PI * 2, speed: 0.25, speedJitter: 0.15, ax: 0, ay: -0.08, life: 1.4, lifeJitter: 0.5, size: 0.14, sizeEnd: 0.03, color: "#6633aa", alpha0: 0.7, alpha1: 0.0 } },
    torch: { tracker: torchEmitters, prefix: "torch", cfg: { continuous: true, rate: 10, angle: -Math.PI / 2, spread: Math.PI / 6, speed: 0.5, speedJitter: 0.4, ax: 0, ay: -0.9, life: 0.6, lifeJitter: 0.3, size: 0.22, sizeEnd: 0.03, color: "#ffaa33", alpha0: 0.85, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
  };
  /** @type {Record<string, {tracker: Set<number>, prefix: string, cfg: Record<string, any>}>} */
  const KIND_EMITTER_CFG = {
    fountain: { tracker: fountainEmitters, prefix: "fountain", cfg: { continuous: true, rate: 16, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 1.4, speedJitter: 0.5, ax: 0, ay: 2.5, life: 1.2, lifeJitter: 0.3, size: 0.35, sizeEnd: 0.08, color: "#66ccff", alpha0: 0.7, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
    furnace: { tracker: furnaceEmitters, prefix: "furnace", cfg: { continuous: true, rate: 22, angle: -Math.PI / 2, spread: Math.PI / 5, speed: 0.9, speedJitter: 0.3, ax: 0, ay: -0.1, life: 0.65, lifeJitter: 0.2, size: 0.42, sizeEnd: 0.04, color: "#ff6600", alpha0: 0.88, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
    cooking_fire: { tracker: cookFireEmitters, prefix: "cfire", cfg: { continuous: true, rate: 14, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.65, speedJitter: 0.3, ax: 0, ay: -0.05, life: 0.9, lifeJitter: 0.3, size: 0.35, sizeEnd: 0.04, color: "#ff8800", alpha0: 0.75, alpha1: 0.0, offsetX: 0, offsetY: 0 } },
    torch: { tracker: torchEmitters, prefix: "torch", cfg: { continuous: true, rate: 10, angle: -Math.PI / 2, spread: Math.PI / 6, speed: 0.5, speedJitter: 0.4, ax: 0, ay: -0.9, life: 0.6, lifeJitter: 0.3, size: 0.22, sizeEnd: 0.03, color: "#ffaa33", alpha0: 0.85, alpha1: 0.0, offsetX: 0, offsetY: -0.3 } },
    familiar: { tracker: familiarEmitters, prefix: "fam", cfg: { continuous: true, rate: 8, angle: -Math.PI / 2, spread: Math.PI / 3, speed: 0.45, speedJitter: 0.25, ax: 0, ay: -0.15, life: 0.55, lifeJitter: 0.2, size: 0.18, sizeEnd: 0.03, color: "#ff6600", alpha0: 0.7, alpha1: 0.0, offsetX: -0.2, offsetY: -0.1 } },
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
    _fxTime = Number(fxTime || 0);
    origins.length = 0;
    lightProbes.length = 0;
    seenEmitterKeys.clear();
    const isVisibleAt = (typeof view?.isVisible === "function") ? view.isVisible : null;
    for (let i = 0; i < view.entities.length; i++) {
      const e = view.entities[i];
      if (isVisibleAt && !isVisibleAt(e.pos.x, e.pos.y)) continue;
      if (
        Array.isArray(e.tags)
        && (e.tags.includes("memory_recent") || e.tags.includes("esp_sensed") || e.tags.includes("thermal_sensed"))
      ) continue;
      if (Array.isArray(e.tags)) {
        for (let t = 0; t < e.tags.length; t++) {
          const tag = e.tags[t];
          const sc = TAG_EMITTER_CFG[tag];
          if (!sc) continue;
          if (tag === "bleeding" && isGoreDisabled()) continue;
          const key = `${sc.prefix}:${e.id}`;
          seenEmitterKeys.add(key);
          if (!sc.tracker.has(e.id)) {
            fx.ensureEmitter(key, { continuous: true, ...sc.cfg });
            sc.tracker.add(e.id);
          }
          const origin = { x: e.pos.x, y: e.pos.y };
          if (tag === "regen") {
            const phase = (fxTime * 3.2) + (e.id * 0.61803398875);
            const orbitX = Math.cos(phase) * 0.32;
            const orbitY = Math.sin(phase) * 0.16;
            const bobY = Math.sin(phase * 0.5) * 0.04;
            if (orbitY >= 0) {
              origins.push({ key, x: e.pos.x + orbitX, y: e.pos.y + 0.24 + orbitY + bobY });
            }
          } else {
            origins.push({ key, x: origin.x, y: origin.y });
          }
          if (tag === "burning") {
            lightProbes.push({ kind: "burning", id: e.id, x: origin.x, y: origin.y });
          }
        }
      }

      if (Array.isArray(e.weaponVfx)) {
        for (let w = 0; w < e.weaponVfx.length; w++) {
          const profile = e.weaponVfx[w];
          if (!profile) continue;
          const slot = String(profile?.slot || "weapon").toLowerCase();
          const profileId = String(profile?.id || "profile").toLowerCase();
          const origin = computeCarryOrigin(e, slot, profile?.carryAnchor || null);
          const emitterCfg = profile?.carryEmitter;
          if (emitterCfg && typeof emitterCfg === "object") {
            const key = `wpvfx:${profileId}:${slot}:${e.id}`;
            seenEmitterKeys.add(key);
            if (!weaponProfileEmitterKeys.has(key)) {
              fx.ensureEmitter(key, { continuous: true, ...emitterCfg });
              weaponProfileEmitterKeys.add(key);
            }
            origins.push({ key, x: origin.x, y: origin.y });
          }
          const lightCfg = profile?.carryLight;
          const lightColor = Array.isArray(lightCfg?.color) ? lightCfg.color : null;
          if (lightColor && Number.isFinite(Number(lightCfg?.radius)) && Number(lightCfg.radius) > 0) {
            lightProbes.push({
              kind: "weapon_profile",
              id: e.id,
              x: origin.x,
              y: origin.y,
              light: lightCfg,
            });
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
        if (e.kind === "familiar") {
          lightProbes.push({ kind: "familiar_ready", id: e.id, x: e.pos.x, y: e.pos.y });
        }
      }
    }

    for (const tag in TAG_EMITTER_CFG) {
      const sc = TAG_EMITTER_CFG[tag];
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
    for (const key of weaponProfileEmitterKeys) {
      if (seenEmitterKeys.has(key)) continue;
      fx.removeEmitter(key);
      weaponProfileEmitterKeys.delete(key);
    }
    fx.step(dtSec, origins);
  }

  function getActiveLights() {
    const out = [];
    for (let i = 0; i < lightProbes.length; i++) {
      const p = lightProbes[i];
      if (p.kind === "burning") {
        const f = 1.0;
        out.push({ x: p.x + 0.5, y: p.y + 0.5, radius: 1.9 * f, color: [255, 120, 40], flicker: f });
      } else if (p.kind === "weapon_profile") {
        const light = p.light || null;
        if (!light) continue;
        const f = computeProfileLightFlicker(light, p.id, _fxTime);
        const color = Array.isArray(light.color) ? light.color : [255, 160, 80];
        const radius = Number(light.radius || 1);
        out.push({
          x: p.x + 0.5,
          y: p.y + 0.5,
          radius: radius * f,
          color: [Number(color[0]) || 255, Number(color[1]) || 160, Number(color[2]) || 80],
          flicker: f,
        });
      } else if (p.kind === "familiar_ready") {
        const id = Number(p.id || 0) | 0;
        const f = 0.90 + 0.10 * Math.sin(_fxTime * 6.4 + id * 0.43);
        out.push({ x: p.x + 0.5, y: p.y + 0.5, radius: 1.7 * f, color: [255, 160, 80], flicker: f });
      }
    }
    return out;
  }

  return { installListeners, step, getActiveLights };
}
