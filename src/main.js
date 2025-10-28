// main.js — externalized from index.html inline module
import { World, defineComponent, registerSystem, composeScheduler, runSystems } from "./lib/ecs-js/index.js";
import { createEmitterSystem, particlePoolUpdateSystem, renderPooledParticlesSystem, spawnParticleBurst } from "./effects/particles/spawner.js";
import { getGlobalParticlePool } from "./effects/particles/particlePool.js";
import { Position, Glyph, Glow, Emitter, C as Components } from "./components/index.js";

// --- Canvas & sizing ---
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d", { alpha: false });
try {
  ctx.imageSmoothingEnabled = false;
} catch {}

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
resize();
addEventListener("resize", resize);

// --- ECS setup ---
const world = new World({ seed: 0xa77a77 });
world.ctx = ctx; // stash for render system

// --- Components ---
// Centralized in src/components; also available via namespace object `Components` if desired.
// Particles now use a pooled system (non-ECS). The Emitter component drives it.

// --- Entity: big glowing @ in the center ---
const at = world.create();s
world.add(at, Position, { x: 0, y: 0 }); // center in NDC; resolved in render
world.add(at, Glyph, { char: '@' });
world.add(at, Glow, { });

// Attach an emitter to the glyph entity to match previous visuals (omni light sparkle)
world.add(at, Emitter, {
  enabled: true,
  continuous: true,
  rate: 22,               // ~particles/sec (boosted for visibility)
  burstCount: 0,
  angle: 0,
  spread: Math.PI * 2,    // omni
  speed: 30,              // px/sec for continuous emission
  speedJitter: 0.6,
  vx: 0,
  vy: 0,
  ax: 0,
  ay: 0,                  // no gravity in UI sparkle
  life: 1.6,
  lifeJitter: 0.4,
  size: 2.6,
  sizeEnd: 0.2,
  color: "#8cf",
  offsetX: 0,
  offsetY: 0,
});

// --- Systems ---
// Emitter-driven pooled particles (inject the exact component refs used by this world)
const emitterSystem = createEmitterSystem({ Position, Emitter });

function renderSystem(w) {
  const ctx = w.ctx;
  const W = ctx.canvas.width / (ctx.getTransform().a || 1);
  const H = ctx.canvas.height / (ctx.getTransform().d || 1);
  // background (draw using current DPR transform so we cover full backing store)
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0e16");
  g.addColorStop(1, "#0a0c14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // center coordinates (CSS px)
  const cx = W * 0.5,
    cy = H * 0.5;

  // fetch components (single glyph)
  const row = [...w.query(Position, Glyph, Glow)][0];
  if (!row) return;
  const [id, pos, glyph, glow] = row;

  // dynamic font size based on viewport
  const size = Math.max(
    16,
    Math.floor(Math.min(W, H) * (glyph.baseScale || 0.7))
  );
  const font = `${glyph.weight || "900"} ${size}px ${
    glyph.family || "monospace"
  }`;

  // compute pulse using real time (decoupled from simulation time)
  const tSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
  const pulse = 1 + (glow.pulse || 0) * Math.sin((glow.speedHz || 0.6) * tSec * Math.PI * 2);
  const intensity = (glow.intensity || 1) * Math.max(0, pulse);

  // draw glow layers (additive)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.globalCompositeOperation = "lighter";
  const glowColor = glow.color || "#6cf";
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const blur = (glow.blurBase + t * (glow.blurMax - glow.blurBase)) * intensity;
    const alpha = 0.08 * (1 - t) * intensity;
    ctx.shadowBlur = blur;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = `rgba(102, 204, 255, ${alpha.toFixed(3)})`; // approx #6cf
    ctx.fillText(glyph.char || "@", pos.x, pos.y);
  }
  // core glyph
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.fillStyle = glyph.fg || "#e8f7ff";
  ctx.fillText(glyph.char || "@", pos.x, pos.y);

  // subtle inner stroke for crispness
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.strokeStyle = "rgba(20, 3, 3, 0.1)";
  ctx.strokeText(glyph.char || "@", pos.x, pos.y);
  ctx.restore();

  // pooled particles (additive small dots), centered like the glyph
  renderPooledParticlesSystem(w, 0, { cx, cy, mode: 'lighter', alphaScale: 0.9 });

  // Debug HUD: show particle count (top-left)
  try {
    const stats = getGlobalParticlePool().getStats();
    const rows = [...w.query(Position, Emitter)];
    const emitters = rows.length;
    const em = rows[0]?.[2];
    const acc = em ? em._acc.toFixed(2) : '0.00';
    const rate = em ? em.rate : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#9cf';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`particles: ${stats.active}/${stats.total}  emitters: ${emitters}  rate:${rate} acc:${acc}`, 8, 8);
    ctx.restore();
  } catch {}
}

// Register systems and scheduler
// Simulation systems go under "update" (turn-based / step-driven)
// Real-time effects (emitters + particle pool) go under "fx" and are run outside world.tick
registerSystem(emitterSystem, "fx");

// Ensure pool integration runs after emission for the frame
registerSystem(particlePoolUpdateSystem, "fx", { after: [emitterSystem] });

// Only run the simulation phase inside world.tick; visuals are driven in the frame loop
world.setScheduler(composeScheduler("update"));

// --- Render Loop --- (as requested)
let last = performance.now();
function frame(now) {
  // Real-time delta in seconds for FX systems
  const dtSec = Math.max(0, (now - last) / 1000);
  last = now;

  // Advance simulation in fixed/step terms; here we keep sim paused (0) unless you drive it
  world.tick(0);

  // Run real-time effects (emitters + particle integration) against seconds
  runSystems("fx", world, dtSec);

  // Render current world state + particles
  renderSystem(world);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
