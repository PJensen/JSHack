// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "../app/rules/scheduler.js";
import { buildWorldView } from "./bridge/schema/worldView.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera } from "./display/camera/controller.js";
import { updateShake, startShake } from "./display/camera/shake.js";
import { zoomTo, jumpTo } from "./display/camera/utils.js";
import { followEntity } from "./display/camera/follow.js";

// display/ particles (pure display-side FX; no ECS, no rules)
import { ParticleFX } from "./display/passes/vfx/particles/particlePool.js";
import { createGlyphAtlas, drawKind } from "./display/passes/glyphs/atlas.js";
import { FloatText } from "./display/passes/vfx/text/floatText.js";
import { buildPalette } from "./display/palette/index.js";
import { collectLightSources } from "./display/lighting/sources/index.js";
import { renderEmissiveLights } from "./display/lighting/renderEmissiveLights.js";

// display overlays & UI bridges
import { setupUIEventListeners } from "./main/ui/setupUIEventListeners.js";
import { createHudFeeds } from "./main/ui/hudFeeds.js";

// world scene + rules adapters
import { populateDemoScene } from "./main/scene/demoScene.js";
import { createActiveSpellController } from "./main/spells/activeSpellController.js";
import { setupWorldEventHandlers } from "./main/world/worldEvents.js";
import { GeometryKernel } from "./rules/environment/GeometryKernel.js";

// ---- Canvas & sizing -------------------------------------------------------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;
// Optional backbuffer to mirror DPR and present once per frame (reduces state churn)
const back = document.createElement("canvas");
const bctx = back.getContext("2d", { alpha: false });
if (bctx) bctx.imageSmoothingEnabled = false;

// Quality/perf controls
const PERF = (() => {
  const params = new URLSearchParams(window.location.search || "");
  const q = (params.get("quality") || (typeof localStorage !== "undefined"
    ? localStorage.getItem("jshack.quality") : "high") || "high").toLowerCase();
  const defaultCap = 1.5; // mobile-first
  const dprCapArg = Number(params.get("dprCap")) || Number((typeof localStorage !== "undefined" && localStorage.getItem("jshack.dprCap")) || 0);
  const dprCap = Number.isFinite(dprCapArg) && dprCapArg > 0 ? dprCapArg : defaultCap;
  const isLow = q === "low";
  const isHigh = q === "high";
  const fovRayArg = Number(params.get("fovRays")) || Number((typeof localStorage !== "undefined" && localStorage.getItem("jshack.fovRays")) || 0);
  const defaultRays = isLow ? 96 : 192;
  const fovRayCount = Number.isFinite(fovRayArg) && fovRayArg > 0
    ? Math.max(32, Math.min(512, Math.floor(fovRayArg)))
    : defaultRays;
  return {
    quality: q,
    dprCap: isHigh ? 3 : (isLow ? 1 : dprCap),
    glowLayers: isLow ? 0 : 2,
    particleCapacity: isLow ? 512 : 4096,
    cameraLerp: (params.get("cameraLerp") !== null ? Number(params.get("cameraLerp")) : 0),
    fovRayCount,
  };
})();

// Use tile-sized world units: 1 world unit == 1 tile on screen
const TILE_PX = 28;

const TAU = Math.PI * 2;
const WALL_THICKNESS = 0.45;
const FOV_RAY_COUNT = PERF.fovRayCount;
const FOV_MIN_DISTANCE = 6;
const FOV_MAX_DISTANCE = 24;

const dungeonRenderState = {
  versionKey: null,
  primitives: [],
  dots: [],
  kernel: null,
  mbr: null,
  options: null,
};

const _lightEmitterKeys = new Set();
let _particleOrigins = [];

let _cssW = 0, _cssH = 0, _dpr = 1;
function resize() {
  const rawDpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const maxCap = Math.max(1, Math.floor(PERF.dprCap || 1));
  const dpr = Math.max(1, Math.min(rawDpr, maxCap));

  const vw = Math.max(1, (window.innerWidth | 0));
  const vh = Math.max(1, (window.innerHeight | 0));
  const cols = Math.max(1, Math.floor(vw / TILE_PX));
  const rows = Math.max(1, Math.floor(vh / TILE_PX));
  const cssW = cols * TILE_PX;
  const cssH = rows * TILE_PX;

  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  back.width = canvas.width;
  back.height = canvas.height;
  if (bctx) bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  _cssW = cssW; _cssH = cssH; _dpr = dpr;
}
addEventListener("resize", resize);
resize();

// ---- World setup -----------------------------------------------------------
const world = new World({ seed: 0xa77a77 });
configureWorld(world);
populateDemoScene(world);

function stepSim(dtTurns = 0) {
  if (dtTurns > 0) {
    world.tick(dtTurns);
  }
}

const activeSpells = createActiveSpellController(world);

// ---- Display camera (resource) ---------------------------------------------
const cam = createCamera();
cam.scale = TILE_PX;
cam.targetScale = TILE_PX;
if (PERF.cameraLerp !== null && Number.isFinite(PERF.cameraLerp)) cam.lerpSpeed = Math.max(0, PERF.cameraLerp);

// ---- Particle FX (display-only) -------------------------------------------
const fx = new ParticleFX({ capacity: PERF.particleCapacity, seedBase: (world.seed >>> 0) });
fx.ctx = bctx;
fx.worldToScreen = (p) => ({ x: p.x, y: p.y, size: p.size });

// Floating combat text (display-only, world-space)
const ftext = new FloatText();
try {
  /** @type any */ (window).float_text = (x, y, text, opts) => ftext.add(x, y, text, opts || {});
} catch {}

// ---- World-driven event hooks ---------------------------------------------
const worldEvents = setupWorldEventHandlers(world, {
  cam,
  ftext,
  startShake,
  activeSpells,
});

// ---- HUD feeds -------------------------------------------------------------
const hudFeeds = createHudFeeds(world, { getPlayerMana: activeSpells.getPlayerMana });

// ---- UI wiring -------------------------------------------------------------
setupUIEventListeners(world, {
  canvas,
  cam,
  tileSize: TILE_PX,
  getMessageLogEntries: worldEvents.getMessageLogEntries,
  activeSpells,
});

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: (PERF.quality === "low" ? 32 : 64), fontPx: (PERF.quality === "low" ? 28 : 56) });

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0;
function render(worldView) {
  const W = _cssW;
  const H = _cssH;

  bctx.save();
  if (!_bgGrad || _bgGradH !== H) {
    _bgGrad = bctx.createLinearGradient(0, 0, 0, H);
    _bgGrad.addColorStop(0, "#0b0e16");
    _bgGrad.addColorStop(1, "#0a0c14");
    _bgGradH = H;
  }
  bctx.fillStyle = _bgGrad; bctx.fillRect(0, 0, W, H);
  bctx.restore();

  bctx.save();
  applyCamera(bctx, cam, back);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const dungeonState = ensureDungeonRenderState(worldView.dungeon);
  const fovPolygon = samplePlayerFovPolygon(dungeonState.kernel, worldView.player, FOV_RAY_COUNT);
  if (dungeonState.primitives.length > 0) {
    drawDungeon(bctx, palette, glyphAtlas, dungeonState);
    drawFovCone(bctx, dungeonState, worldView, palette, fovPolygon);
  }

  drawBoundingCircles(bctx, worldView.entities, palette);

  const isTileKind = (k) => k === "floor" || k === "wall" || (typeof k === "string" && k.startsWith("door_"));

  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1;
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  const visibleActors = [];
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    if (isTileKind(e.kind)) {
      const k = (typeof e.kind === "string") ? e.kind : "default";
      drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);
    } else {
      visibleActors.push(e);
    }
  }

  const lights = collectLightSources(worldView, { quality: PERF.quality });
  const boltLights = (typeof worldEvents.getBoltLightSources === 'function')
    ? worldEvents.getBoltLightSources()
    : [];
  const arrowLights = (typeof worldEvents.getArrowLightSources === 'function')
    ? worldEvents.getArrowLightSources()
    : [];
  const allLights = [...lights, ...boltLights, ...arrowLights];
  const fovLight = fovPolygon ? { ...fovPolygon, color: palette.player?.glow || "#6cf" } : null;
  renderEmissiveLights(
    bctx,
    dungeonState.kernel,
    allLights,
    { x0: vx0, y0: vy0, x1: vx1, y1: vy1 },
    _fxTime,
    { quality: PERF.quality, fov: fovLight, irregularity: 0.2, warmth: 0.35 }
  );
  _particleOrigins = syncLightEmitters(allLights, fx, _fxTime);

  for (let i = 0; i < visibleActors.length; i++) {
    const e = visibleActors[i];
    const k = (typeof e.kind === "string") ? e.kind : "default";
    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);

    if (PERF.quality !== "low" && Array.isArray(e.tags) && e.tags.includes("invulnerable")) {
      const cx = e.pos.x, cy = e.pos.y;
      const baseR = Math.max(0.2, Number(e.radius) || 0.45);
      const wob = 0.06 * Math.sin(_fxTime * 5.5);
      const r = baseR + wob;
      bctx.save();
      bctx.globalCompositeOperation = "lighter";
      bctx.lineJoin = "round";
      bctx.lineCap = "round";
      bctx.lineWidth = 0.08;
      bctx.strokeStyle = "rgba(255,255,255,0.5)";
      // Soft blur halo
      bctx.shadowBlur = 12;
      bctx.shadowColor = "rgba(255,255,255,0.35)";
      bctx.beginPath();
      bctx.arc(cx, cy, r, 0, Math.PI * 2);
      bctx.stroke();
      // Inner crisp core
      bctx.shadowBlur = 0;
      bctx.lineWidth = 0.05;
      bctx.strokeStyle = "rgba(255,255,255,0.35)";
      bctx.beginPath();
      bctx.arc(cx, cy, r * 0.985, 0, Math.PI * 2);
      bctx.stroke();
      bctx.restore();
    }
    if (PERF.quality !== "low" && Array.isArray(e.tags) && e.tags.includes("stunned")) {
      const cx = e.pos.x, cy = e.pos.y;
      const baseR = Math.max(0.22, Number(e.radius) || 0.42);
      const wob = 0.05 * Math.sin(_fxTime * 6.0 + (e.id || 0));
      const r = baseR + wob;
      bctx.save();
      bctx.globalCompositeOperation = "lighter";
      bctx.lineJoin = "round"; bctx.lineCap = "round";
      bctx.strokeStyle = "rgba(255,220,110,0.85)";
      bctx.lineWidth = 0.07;
      const segs = 10;
      const gap = Math.PI * 2 / segs * 0.35;
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2 + wob * 0.8;
        const a1 = a0 + (Math.PI * 2 / segs) - gap;
        bctx.beginPath(); bctx.arc(cx, cy, r, a0, a1); bctx.stroke();
      }
      bctx.restore();
    }

      if (PERF.quality !== "low" && Array.isArray(e.tags) && e.tags.includes("thorns")) {
      const g = /** @type any */ (bctx);
      g.save();
      g.globalCompositeOperation = "lighter";
      const cx = e.pos.x, cy = e.pos.y;
      g.fillStyle = "rgba(120,255,120,0.10)";
      g.beginPath(); g.arc(cx, cy, 0.36, 0, Math.PI * 2); g.fill();
      const n = 8;
      const base = 0.30; const out = 0.52;
      const wob = 0.02 * Math.sin(_fxTime * 5.0);
      g.lineWidth = 0.06;
      g.strokeStyle = "rgba(120,255,120,0.85)";
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + _fxTime * 0.8;
        const x0 = cx + Math.cos(a) * base;
        const y0 = cy + Math.sin(a) * base;
        const x1 = cx + Math.cos(a) * (out + wob);
        const y1 = cy + Math.sin(a) * (out + wob);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      g.strokeStyle = "rgba(120,255,160,0.35)";
      g.lineWidth = 0.05;
      g.beginPath(); g.arc(cx, cy, out + 0.02, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  if (bctx) {
    worldEvents.drawBoltEffects(bctx);
    worldEvents.drawRippleEffects && worldEvents.drawRippleEffects(bctx);
    worldEvents.drawArrowEffects && worldEvents.drawArrowEffects(bctx);
  }

  fx.render({ mode: (PERF.quality === "low" ? "source-over" : "lighter"), alphaScale: 0.9, shape: (PERF.quality === "low" ? "rect" : "circle") });

  if (bctx) ftext.render(bctx);

  bctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(back, 0, 0);
  ctx.restore();

  if (PERF.quality !== "low") {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#9cf";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const prof = /** @type any */ (window).__JSHACK_RULES_PROF;
    if (prof && prof.lastTick) {
      const t = prof.lastTick;
      ctx.fillText(`rules dt: ${t.totalMs.toFixed(2)}ms`, 8, 40);
      const all = [];
      for (const ph of Object.keys(t.phases)) {
        const p = t.phases[ph];
        for (let i = 0; i < p.systems.length; i++) {
          const srec = p.systems[i];
          all.push({ ph, name: srec.name, ms: srec.ms });
        }
      }
      all.sort((a, b) => b.ms - a.ms);
      for (let i = 0; i < Math.min(3, all.length); i++) {
        const r = all[i];
        ctx.fillText(`${r.ph}: ${r.name} ${r.ms.toFixed(2)}ms`, 8, 56 + i * 14);
      }
    }
    ctx.restore();
  }
}

function ensureDungeonRenderState(dungeon) {
  if (!dungeon || !dungeon.hasData || !Array.isArray(dungeon.primitives) || dungeon.primitives.length === 0) {
    dungeonRenderState.versionKey = null;
    dungeonRenderState.primitives.length = 0;
    dungeonRenderState.dots.length = 0;
    dungeonRenderState.kernel = null;
    dungeonRenderState.mbr = null;
    dungeonRenderState.options = null;
    return dungeonRenderState;
  }

  const versionKey = `${dungeon.seed}|${dungeon.mbrVersion}|${dungeon.moveVersion}|${dungeon.occlVersion}|${dungeon.primitives.length}`;
  if (versionKey !== dungeonRenderState.versionKey) {
    dungeonRenderState.versionKey = versionKey;
    dungeonRenderState.primitives = dungeon.primitives.map((p) => ({ ...p }));
    dungeonRenderState.mbr = dungeon.mbr ? { ...dungeon.mbr } : null;
    dungeonRenderState.options = dungeon.options ? { ...dungeon.options } : null;

    const kernelPrims = dungeon.primitives.map((p) => ({ ...p }));
    const kernelOpts = { ...(dungeon.options || {}), seed: dungeon.seed };
    dungeonRenderState.kernel = new GeometryKernel(kernelOpts);
    dungeonRenderState.kernel.deserialize({
      seed: dungeon.seed,
      options: kernelOpts,
      moveVersion: dungeon.moveVersion,
      occlVersion: dungeon.occlVersion,
      mbr: dungeon.mbr,
      primitives: kernelPrims,
    });

    computeDungeonDots(dungeonRenderState);
  }

  return dungeonRenderState;
}

function computeDungeonDots(state) {
  state.dots = [];
  const kernel = state.kernel;
  const mbr = state.mbr;
  if (!kernel || !mbr) return;

  const minX = Math.floor(mbr.minX);
  const maxX = Math.ceil(mbr.maxX);
  const minY = Math.floor(mbr.minY);
  const maxY = Math.ceil(mbr.maxY);
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (kernel.distanceMove(px, py) > 0.25) {
        state.dots.push({ x: px, y: py });
      }
    }
  }
}

function drawDungeon(ctx, palette, glyphAtlas, state) {
  if (!state || state.primitives.length === 0) return;
  const wallFill = palette.wall?.glow || "#1f232c";
  const wallHighlight = palette.wall?.fg || "#8e96ab";
  const floorFill = palette.floor?.glow || "#1c2029";
  const floorAccent = palette.floor?.fg || "#576072";

  ctx.save();
  ctx.lineJoin = "round";

  for (let i = 0; i < state.primitives.length; i++) {
    const prim = state.primitives[i];
    switch (prim.type) {
      case "box":
        drawRectRing(ctx, prim.cx, prim.cy, prim.hx, prim.hy, prim.rot || 0, wallFill, wallHighlight);
        break;
      case "square": {
        const cx = (prim.ax + prim.bx) * 0.5;
        const cy = (prim.ay + prim.by) * 0.5;
        const len = Math.hypot(prim.bx - prim.ax, prim.by - prim.ay);
        drawRectRing(ctx, cx, cy, len * 0.5, prim.halfW || prim.halfWidth || 0, prim.rot || Math.atan2(prim.by - prim.ay, prim.bx - prim.ax), wallFill, wallHighlight);
        break;
      }
      case "circle":
        drawCircleRing(ctx, prim.cx, prim.cy, prim.r, wallFill, wallHighlight);
        break;
      case "capsule":
      case "rectslot": {
        const cx = (prim.ax + prim.bx) * 0.5;
        const cy = (prim.ay + prim.by) * 0.5;
        const len = Math.hypot(prim.bx - prim.ax, prim.by - prim.ay);
        const halfLen = len * 0.5;
        const rot = Math.atan2(prim.by - prim.ay, prim.bx - prim.ax);
        drawCapsuleRing(ctx, cx, cy, halfLen, prim.r, rot, wallFill, wallHighlight);
        break;
      }
      default:
        break;
    }
  }

  for (let i = 0; i < state.primitives.length; i++) {
    const prim = state.primitives[i];
    switch (prim.type) {
      case "box":
        drawRectFill(ctx, prim.cx, prim.cy, prim.hx, prim.hy, prim.rot || 0, floorFill, floorAccent);
        break;
      case "square": {
        const cx = (prim.ax + prim.bx) * 0.5;
        const cy = (prim.ay + prim.by) * 0.5;
        const len = Math.hypot(prim.bx - prim.ax, prim.by - prim.ay);
        drawRectFill(ctx, cx, cy, len * 0.5, prim.halfW || prim.halfWidth || 0, prim.rot || Math.atan2(prim.by - prim.ay, prim.bx - prim.ax), floorFill, floorAccent);
        break;
      }
      case "circle":
        drawCircleFill(ctx, prim.cx, prim.cy, prim.r, floorFill, floorAccent);
        break;
      case "capsule":
      case "rectslot": {
        const cx = (prim.ax + prim.bx) * 0.5;
        const cy = (prim.ay + prim.by) * 0.5;
        const len = Math.hypot(prim.bx - prim.ax, prim.by - prim.ay);
        const halfLen = len * 0.5;
        const rot = Math.atan2(prim.by - prim.ay, prim.bx - prim.ax);
        drawCapsuleFill(ctx, cx, cy, halfLen, prim.r, rot, floorFill, floorAccent);
        break;
      }
      default:
        break;
    }
  }

  if (glyphAtlas && state.dots.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < state.dots.length; i++) {
      const dot = state.dots[i];
      drawKind(glyphAtlas, ctx, "floor", dot.x, dot.y);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawRectRing(ctx, cx, cy, hx, hy, rot, wallFill, wallHighlight) {
  if (!(hx > 0 && hy > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = wallFill;
  ctx.beginPath();
  ctx.rect(-hx - WALL_THICKNESS, -hy - WALL_THICKNESS, (hx + WALL_THICKNESS) * 2, (hy + WALL_THICKNESS) * 2);
  ctx.rect(-hx, -hy, hx * 2, hy * 2);
  ctx.fill("evenodd");
  if (wallHighlight) {
    ctx.strokeStyle = wallHighlight;
    ctx.lineWidth = 0.12;
    ctx.strokeRect(-hx, -hy, hx * 2, hy * 2);
  }
  ctx.restore();
}

function drawRectFill(ctx, cx, cy, hx, hy, rot, floorFill, floorAccent) {
  if (!(hx > 0 && hy > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = floorFill;
  ctx.fillRect(-hx, -hy, hx * 2, hy * 2);
  if (floorAccent) {
    ctx.strokeStyle = floorAccent;
    ctx.lineWidth = 0.08;
    ctx.strokeRect(-hx + 0.05, -hy + 0.05, hx * 2 - 0.1, hy * 2 - 0.1);
  }
  ctx.restore();
}

function drawCircleRing(ctx, cx, cy, radius, wallFill, wallHighlight) {
  if (!(radius > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = wallFill;
  ctx.beginPath();
  ctx.arc(0, 0, radius + WALL_THICKNESS, 0, TAU);
  ctx.arc(0, 0, radius, 0, TAU, true);
  ctx.fill("evenodd");
  if (wallHighlight) {
    ctx.strokeStyle = wallHighlight;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCircleFill(ctx, cx, cy, radius, floorFill, floorAccent) {
  if (!(radius > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = floorFill;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  if (floorAccent) {
    ctx.strokeStyle = floorAccent;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, radius - 0.05), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function capsulePath(ctx, halfLen, radius) {
  ctx.moveTo(-halfLen, -radius);
  ctx.lineTo(halfLen, -radius);
  ctx.arc(halfLen, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-halfLen, radius);
  ctx.arc(-halfLen, 0, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

function drawCapsuleRing(ctx, cx, cy, halfLen, radius, rot, wallFill, wallHighlight) {
  if (!(radius > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = wallFill;
  ctx.beginPath();
  capsulePath(ctx, halfLen + WALL_THICKNESS, radius + WALL_THICKNESS);
  ctx.moveTo(-halfLen, -radius);
  capsulePath(ctx, halfLen, radius);
  ctx.fill("evenodd");
  if (wallHighlight) {
    ctx.strokeStyle = wallHighlight;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    capsulePath(ctx, halfLen, radius);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCapsuleFill(ctx, cx, cy, halfLen, radius, rot, floorFill, floorAccent) {
  if (!(radius > 0)) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.fillStyle = floorFill;
  ctx.beginPath();
  capsulePath(ctx, halfLen, radius);
  ctx.fill();
  if (floorAccent) {
    ctx.strokeStyle = floorAccent;
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    capsulePath(ctx, halfLen, Math.max(0, radius - 0.05));
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoundingCircles(ctx, entities, palette) {
  if (!Array.isArray(entities) || entities.length === 0) return;
  const playerGlow = palette?.player?.glow || "#6cf";
  const otherTone = palette?.floor?.fg || "#556";

  ctx.save();
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    const radius = Number(ent?.radius) || 0;
    if (radius <= 0) continue;
    const reach = Number(ent?.reach) || 0;
    const isPlayer = ent.kind === "player";
    const baseFill = hexToRgba(isPlayer ? playerGlow : otherTone, isPlayer ? 0.22 : 0.12);
    const baseStroke = isPlayer ? hexToRgba(playerGlow, 0.95) : "rgba(210,220,235,0.55)";

    ctx.fillStyle = baseFill;
    ctx.strokeStyle = baseStroke;
    ctx.lineWidth = isPlayer ? 0.14 : 0.1;
    ctx.beginPath();
    ctx.arc(ent.pos.x, ent.pos.y, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();

    if (reach > 0) {
      ctx.setLineDash([0.22, 0.28]);
      ctx.strokeStyle = isPlayer ? "rgba(255,240,200,0.9)" : "rgba(255,190,180,0.6)";
      ctx.lineWidth = isPlayer ? 0.1 : 0.08;
      ctx.beginPath();
      ctx.arc(ent.pos.x, ent.pos.y, radius + reach, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function drawFovCone(ctx, state, worldView, palette, polygon) {
  const kernel = state?.kernel;
  const player = worldView?.player;
  const fov = polygon || samplePlayerFovPolygon(kernel, player, FOV_RAY_COUNT);
  if (!fov) return;

  const { origin, points } = fov;
  if (!origin || !points || points.length < 2) return;
  const glow = palette.player?.glow || "#6cf";
  const fillStyle = hexToRgba(glow, 0.2);
  const strokeStyle = hexToRgba(glow, 0.85);

  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 0.12;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  for (let i = 0; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function samplePlayerFovPolygon(kernel, player, rayCount = 0) {
  if (!kernel || !player) return null;
  const facing = player.facing || { x: 1, y: 0 };
  const origin = player.pos || { x: 0, y: 0 };
  const rawAngle = player.fov?.angle ?? (Math.PI * 0.75);
  const angle = Math.max(0.1, Math.min(Math.PI * 2, rawAngle));
  const desiredDist = player.fov?.distance ?? 12;
  const distance = Math.min(FOV_MAX_DISTANCE, Math.max(FOV_MIN_DISTANCE, desiredDist));
  const rays = Math.max(1, rayCount | 0);
  const baseAngle = Math.atan2(facing.y, facing.x);
  const halfAngle = angle * 0.5;

  const points = [];
  let maxDistance = 0;
  for (let i = 0; i <= rays; i++) {
    const t = rays === 0 ? 0 : i / rays;
    const ang = baseAngle - halfAngle + angle * t;
    const dirx = Math.cos(ang);
    const diry = Math.sin(ang);
    const ray = kernel.raycastOccl(origin, { x: dirx, y: diry }, distance);
    let travel = Math.min(distance, Number.isFinite(ray?.t) ? ray.t : distance);
    if (ray?.hit) travel = Math.max(0, travel - 0.1);
    if (travel > maxDistance) maxDistance = travel;
    points.push({ x: origin.x + dirx * travel, y: origin.y + diry * travel });
  }

  if (points.length < 2) return null;
  return { origin, points, maxDistance: Math.max(maxDistance, distance * 0.85) };
}

function syncLightEmitters(lights, fx, time) {
  const origins = [];
  if (!Array.isArray(lights) || !fx) return origins;
  const seen = new Set();
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    if (light?.emitter === "torch") {
      const key = `torch:${light.id ?? i}`;
      seen.add(key);
      const emitter = fx.ensureEmitter(key, {
        continuous: true,
        rate: 16,
        spread: Math.PI / 12,
        speed: 0.65,
        speedJitter: 0.45,
        life: 0.9,
        lifeJitter: 0.45,
        size: 0.55,
        sizeEnd: 0.18,
        angle: -Math.PI / 2,
        ax: 0,
        ay: -0.6,
        color: light.color || "#ffb347",
        alpha0: 0.9,
        alpha1: 0,
        offsetX: 0,
        offsetY: -0.2,
      });
      const rgb = parseRgb(light.color || "#ffb347");
      emitter.r = rgb.r; emitter.g = rgb.g; emitter.b = rgb.b;
      emitter.offsetX = 0;
      emitter.offsetY = -0.35;
      const seed = hashToUnit(light.id ?? `${light.x},${light.y}`);
      const wobble = Math.sin((time || 0) * 5.2 + seed * 9.1) * 0.2 + Math.sin((time || 0) * 3.3 + seed * 13.7) * 0.15;
      const flicker = 1 + wobble;
      emitter.rate = 14 + flicker * 6;
      emitter.size = 0.5 + flicker * 0.25;
      emitter.life = 0.8 + flicker * 0.25;
      emitter.spread = Math.PI / 16 + Math.abs(Math.sin((time || 0) * 2.1 + seed * 7.3)) * Math.PI / 48;
      origins.push({ key, x: light.x, y: light.y });
    } else if (light?.emitter === "arrowFlame") {
      // Trailing particles for flaming arrow head (emitted at current head position)
      const key = `arrowFlame:${light.id ?? i}`;
      seen.add(key);
      const emitter = fx.ensureEmitter(key, {
        continuous: true,
        rate: 22,
        spread: Math.PI / 16,
        speed: 1.4,
        speedJitter: 0.35,
        life: 0.35,
        lifeJitter: 0.25,
        size: 0.28,
        sizeEnd: 0.08,
        angle: Math.PI, // default back-facing; ovx/ovy will add arrow motion
        ax: 0,
        ay: -0.4,
        color: light.color || "#ffb36b",
        alpha0: 0.9,
        alpha1: 0.0,
        offsetX: 0,
        offsetY: 0,
      });
      const rgb = parseRgb(light.color || "#ffb36b");
      emitter.r = rgb.r; emitter.g = rgb.g; emitter.b = rgb.b;
      // For moving emitters, allow slight variability without heavy flicker
      origins.push({ key, x: light.x, y: light.y });
    } else if (light?.emitter === "burning") {
      // Subtle embers and heat shimmer for burning status
      const key = `burning:${light.id ?? i}`;
      seen.add(key);
      const emitter = fx.ensureEmitter(key, {
        continuous: true,
        rate: 8,
        spread: Math.PI / 10,
        speed: 0.5,
        speedJitter: 0.3,
        life: 0.6,
        lifeJitter: 0.3,
        size: 0.14,
        sizeEnd: 0.04,
        angle: -Math.PI / 2,
        ax: 0,
        ay: -0.25,
        color: light.color || "#ff7a2a",
        alpha0: 0.55,
        alpha1: 0.0,
        offsetX: 0,
        offsetY: -0.1,
      });
      const rgb = parseRgb(light.color || "#ff7a2a");
      emitter.r = rgb.r; emitter.g = rgb.g; emitter.b = rgb.b;
      origins.push({ key, x: light.x, y: light.y });
    } else if (light?.emitter === "meteorFlame") {
      // Heavier fiery trail for meteor head
      const key = `meteorFlame:${light.id ?? i}`;
      seen.add(key);
      const emitter = fx.ensureEmitter(key, {
        continuous: true,
        rate: 48,
        spread: Math.PI / 10,
        speed: 1.6,
        speedJitter: 0.6,
        life: 0.55,
        lifeJitter: 0.35,
        size: 0.55,
        sizeEnd: 0.16,
        angle: Math.PI,
        ax: 0,
        ay: -0.9,
        color: light.color || "#ff9a3e",
        alpha0: 0.95,
        alpha1: 0.0,
        offsetX: 0,
        offsetY: 0,
      });
      const rgb = parseRgb(light.color || "#ff9a3e");
      emitter.r = rgb.r; emitter.g = rgb.g; emitter.b = rgb.b;
      origins.push({ key, x: light.x, y: light.y });
    }
  }
  for (const key of _lightEmitterKeys) {
    if (!seen.has(key)) fx.removeEmitter(key);
  }
  _lightEmitterKeys.clear();
  for (const key of seen) _lightEmitterKeys.add(key);
  return origins;
}

function parseRgb(hex) {
  if (typeof hex !== "string") return { r: 255, g: 180, b: 120 };
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16) || 255,
      g: parseInt(h[1] + h[1], 16) || 180,
      b: parseInt(h[2] + h[2], 16) || 120,
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16) || 255,
      g: parseInt(h.slice(2, 4), 16) || 180,
      b: parseInt(h.slice(4, 6), 16) || 120,
    };
  }
  return { r: 255, g: 180, b: 120 };
}

function hashToUnit(key) {
  const s = String(key);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(255,255,255,${alpha})`;
}

// ---- Frame loop (FXClock) --------------------------------------------------
let last = performance.now();
let _fpsEMA = 0;
function frame(now) {
  const dtSec = Math.max(0, (now - last) / 1000);
  last = now;

  const instFps = dtSec > 0 ? (1 / dtSec) : 0;
  _fpsEMA = _fpsEMA ? (_fpsEMA * 0.9 + instFps * 0.1) : instFps;
  _fxTime += dtSec;

  stepSim(0);

  if (PERF.particleCapacity > 0) fx.step(dtSec, _particleOrigins);
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  worldEvents.updateBoltFx(dtSec);
  if (worldEvents.updateRippleFx) worldEvents.updateRippleFx(dtSec);
  if (worldEvents.updateArrowFx) worldEvents.updateArrowFx(dtSec);
  ftext.step(dtSec);

  hudFeeds.updateVitalsHUD();
  hudFeeds.updateCombatHUD();

  const view = getCachedView();
  if (view.player) {
    followEntity(cam, view.player.pos, dtSec, 6.0);
  }
  render(view);

  requestAnimationFrame(frame);
}

// ---- Minimal demo “scene” controls (display-only) --------------------------
addEventListener("keydown", (e) => {
  const { key, code } = e;
  const zoomIn = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
  const zoomOut = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";

  if (zoomIn) { zoomTo(cam, Math.min(TILE_PX * 4.0, cam.targetScale * 1.2)); e.preventDefault(); return; }
  if (zoomOut) { zoomTo(cam, Math.max(TILE_PX * 0.5, cam.targetScale / 1.2)); e.preventDefault(); return; }
  if (key === "0") { jumpTo(cam, { x: 0, y: 0 }); zoomTo(cam, TILE_PX); e.preventDefault(); return; }
  if ((key || "").toLowerCase() === "x") { startShake(cam, 6, 0.35); e.preventDefault(); return; }
});

let _cachedView = null; let _cachedStep = -1;
function getCachedView() {
  const step = world.step | 0;
  if (!_cachedView || step !== _cachedStep) {
    _cachedView = buildWorldView(world);
    _cachedStep = step;
  }
  return _cachedView;
}

requestAnimationFrame(frame);
