// app/main.js — compliant with Separation Manifest
// app/ wires rules + bridge + display. No FX in rules; no display -> rules imports.

// ---- Imports ---------------------------------------------------------------
// rules/ (app owns lifecycle only; no display code here)
import { World } from "./lib/ecs-js/index.js";            // ECS World
import { configureWorld } from "../app/rules/scheduler.js";
import { playerEntity } from "./rules/utils/queries.js";

// display/ camera + director utilities (pure display resources)
import { createCamera, updateCamera, applyCamera } from "./display/camera/controller.js";
import { updateShake, startShake } from "./display/camera/shake.js";
import { zoomTo, jumpTo } from "./display/camera/utils.js";

// display/ particles (pure display-side FX; no ECS, no rules)
import { ParticleFX } from "./display/passes/vfx/particles/particlePool.js";
// input wiring (display-only router)
import { setupInput } from "./display/input/InputRouter.js";
import { enableInputLockdown } from "./display/input/lockdown.js";
import { makeRulesDispatcher } from "../app/input/rulesDispatch.js";
// simple UI overlays
import { initOverlays } from "./display/ui/overlay.js";
import { initHUD } from "./display/ui/hud.js";
import { Inventory } from "./rules/components/Inventory.js";
import { ItemInfo } from "./rules/components/ItemInfo.js";
import { NamedIdentity } from "./rules/components/NamedIdentity.js";
import { Position } from "./rules/components/Position.js";
import { buildWorldView } from "./bridge/schema/worldView.js";
import { createFrom } from "./lib/ecs-js/archetype.js";
import { createPlayer } from "./rules/archetypes/Player.js";
import { HealthPotion, GoldStack } from "./rules/archetypes/Items.js";
import { FloorTile, WallTile } from "./rules/archetypes/Tiles.js";
import { Door } from "./rules/archetypes/Door.js";
import { Monster } from "./rules/archetypes/Creatures.js";
import { followEntity } from "./display/camera/follow.js";
import { ActiveEffects } from "./rules/components/ActiveEffects.js";
import { buildEquipmentItem } from "./rules/data/equipmentLoader.js";
import { buildPalette } from "./display/palette/index.js";
import { createRng } from "./lib/ecs-js/rng.js";
import { itemsAt } from "./rules/utils/queries.js";
import { createGlyphAtlas, drawKind } from "./display/passes/glyphs/atlas.js";

// ---- Canvas & sizing -------------------------------------------------------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

// Lock down browser-driven inputs/scroll/zoom so the app fully controls them
enableInputLockdown({ canvas });

// Quality/perf controls
const PERF = (() => {
  const params = new URLSearchParams(window.location.search);
  const q = (params.get('quality') || localStorage.getItem('jshack.quality') || 'auto').toLowerCase();
  // Cap DPR on mobile/high-DPR screens to avoid excessive fill-rate costs
  const autoCap = (window.devicePixelRatio || 1) > 2 ? 2 : 1.5;
  const dprCap = Number(params.get('dprCap')) || Number(localStorage.getItem('jshack.dprCap')) || autoCap;
  const isLow = q === 'low';
  const isHigh = q === 'high';
  return {
    quality: q,
    dprCap: isHigh ? 3 : (isLow ? 1 : dprCap),
    glowLayers: isLow ? 0 : 2,
    particleCapacity: isLow ? 1024 : 4096,
  };
})();

function resize() {
  // Limit device pixel ratio to reduce pixel workload on mobile
  const rawDpr = Math.max(1, window.devicePixelRatio || 1);
  const dpr = Math.max(1, Math.min(PERF.dprCap, Math.floor(rawDpr)));
  const cssW = Math.max(1, window.innerWidth | 0);
  const cssH = Math.max(1, window.innerHeight | 0);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

// ---- App wires rules/ (no display logic here) ------------------------------
const world = new World({ seed: 0xa77a77 });
configureWorld(world);
// Only app/scenes step the sim (deterministic). We’ll keep it paused here.
function stepSim(dtTurns = 0) { if (dtTurns > 0) { world.tick(dtTurns); } }

// ---- Demo scene: ensure a player exists and a couple items around ----------
// Build a small dungeon room (10x10) centered at (0,0)
const W = 10, H = 10;
const ox = -((W - 1) >> 1), oy = -((H - 1) >> 1);
// Door at the bottom wall center (compute before tile loop to skip placing a wall there)
const doorPos = { x: 0, y: oy + (H - 1) };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const gx = ox + x, gy = oy + y;
    const isBorder = (x === 0 || y === 0 || x === W - 1 || y === H - 1);
    if (isBorder) {
      if (gx === doorPos.x && gy === doorPos.y) continue;
      createFrom(world, WallTile, { x: gx, y: gy });
    } else {
      createFrom(world, FloorTile, { x: gx, y: gy });
    }
  }
}
// Add a single door at the bottom wall center
createFrom(world, Door, { x: doorPos.x, y: doorPos.y });

// Ensure a player exists at room center
if (!playerEntity(world)) {
  createPlayer(world, { x: 0, y: 0, name: "Hero" });
}
// Apply 10-turn invulnerability to the player at start
{
  const pe = playerEntity(world);
  if (pe) {
    const ae = world.get(pe.id, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      ae.effects.push({ key: 'invulnerable', turnsLeft: 10, potency: 1 });
    } else {
      world.add(pe.id, ActiveEffects, { effects: [{ key: 'invulnerable', turnsLeft: 10, potency: 1 }] });
    }
  }
}

// Drop a couple of health potions on the floor
const p1 = createFrom(world, HealthPotion, {});
world.add(p1, Position, { x: 2, y: 0 });
const p2 = createFrom(world, HealthPotion, {});
world.add(p2, Position, { x: -2, y: 0 });

// Spawn a stack of gold (currency) using deterministic RNG
{
  const rng = createRng(world.seed >>> 0 ^ 0x9e3779b9);
  const coins = rng.int(12, 47);
  const gold = createFrom(world, GoldStack, {});
  world.add(gold, Position, { x: 1, y: 1 });
  world.mutate(gold, ItemInfo, (r) => { r.count = coins; });
}

// Spawn a few monsters that will chase the player
createFrom(world, Monster, { x: ox + 2, y: oy + 2, name: "Goblin", identity: "monster" });
createFrom(world, Monster, { x: ox + W - 3, y: oy + 2, name: "Goblin", identity: "monster" });
createFrom(world, Monster, { x: ox + 2, y: oy + H - 3, name: "Goblin", identity: "monster" });

// Drop a sample equipment stack (sword + shield) to validate picker & palette wiring
const eqSword = buildEquipmentItem(world, 'sword_plain', {});
const eqShield = buildEquipmentItem(world, 'shield_wood', {});
world.add(eqSword, Position, { x: -1, y: 1 });
world.add(eqShield, Position, { x: -1, y: 1 });

// ---- Input setup (display/input → rules/display) ---------------------------
const inputDisposers = [];
{
  const rulesHandler = makeRulesDispatcher(
    /** @type any */(world),
    () => (playerEntity(world)?.id || 0)
  );

  const displayHandler = (action) => {
    switch (action.type) {
      case "display.openInventory":
        window.dispatchEvent(new CustomEvent("ui:openInventory"));
        break;
      case "display.openMessageLog":
        window.dispatchEvent(new CustomEvent("ui:openMessageLog"));
        break;
      case "display.zoom": {
        const f = Math.max(0.5, Math.min(1.5, Number(action.payload?.factor) || 1));
        const minS = TILE_PX * 0.5;
        const maxS = TILE_PX * 4.0;
        const current = (cam.targetScale || cam.scale || TILE_PX);
        const next = Math.max(minS, Math.min(maxS, current * f));
        zoomTo(cam, next);
        break;
      }
      case "display.openPickupChooser": {
        // Gather items at player's position. Open chooser only when there are >1 items.
        const p = playerEntity(world);
        if (!p) break;
        const ids = itemsAt(world, p.pos.x, p.pos.y);
        if (ids.length === 0) {
          break;
        }
        if (ids.length === 1) {
          const only = ids[0];
          rulesHandler({ type: 'rules.pickupItem', payload: { itemId: only } });
        } else {
          const items = ids.map((id) => {
            const info = world.get(id, ItemInfo);
            const name = world.get(id, NamedIdentity);
            return { id, type: info?.type || 'item', name: name?.name || info?.type || 'item', count: info?.count || 1 };
          });
          window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
        }
        break;
      }
      default:
        break;
    }
  };

  setupInput({ canvas, rulesHandler, displayHandler, onDispose: inputDisposers });
}

// ---- Display UI overlays + data feeds -------------------------------------
initOverlays();
initHUD();

// Provide inventory data to overlay when requested
addEventListener('ui:requestInventoryData', () => {
  const p = playerEntity(world);
  const items = [];
  if (p) {
    const inv = world.get(p.id, Inventory);
    if (inv && Array.isArray(inv.items)) {
      for (const id of inv.items) {
        const info = world.get(id, ItemInfo);
        if (info) items.push({ id, type: info.type, description: info.description, count: info.count });
      }
    }
  }
  window.dispatchEvent(new CustomEvent('ui:inventoryData', { detail: { items } }));
});

// Provide message log entries (placeholder until rules log is wired)
addEventListener('ui:requestMessageLogData', () => {
  const entries = messageLog.slice();
  window.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
});

// Active spell button click → cast
addEventListener('ui:castActiveSpell', () => {
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler({ type: 'rules.castActiveSpell', payload: {} });
});

// When user selects items from the pickup chooser overlay
addEventListener('ui:requestPickup', (e) => {
  const arr = e.detail?.itemIds;
  if (!Array.isArray(arr) || !arr.length) return;
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  for (const id of arr) {
    if (Number.isInteger(id) && id > 0) {
      rulesHandler({ type: 'rules.pickupItem', payload: { itemId: id } });
    }
  }
});

// Basic app-side message log collector (bridge-free for now)
const messageLog = [];
function log(msg) {
  messageLog.push(msg);
  if (messageLog.length > 50) messageLog.shift();
}
world.on('drank', ({ actor, itemId, target }) => log(`Entity ${actor} drank item ${itemId} on ${target||actor}`));
world.on('castSpell', ({ actor, spellId, targetId }) => log(`Entity ${actor} cast spell ${spellId||'active'} on ${targetId||actor}`));
world.on('damage', ({ id, amount }) => log(`Entity ${id} took ${amount} damage`));
world.on('healed', ({ id, amount }) => log(`Entity ${id} healed ${amount}`));
world.on('died', ({ id }) => log(`Entity ${id} died`));
world.on('interaction', ({ action, result }) => {
  if (action === 'toggleDoor') {
    log(`The door ${result === 'opened' ? 'opens' : (result === 'closed' ? 'closes' : 'is locked')}.`);
  }
});

// When user clicks an inventory item to drink
addEventListener('ui:requestDrink', (e) => {
  const itemId = e.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  const action = { type: 'rules.drinkPotion', payload: { itemId } };
  const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
  rulesHandler(action);
});

// ---- Display camera (resource) ---------------------------------------------
const cam = createCamera(); // { x,y, scale, target*, shake* }
// Use tile-sized world units: 1 world unit == 1 tile on screen
const TILE_PX = 28;
cam.scale = TILE_PX;
cam.targetScale = TILE_PX;
function worldToScreen({ x, y, size = 1 }) {
  const sx = (x - cam.x) * cam.scale + canvas.width / (ctx.getTransform().a || 1) * 0.5;
  const sy = (y - cam.y) * cam.scale + canvas.height / (ctx.getTransform().d || 1) * 0.5;
  return { x: sx, y: sy, size: size * cam.scale };
}

// ---- Particle FX (display-only) -------------------------------------------
const fx = new ParticleFX({ capacity: PERF.particleCapacity, seedBase: (world.seed >>> 0) });
fx.ctx = ctx;
// Avoid expensive per-particle transforms: draw in world units under camera transform
fx.worldToScreen = (p) => ({ x: p.x, y: p.y, size: p.size });

// Optionally attach an emitter to a stable key (e.g., player id) later
// fx.ensureEmitter(playerId, preset);

// ---- Visual mappings (display contract) ------------------------------------
const palette = buildPalette();
const glyphAtlas = createGlyphAtlas(palette, { glowLayers: PERF.glowLayers, sizePx: 64, fontPx: 56 });

// ---- Render (display-only; consumes WorldView DTO) -------------------------
let _bgGradH = 0; let _bgGrad = null;
let _fxTime = 0; // display-side time accumulator for simple glyph FX
function render(worldView) {
  const tf = ctx.getTransform();
  const W = canvas.width / (tf.a || 1);
  const H = canvas.height / (tf.d || 1);

  // Background (cache gradient by height to avoid per-frame allocations)
  ctx.save();
  if (!_bgGrad || _bgGradH !== H) {
    _bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    _bgGrad.addColorStop(0, "#0b0e16");
    _bgGrad.addColorStop(1, "#0a0c14");
    _bgGradH = H;
  }
  ctx.fillStyle = _bgGrad; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Camera transform for world-space draws
  ctx.save();
  applyCamera(ctx, cam, canvas);

  // Draw entities (glyph-based, mapped from kind/tags)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw tiles first, then actors/items for layering without per-frame array allocs
  const isTileKind = (k) => k === 'floor' || k === 'wall' || (typeof k === 'string' && k.startsWith('door_'));

  // Set glyph height in world units once per frame (pre-transform px). With camera.scale=TILE_PX,
  // 1px here becomes TILE_PX on screen, matching tile size.
  // We now use pre-rendered glyph bitmaps; font is not used for entities.
  // Compute simple view bounds in world units for culling
  const viewHalfW = W * 0.5 / (cam.scale || 1);
  const viewHalfH = H * 0.5 / (cam.scale || 1);
  const vx0 = cam.x - viewHalfW - 1; // add small margin
  const vy0 = cam.y - viewHalfH - 1;
  const vx1 = cam.x + viewHalfW + 1;
  const vy1 = cam.y + viewHalfH + 1;

  // Pass 1: tiles
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (!isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    drawKind(glyphAtlas, ctx, k, e.pos.x, e.pos.y);
  }

  // Pass 2: non-tiles
  for (let i = 0; i < worldView.entities.length; i++) {
    const e = worldView.entities[i];
    if (isTileKind(e.kind)) continue;
    if (e.pos.x < vx0 || e.pos.x > vx1 || e.pos.y < vy0 || e.pos.y > vy1) continue;
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    drawKind(glyphAtlas, ctx, k, e.pos.x, e.pos.y);

    // Glyph-FX: show an invulnerability shimmer ring when tagged
    if (PERF.quality !== 'low' && Array.isArray(e.tags) && e.tags.includes('invulnerable')) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,255,255,0.9)';
      ctx.lineWidth = 0.08; // world units
      const r = 0.45 + 0.06 * Math.sin(_fxTime * 6.0);
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Particles (already in world space)
  fx.render({ mode: "lighter", alphaScale: 0.9, shape: (PERF.quality === 'low' ? 'rect' : 'circle') });

  ctx.restore();

  // HUD
  if (PERF.quality !== 'low') {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#9cf";
    ctx.font = "12px monospace";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    const s = fx.stats();
    ctx.fillText(`particles: ${s.active}/${s.capacity}  emitters:${s.emitters}`, 8, 8);
    const fpsInt = Math.max(0, Math.round(_fpsEMA || 0));
    ctx.fillText(`fx fps: ${fpsInt}`, 8, 24);
    ctx.restore();
  }
}

// ---- Frame loop (FXClock) --------------------------------------------------
let last = performance.now();
let _fpsEMA = 0; // FX FPS (EMA)
function frame(now) {
  const dtSec = Math.max(0, (now - last) / 1000);
  last = now;

  // Update FX FPS (exponential moving average for stability)
  const instFps = dtSec > 0 ? (1 / dtSec) : 0;
  _fpsEMA = _fpsEMA ? (_fpsEMA * 0.9 + instFps * 0.1) : instFps;
  _fxTime += dtSec;

  // Sim step is scene-controlled; keep paused (no tick) unless a scene/input advances it.
  stepSim(0);

  // Advance display-only systems
  if (PERF.particleCapacity > 0) fx.step(dtSec);
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);

  // Render
  const view = getCachedView();
  // keep camera centered on player if present
  if (view.player) {
    // Directly set follow target at player world coords
    followEntity(cam, view.player.pos, dtSec, 6.0);
  }
  render(view);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Minimal demo “scene” controls (display-only) --------------------------
addEventListener("keydown", (e) => {
  const { key, code } = e;
  const zoomIn  = key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd";
  const zoomOut = key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract";

  if (zoomIn)  { zoomTo(cam, Math.min(TILE_PX * 4.0, cam.targetScale * 1.2)); e.preventDefault(); return; }
  if (zoomOut) { zoomTo(cam, Math.max(TILE_PX * 0.5, cam.targetScale / 1.2)); e.preventDefault(); return; }
  if (key === "0") { jumpTo(cam, { x: 0, y: 0 }); zoomTo(cam, TILE_PX); e.preventDefault(); return; }
  if ((key || "").toLowerCase() === "x") { startShake(cam, 6, 0.35); e.preventDefault(); return; }
});

// Cache WorldView per rules step; if the sim hasn't advanced, reuse the view
let _cachedView = null; let _cachedStep = -1;
function getCachedView() {
  const step = world.step | 0;
  if (!_cachedView || step !== _cachedStep) {
    _cachedView = buildWorldView(world);
    _cachedStep = step;
  }
  return _cachedView;
}

// Cache FOV between frames; recompute when world turn changes or player moves.
// (FOV/Lightmask were removed per request; focusing strictly on tuning existing features.)
