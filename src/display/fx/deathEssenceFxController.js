// src/display/fx/deathEssenceFxController.js
// Leaves a small lingering "spirit essence" orb when an entity dies.
// Display-only VFX: spawned from the rules 'died' event, colorized from palette fg,
// and scaled by the dead entity's vitality.

import { buildPalette } from "../palette/index.js";

const INSTALLED_KEY = Symbol.for("jshack:display:deathEssenceFx:installed");
const MAX_ORBS = 256;
const ARRIVE_DURATION = 0.26;
const PALETTE = buildPalette();

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function easeOutCubic(t) {
  const u = 1 - clamp01(t);
  return 1 - (u * u * u);
}

function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * ((x - 1) ** 3) + c1 * ((x - 1) ** 2);
}

function parseHexColor(hex) {
  const raw = String(hex || "").trim();
  if (!raw) return { r: 207, g: 232, b: 255 };
  let h = raw[0] === "#" ? raw.slice(1) : raw;
  if (h.length === 3) h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return { r: 207, g: 232, b: 255 };
  const n = Number.parseInt(h, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function fgForIdentity(identity) {
  const key = String(identity || "").trim();
  return (
    PALETTE[key]?.fg
    || PALETTE.monster?.fg
    || "#cfe8ff"
  );
}

function orbScaleFromVitality(maxHp) {
  const hp = Math.max(1, Number(maxHp) || 1);
  // Square-root curve keeps early HP differences readable while preventing giant bosses
  // from creating absurdly large essence spheres.
  const t = clamp01((Math.sqrt(hp) - Math.sqrt(6)) / (Math.sqrt(140) - Math.sqrt(6)));
  return 0.82 + t * 1.10;
}

function seededUnit(seed) {
  const x = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   getFxTime?: () => number,
 *   getPosition?: (id:number) => ({x:number,y:number}|null),
 *   getEntityIdentity?: (id:number) => string,
 *   getEntityVitality?: (id:number) => ({ hp?:number, maxHp?:number }|null),
 * }} deps
 */
export function createDeathEssenceFxController({
  world,
  getFxTime,
  getPosition,
  getEntityIdentity,
  getEntityVitality,
}) {
  /** @type {Array<{
   *   x:number,
   *   y:number,
   *   bornAt:number,
   *   arrivalHeight:number,
   *   hoverAmp:number,
   *   hoverSpeed:number,
   *   phase:number,
   *   radius:number,
   *   glowRadius:number,
   *   r:number,
   *   g:number,
   *   b:number,
   * }>} */
  const orbs = [];

  let spawnSerial = 0;
  const now = () => Math.max(0, Number(getFxTime?.() || 0));

  function spawnDeathEssence(id) {
    const entityId = Number(id || 0) | 0;
    if (!(entityId > 0)) return;

    const pos = getPosition ? getPosition(entityId) : null;
    if (!pos) return;

    const vit = getEntityVitality ? getEntityVitality(entityId) : null;
    const maxHp = Math.max(1, Number(vit?.maxHp || vit?.hp || 1));
    const scale = orbScaleFromVitality(maxHp);
    const identity = getEntityIdentity ? getEntityIdentity(entityId) : "";
    const { r, g, b } = parseHexColor(fgForIdentity(identity));

    const seed = (entityId * 131 + spawnSerial++ * 31) >>> 0;
    const jitterA = seededUnit(seed);
    const jitterB = seededUnit(seed ^ 0x9e3779b9);

    orbs.push({
      x: Number(pos.x) + (jitterA - 0.5) * 0.06,
      y: Number(pos.y) + (jitterB - 0.5) * 0.06,
      bornAt: now(),
      arrivalHeight: 0.76 + jitterA * 0.34,
      hoverAmp: 0.018 + jitterB * 0.016,
      hoverSpeed: 1.5 + jitterA * 1.2,
      phase: jitterB * Math.PI * 2,
      radius: 0.082 * scale,
      glowRadius: 0.178 * scale,
      r,
      g,
      b,
    });

    if (orbs.length > MAX_ORBS) {
      orbs.splice(0, orbs.length - MAX_ORBS);
    }
  }

  function installListeners() {
    if (world[INSTALLED_KEY]) return;
    world[INSTALLED_KEY] = true;

    world.on("died", ({ id }) => {
      spawnDeathEssence(id);
    });
  }

  function tick(_dt) {
    void _dt;
  }

  /** @param {CanvasRenderingContext2D} bctx */
  function draw(bctx) {
    if (!bctx || orbs.length === 0) return;

    const tNow = now();
    bctx.save();

    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      const age = Math.max(0, tNow - o.bornAt);
      const arriveT = clamp01(age / ARRIVE_DURATION);
      const settle = 1 - easeOutCubic(arriveT);
      const dropOffset = o.arrivalHeight * settle;
      const pop = (arriveT < 0.45)
        ? (0.16 + 1.06 * easeOutBack(arriveT / 0.45))
        : (1.22 - 0.22 * easeOutCubic((arriveT - 0.45) / 0.55));
      const hover = age > ARRIVE_DURATION
        ? (Math.sin((age - ARRIVE_DURATION) * o.hoverSpeed + o.phase) * o.hoverAmp)
        : 0;
      const y = o.y - dropOffset - hover;

      const pulse = 0.9 + 0.1 * Math.sin(age * 2.1 + o.phase);
      const glowR = o.glowRadius * pop * pulse;
      const coreR = o.radius * pop;

      bctx.globalCompositeOperation = "lighter";
      const glow = bctx.createRadialGradient(o.x, y, 0, o.x, y, glowR);
      glow.addColorStop(0, `rgba(${o.r},${o.g},${o.b},0.34)`);
      glow.addColorStop(0.45, `rgba(${o.r},${o.g},${o.b},0.18)`);
      glow.addColorStop(1, `rgba(${o.r},${o.g},${o.b},0)`);
      bctx.fillStyle = glow;
      bctx.beginPath();
      bctx.arc(o.x, y, glowR, 0, Math.PI * 2);
      bctx.fill();

      bctx.globalCompositeOperation = "source-over";
      const core = bctx.createRadialGradient(o.x, y, coreR * 0.15, o.x, y, coreR);
      core.addColorStop(0, "rgba(255,255,255,0.92)");
      core.addColorStop(0.5, `rgba(${o.r},${o.g},${o.b},0.92)`);
      core.addColorStop(1, `rgba(${Math.max(0, o.r - 40)},${Math.max(0, o.g - 40)},${Math.max(0, o.b - 40)},0.75)`);
      bctx.fillStyle = core;
      bctx.beginPath();
      bctx.arc(o.x, y, coreR, 0, Math.PI * 2);
      bctx.fill();
    }

    bctx.restore();
  }

  function getActiveOrbs() {
    return orbs.map((o) => ({ ...o }));
  }

  return {
    installListeners,
    tick,
    draw,
    getActiveOrbs,
  };
}
