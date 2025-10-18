/*
  src/main.js — entry module
  - Imports ECS core and serialization from ./ecs/
  - Boots a tiny deterministic demo that runs in the canvas from index.html
  - Pure ES modules, no bundler. Works by opening index.html directly or serving.
*/

import { World, defineComponent, defineTag, Not, startLoop, runSelfTests } from '../../src/ecs/core.js';
import { makeRegistry, serializeWorld, applySnapshot } from '../../src/ecs/serialization.js';

// Prefer the explicit id used in index.html but fall back to the first <canvas>
const canvas = document.getElementById('canvas') || document.querySelector('canvas');
if (!canvas) {
  // Fail fast with a clear message to help contributors debug the HTML entrypoint.
  throw new Error('Canvas element not found. Ensure index.html contains <canvas id="canvas">');
}
const ctx = canvas.getContext('2d');

function resize(){
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  // Render in CSS px coordinates by scaling the context for devicePixelRatio
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// Create world with deterministic seed
const world = new World({ seed: 0xC0FFEE, store: 'map' });
world.enableDebug(false);

// Small component set for demo
const Position = defineComponent('Position', { x: 0, y: 0, r: 6 });
const Velocity = defineComponent('Velocity', { x: 0, y: 0 });

// Create a few moving entities using world's deterministic RNG
const N = 80;
for (let i = 0; i < N; i++){
  const e = world.create();
  const x = Math.floor(world.rand() * window.innerWidth);
  const y = Math.floor(world.rand() * window.innerHeight);
  const speed = 20 + Math.floor(world.rand() * 120);
  const ang = world.rand() * Math.PI * 2;
  const vx = Math.cos(ang) * speed;
  const vy = Math.sin(ang) * speed;
  const r = 4 + Math.floor(world.rand() * 10);
  world.add(e, Position, { x, y, r });
  world.add(e, Velocity, { x: vx, y: vy });
}

// Update system: simple Euler integration and wrap-around
world.system((w, dt) => {
  const W = window.innerWidth, H = window.innerHeight;
  for (const [id, p, v] of w.query(Position, Velocity)){
    p.x += v.x * dt;
    p.y += v.y * dt;
    if (p.x < -20) p.x += W + 40;
    if (p.x > W + 20) p.x -= W + 40;
    if (p.y < -20) p.y += H + 40;
    if (p.y > H + 20) p.y -= H + 40;
  }
}, 'update');

// Render system: draw filled circles
world.system((w, dtOrAlpha) => {
  // Clear in CSS pixels (context transformed to dpr)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4fc3f7';
  ctx.globalAlpha = 0.95;
  for (const [id, p] of w.query(Position)){
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}, 'render');

// Helpful dev utilities exposed on window
window.world = world;
window.serializeWorld = () => {
  try{
    const snap = serializeWorld(world);
    const text = JSON.stringify(snap, null, 2);
    console.log('Snapshot:', snap);
    return text;
  }catch(e){ console.warn('serializeWorld failed', e); }
};
window.applySnapshot = (data, registry) => {
  try{ applySnapshot(world, data, registry); } catch(e){ console.warn('applySnapshot failed', e); }
};
window.runEcsTests = () => { try{ runSelfTests(); }catch(e){ console.warn(e); } };

// Start the main loop. renderEveryFrame=false is fine because render systems run in tick.
const stop = startLoop(world, { fixed: 1/60, maxSubSteps: 5 });

// Console instructions for contributors
console.log('ECS demo started. See `world` and `serializeWorld()` on window.');

// Optional: if hash is #test run the self tests
if (location.hash === '#test'){
  try { runSelfTests(); } catch(e) { console.warn('Self-tests failed', e); }
}
