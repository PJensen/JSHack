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

// display overlays & UI bridges
import { setupUIEventListeners } from "./main/ui/setupUIEventListeners.js";
import { createHudFeeds } from "./main/ui/hudFeeds.js";

// world scene + rules adapters
import { populateDemoScene } from "./main/scene/demoScene.js";
import { createActiveSpellController } from "./main/spells/activeSpellController.js";
import { setupWorldEventHandlers } from "./main/world/worldEvents.js";

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
  return {
    quality: q,
    dprCap: isHigh ? 3 : (isLow ? 1 : dprCap),
    glowLayers: isLow ? 0 : 2,
    particleCapacity: isLow ? 512 : 4096,
    cameraLerp: (params.get("cameraLerp") !== null ? Number(params.get("cameraLerp")) : 0)
  };
})();

// Use tile-sized world units: 1 world unit == 1 tile on screen
const TILE_PX = 28;

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

  const isTileKind = (k) => k === "floor" || k === "wall" || (typeof k === "string" && k.startsWith("door_"));

  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1;
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (!isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === "string") ? e.kind : "default";
    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);
  }

  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === "string") ? e.kind : "default";
    drawKind(glyphAtlas, bctx, k, e.pos.x, e.pos.y);

    if (PERF.quality !== "low" && Array.isArray(e.tags) && e.tags.includes("invulnerable")) {
      bctx.save();
      bctx.globalCompositeOperation = "lighter";
      bctx.strokeStyle = "rgba(160,255,255,0.9)";
      bctx.lineWidth = 0.08;
      const r = 0.45 + 0.06 * Math.sin(_fxTime * 6.0);
      bctx.beginPath();
      bctx.arc(e.pos.x, e.pos.y, r, 0, Math.PI * 2);
      bctx.stroke();
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

  if (PERF.particleCapacity > 0) fx.step(dtSec);
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);
  worldEvents.updateBoltFx(dtSec);
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
