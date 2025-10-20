/*
  src/main.js — entry module
  - Imports ECS core and serialization from ./ecs/
  - Boots a tiny deterministic demo that runs in the canvas from index.html
  - Pure ES modules, no bundler. Works by opening index.html directly or serving.
*/

import { World, defineComponent, defineTag, Not, startLoop, runSelfTests } from './ecs/core.js';
import { makeRegistry, serializeWorld, applySnapshot } from './ecs/serialization.js';

// Prefer the explicit id used in index.html (#stage) but fall back to the first <canvas>
const canvas = document.getElementById('stage') || document.getElementById('terminal') || document.querySelector('canvas');
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

/* ------------------------------------------------------------
   UX skeleton: safe, no-op stubs and helpers for overlays/toasts
   These don't assume game logic and will degrade gracefully.
   ------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const overlays = { inv: $('invOverlay'), spell: $('spellOverlay'), log: $('logOverlay') };
const titleBar = $('titleBar');

function showOverlay(name){
  closeOverlays();
  const el = overlays[name];
  if (!el) return toast('Not implemented');
  el.classList.remove('hidden'); el.setAttribute('aria-hidden','false');
  toast(`${name} opened`, 900);
}
function closeOverlays(){
  for (const k of Object.keys(overlays)){
    const el = overlays[k]; if (!el) continue; el.classList.add('hidden'); el.setAttribute('aria-hidden','true');
  }
}

function toast(msg, ms=700){
  const container = $('toast'); if (!container) return console.log('toast:', msg);
  container.innerHTML = '';
  const node = document.createElement('div'); node.className = 'msg'; node.textContent = msg;
  container.appendChild(node);
  node.style.opacity = '1';
  setTimeout(()=>{ node.style.transition = 'opacity 260ms ease'; node.style.opacity = '0'; }, ms);
  setTimeout(()=>{ if (container.contains(node)) container.removeChild(node); }, ms + 300);
}

// Hook close buttons inside overlays
document.addEventListener('click', (e)=>{
  if (e.target.matches('.overlay .close')){ e.preventDefault(); closeOverlays(); }
});

// HUD click handlers: HP -> healing, MP -> auto-cast
const hpEl = $('hp'), mpEl = $('mp');
if (hpEl) hpEl.addEventListener('click', ()=>{ window.JS_HOOKS.useHealingItem(); });
if (mpEl) mpEl.addEventListener('click', ()=>{ window.JS_HOOKS.autoCastCurrentSpell(); });

// Keyboard fallbacks: I (inventory), P (spells), L (log), Esc (close overlays)
document.addEventListener('keydown', (e)=>{
  if (e.defaultPrevented) return;
  const key = e.key.toLowerCase();
  if (key === 'i') { e.preventDefault(); window.JS_HOOKS.openInventory(); }
  else if (key === 'p') { e.preventDefault(); window.JS_HOOKS.openSpellList(); }
  else if (key === 'l') { e.preventDefault(); window.JS_HOOKS.openLog(); }
  else if (e.key === 'Escape') { e.preventDefault(); window.JS_HOOKS.closeOverlays(); }
});

// Touch UI: show on touch-capable devices and wire dpad/action buttons
const touchUi = $('touch-ui');
function enableTouchUI(){
  if (!touchUi) return;
  touchUi.classList.remove('hidden'); touchUi.setAttribute('aria-hidden','false');
  // simple mapping: left/right/up/down from the 3x3 grid
  const buttons = touchUi.querySelectorAll('.dpad .btn');
  // indices: 0..8, center index 4 is wait
  buttons.forEach((btn, idx)=>{
    btn.addEventListener('click', ()=>{
      // center is wait, corners/edges map to directions
      const synthKey = (()=>{
        switch(idx){
          case 1: return 'ArrowUp';
          case 3: return 'ArrowLeft';
          case 5: return 'ArrowRight';
          case 7: return 'ArrowDown';
          case 4: return ' '; // wait (space)
          default: return null;
        }
      })();
      if (synthKey){
        // synthesize a KeyboardEvent for compatibility with input handlers
        const ev = new KeyboardEvent('keydown',{key: synthKey, bubbles:true});
        document.dispatchEvent(ev);
      }
    });
  });
  // actions (Cast, Inv) simple mappings
  const actions = touchUi.querySelectorAll('.actions .btn');
  if (actions[0]) actions[0].addEventListener('click', ()=> window.JS_HOOKS.onSpellChange(1));
  if (actions[1]) actions[1].addEventListener('click', ()=> window.JS_HOOKS.openInventory());
}

// Show touch UI when appropriate
if ('ontouchstart' in window || navigator.maxTouchPoints > 0){ enableTouchUI(); }

// Expose safe stubs that show toasts when game logic isn't present
window.JS_HOOKS = {
  openInventory: ()=> showOverlay('inv'),
  openSpellList: ()=> showOverlay('spell'),
  openLog: ()=> showOverlay('log'),
  closeOverlays,
  useHealingItem: ()=> toast('useHealingItem: Not implemented'),
  autoCastCurrentSpell: ()=> toast('autoCastCurrentSpell: Not implemented'),
  descendIfPossible: ()=> toast('descendIfPossible: Not implemented'),
  currentDungeonLevel: ()=> 1,
  currentCharacterName: ()=> 'Player',
  onSpellChange: (dir)=> toast('onSpellChange: Not implemented')
};

// Keep titleBar in sync with document.title
const titleUpdater = ()=>{ if (titleBar) titleBar.textContent = document.title; };
new MutationObserver(titleUpdater).observe(document.querySelector('title') || document.head, { childList: true, subtree: true });
titleUpdater();

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
