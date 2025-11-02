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
import { Inventory, ItemInfo } from "./rules/components/index.js";
import { buildWorldView } from "./bridge/schema/worldView.js";
import { createFrom } from "./lib/ecs-js/archetype.js";
import { createPlayer } from "./rules/archetypes/Player.js";
import { HealthPotion } from "./rules/archetypes/Items.js";
import { FloorTile, WallTile } from "./rules/archetypes/Tiles.js";
import { Door } from "./rules/archetypes/Door.js";
import { Monster } from "./rules/archetypes/Creatures.js";
import { Position } from "./rules/components/Position.js";
import { followEntity } from "./display/camera/follow.js";

// ---- Canvas & sizing -------------------------------------------------------
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
try { ctx.imageSmoothingEnabled = false; } catch {}

// Lock down browser-driven inputs/scroll/zoom so the app fully controls them
enableInputLockdown({ canvas });

function resize() {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
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
try { configureWorld(world); } catch {}
// Only app/scenes step the sim (deterministic). We’ll keep it paused here.
function stepSim(dtTurns = 0) { if (dtTurns > 0) { try { world.tick(dtTurns); } catch {} } }

// ---- Demo scene: ensure a player exists and a couple items around ----------
try {
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
        // Skip wall at the intended door location
        if (gx === doorPos.x && gy === doorPos.y) continue;
        const tid = createFrom(world, WallTile, { x: gx, y: gy });
        void tid;
      } else {
        const tid = createFrom(world, FloorTile, { x: gx, y: gy });
        void tid;
      }
    }
  }
  // Add a single door at the bottom wall center
  createFrom(world, Door, { x: doorPos.x, y: doorPos.y });

  // Ensure a player exists at room center
  if (!playerEntity(world)) {
    createPlayer(world, { x: 0, y: 0, name: "Hero" });
  }

  // Drop a couple of health potions on the floor
  const p1 = createFrom(world, HealthPotion, {});
  world.add(p1, Position, { x: 2, y: 0 });
  const p2 = createFrom(world, HealthPotion, {});
  world.add(p2, Position, { x: -2, y: 0 });

  // Spawn a few monsters that will chase the player
  createFrom(world, Monster, { x: ox + 2, y: oy + 2, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: ox + W - 3, y: oy + 2, name: "Goblin", identity: "monster" });
  createFrom(world, Monster, { x: ox + 2, y: oy + H - 3, name: "Goblin", identity: "monster" });
} catch {}

// ---- Input setup (display/input → rules/display) ---------------------------
const inputDisposers = [];
try {
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
      default:
        break;
    }
  };

  setupInput({ canvas, rulesHandler, displayHandler, onDispose: inputDisposers });
} catch (err) {
  console?.warn?.("input setup skipped:", err);
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
  try {
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler({ type: 'rules.castActiveSpell', payload: {} });
  } catch {}
});

// Basic app-side message log collector (bridge-free for now)
const messageLog = [];
function log(msg) {
  messageLog.push(msg);
  if (messageLog.length > 50) messageLog.shift();
}
try {
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
} catch {}

// When user clicks an inventory item to drink
addEventListener('ui:requestDrink', (e) => {
  const itemId = e.detail?.itemId;
  if (!Number.isInteger(itemId)) return;
  // Re-emit through input pipeline by calling displayHandler? We can directly enqueue a rules action:
  try {
    const action = { type: 'rules.drinkPotion', payload: { itemId } };
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler(action);
  } catch {}
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
const fx = new ParticleFX({ capacity: 4096, seedBase: (world.seed >>> 0) });
fx.ctx = ctx;
fx.worldToScreen = worldToScreen;

// Optionally attach an emitter to a stable key (e.g., player id) later
// fx.ensureEmitter(playerId, preset);

// ---- Visual mappings (display contract) ------------------------------------
const palette = {
  // Actors
  player: { glyph: "@", fg: "#e8f7ff", glow: "#6cf" },
  monster: { glyph: "m", fg: "#ffb0a0", glow: "#f66" },
  // Tiles
  floor: { glyph: ".", fg: "#446", glow: "#224" },
  wall: { glyph: "#", fg: "#99a", glow: "#667" },
  door_closed: { glyph: "+", fg: "#cc9", glow: "#aa7" },
  door_open: { glyph: "/", fg: "#cc9", glow: "#aa7" },
  // Fallback
  default: { glyph: "•", fg: "#cfe8ff", glow: "#6cf" }
};

// ---- Render (display-only; consumes WorldView DTO) -------------------------
function render(worldView) {
  const tf = ctx.getTransform();
  const W = canvas.width / (tf.a || 1);
  const H = canvas.height / (tf.d || 1);

  // Background
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0e16"); g.addColorStop(1, "#0a0c14");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Camera transform for world-space draws
  ctx.save();
  applyCamera(ctx, cam, canvas);

  // Draw entities (glyph-based, mapped from kind/tags)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw tiles first, then actors/items for layering
  const isTileKind = (k) => k === 'floor' || k === 'wall' || (typeof k === 'string' && k.startsWith('door_'));
  const tiles = worldView.entities.filter(e => isTileKind(e.kind));
  const others = worldView.entities.filter(e => !isTileKind(e.kind));

  const drawList = [...tiles, ...others];
  for (const e of drawList) {
    const k = (typeof e.kind === 'string') ? e.kind : 'default';
    const look = palette[k] || palette.default;
  // Set glyph height in world units (pre-transform px). With camera.scale=TILE_PX,
  // 1px here becomes TILE_PX on screen, matching tile size.
  const size = 1;
  ctx.font = `900 ${size}px monospace`;

    // glow layers (lighter)
    ctx.globalCompositeOperation = "lighter";
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const alpha = 0.06 * (1 - t);
      ctx.shadowBlur = 10 + t * 24;
      ctx.shadowColor = look.glow;
      ctx.fillStyle = `rgba(102,204,255,${alpha.toFixed(3)})`;
      ctx.fillText(look.glyph, e.pos.x, e.pos.y);
    }

    // core glyph
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.fillStyle = look.fg;
    ctx.fillText(look.glyph, e.pos.x, e.pos.y);
  }

  // Particles (already in world space)
  fx.render({ mode: "lighter", alphaScale: 0.9 });

  ctx.restore();

  // HUD
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#9cf";
  ctx.font = "12px monospace";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  const s = fx.stats();
  ctx.fillText(`particles: ${s.active}/${s.capacity}  emitters:${s.emitters}`, 8, 8);
  ctx.restore();
}

// ---- Frame loop (FXClock) --------------------------------------------------
let last = performance.now();
function frame(now) {
  const dtSec = Math.max(0, (now - last) / 1000);
  last = now;

  // Sim step is scene-controlled; keep paused (no tick) unless a scene/input advances it.
  stepSim(0);

  // Advance display-only systems
  try { fx.step(dtSec); } catch {}
  updateCamera(cam, dtSec);
  updateShake(cam, dtSec);

  // Render
  const view = buildWorldView(world);
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
  if ((key || "").toLowerCase() === "s") { startShake(cam, 6, 0.35); e.preventDefault(); return; }
});
