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

/* Spell picker (UI-only): populates #spellOverlay with sample spells and handles selection/cast
   - No game hooks invoked. Selecting + Cast shows a toast and optional vibration.
*/
const sampleSpells = [
  { id: 'fireball', name: 'Fireball', cost: 6, desc: 'Explosive arcane damage.' },
  { id: 'heal', name: 'Heal', cost: 4, desc: 'Restore some HP.' },
  { id: 'blink', name: 'Blink', cost: 3, desc: 'Short-range teleport.' },
  { id: 'shock', name: 'Shock', cost: 5, desc: 'Chain lightning.' }
];

function showSpellPicker(){
  const el = overlays.spell; if (!el) return toast('Spells overlay missing');
  // Build UI
  el.classList.remove('hidden'); el.setAttribute('aria-hidden','false');
  const body = el.querySelector('.panel-body');
  body.innerHTML = '';
  const list = document.createElement('div'); list.className = 'spell-list';
  list.style.display = 'grid'; list.style.gap = '8px'; list.style.marginTop = '8px';
  let selectedIndex = -1;

  sampleSpells.forEach((s, i)=>{
    const item = document.createElement('button');
    item.className = 'spell-item';
    item.type = 'button';
    item.style.display = 'flex'; item.style.justifyContent='space-between'; item.style.alignItems='center';
    item.style.padding='8px 10px'; item.style.borderRadius='8px'; item.style.background='rgba(255,255,255,0.02)';
    item.setAttribute('data-index', String(i));
    item.innerHTML = `<div style="display:flex;flex-direction:column;align-items:flex-start"><strong style="font-size:15px">${s.name}</strong><small style="color:var(--muted)">${s.desc}</small></div><span style="color:var(--muted)">MP ${s.cost}</span>`;
    item.addEventListener('click', ()=>{ select(i); });
    list.appendChild(item);
  });

  // Controls: Cast + Cancel
  const controls = document.createElement('div'); controls.style.display='flex'; controls.style.gap='8px'; controls.style.marginTop='12px';
  const castBtn = document.createElement('button'); castBtn.className='cast-btn'; castBtn.type='button'; castBtn.textContent='Cast';
  castBtn.style.padding='8px 12px'; castBtn.style.borderRadius='8px'; castBtn.disabled = true;
  const cancelBtn = document.createElement('button'); cancelBtn.type='button'; cancelBtn.textContent='Cancel';
  cancelBtn.style.padding='8px 12px'; cancelBtn.style.borderRadius='8px';
  controls.appendChild(castBtn); controls.appendChild(cancelBtn);

  body.appendChild(list); body.appendChild(controls);

  function select(i){
    const prev = list.querySelector('.spell-item.selected'); if (prev) prev.classList.remove('selected');
    const item = list.querySelector(`.spell-item[data-index="${i}"]`);
    if (!item) return;
    item.classList.add('selected');
    selectedIndex = i; castBtn.disabled = false;
  }

  function doCast(){
    if (selectedIndex < 0) return toast('No spell selected');
    const s = sampleSpells[selectedIndex];
    if (navigator.vibrate) navigator.vibrate(18);
    toast(`Cast: ${s.name}`);
    // Visual feedback: brief pulse on selected item
    const it = list.querySelector(`.spell-item[data-index="${selectedIndex}"]`);
    if (it){ it.animate([{transform:'scale(1)'},{transform:'scale(0.98)'},{transform:'scale(1)'}],{duration:220}); }
    // Close overlay after cast
    setTimeout(()=> closeOverlays(), 220);
  }

  castBtn.addEventListener('click', doCast);
  cancelBtn.addEventListener('click', ()=> closeOverlays());

  // Keyboard nav while overlay open
  function keyHandler(e){
    const key = e.key;
    if (key === 'ArrowDown') { e.preventDefault(); const ni = Math.min(sampleSpells.length-1, selectedIndex+1); select(ni); }
    else if (key === 'ArrowUp') { e.preventDefault(); const ni = Math.max(0, selectedIndex-1); select(ni); }
    else if (key === 'Enter') { e.preventDefault(); doCast(); }
    else if (key === 'Escape') { e.preventDefault(); closeOverlays(); }
  }
  document.addEventListener('keydown', keyHandler);

  // Clean up when overlay closes
  const observer = new MutationObserver(()=>{
    if (el.classList.contains('hidden')){
      document.removeEventListener('keydown', keyHandler);
      observer.disconnect();
    }
  });
  observer.observe(el, { attributes:true, attributeFilter:['class'] });
}

// Ensure JS_HOOKS.openSpellList opens the UI-only spell picker (non-game)
if (window.JS_HOOKS) window.JS_HOOKS.openSpellList = ()=> { showSpellPicker(); };

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

/* Swipe detector: open inventory on swipe-left
   - listens on the canvas (#stage) for pointer/touch gestures
   - forgiving thresholds for distance and velocity
*/
;(function installSwipe(){
  const el = canvas || document.body;
  let startX=0, startY=0, startT=0, tracking=false;
  const maxYDelta = 80; // allow some vertical movement
  const minXDelta = 60;  // minimum horizontal swipe

  function onStart(e){
    tracking = true;
    const p = (e.touches && e.touches[0]) || e;
    startX = p.clientX; startY = p.clientY; startT = performance.now();
  }
  function onMove(e){ if (!tracking) return; }
  function onEnd(e){
    if (!tracking) return; tracking = false;
    const p = (e.changedTouches && e.changedTouches[0]) || e;
    const dx = p.clientX - startX; const dy = p.clientY - startY;
    const dt = performance.now() - startT;
    // left swipe is negative dx
    if (Math.abs(dy) <= maxYDelta && dx <= -minXDelta){
      // Successful swipe-left -> open inventory
      if (navigator.vibrate) navigator.vibrate(12);
      window.JS_HOOKS.openInventory();
      toast('Inventory (swipe left)');
    }
  }

  el.addEventListener('touchstart', onStart, {passive:true});
  el.addEventListener('touchend', onEnd, {passive:true});
  el.addEventListener('pointerdown', onStart, {passive:true});
  el.addEventListener('pointerup', onEnd, {passive:true});
})();

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

// Replace the particle demo with a simple tiled map and player rendering.
// Map is larger than the viewport. Player is represented by '@' and moves
// with Arrow keys or the on-screen D-pad (which synthesizes arrow keys).

// Map / rendering config (CSS px tiles)
const TILE = { FLOOR: '.', WALL: '#' };
const TILE_SIZE = 18; // CSS pixels per tile
const MAP_W = 120, MAP_H = 80; // map dimensions (bigger than screen)

// Build a deterministic map using world's RNG
const map = new Array(MAP_H);
for (let y = 0; y < MAP_H; y++){
  map[y] = new Array(MAP_W);
  for (let x = 0; x < MAP_W; x++){
    // border walls
    if (x === 0 || y === 0 || x === MAP_W-1 || y === MAP_H-1) { map[y][x] = TILE.WALL; continue; }
    // random sparse walls
    map[y][x] = (world.rand() > 0.78) ? TILE.WALL : TILE.FLOOR;
  }
}

// Player state (tile coords)
const player = { x: Math.floor(MAP_W/2), y: Math.floor(MAP_H/2) };

// Simple camera that centers on player but clamps to map bounds
const camera = { x: 0, y: 0 };
function updateCamera(){
  const cols = Math.ceil(window.innerWidth / TILE_SIZE);
  const rows = Math.ceil(window.innerHeight / TILE_SIZE);
  camera.x = Math.max(0, Math.min(MAP_W - cols, Math.floor(player.x - cols/2)));
  camera.y = Math.max(0, Math.min(MAP_H - rows, Math.floor(player.y - rows/2)));
}
updateCamera();

// Movement: try to step player by dx,dy if target tile is floor
function tryMove(dx, dy){
  const nx = player.x + dx, ny = player.y + dy;
  if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) return false;
  if (map[ny][nx] === TILE.WALL) return false;
  player.x = nx; player.y = ny; updateCamera(); return true;
}

// Movement handler for arrow keys
function movementKeyHandler(e){
  const k = e.key;
  let moved = false;
  if (k === 'ArrowUp') { moved = tryMove(0, -1); }
  else if (k === 'ArrowDown') { moved = tryMove(0, 1); }
  else if (k === 'ArrowLeft') { moved = tryMove(-1, 0); }
  else if (k === 'ArrowRight') { moved = tryMove(1, 0); }
  if (moved){ e.preventDefault(); if (navigator.vibrate) navigator.vibrate(8); toast('Moved'); }
}
document.addEventListener('keydown', movementKeyHandler, {passive:false});

// Render system: draw map tiles and player as characters
world.system((w, dtOrAlpha) => {
  // Clear in CSS pixels (context transformed to dpr)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // rendering parameters
  const cols = Math.ceil(window.innerWidth / TILE_SIZE);
  const rows = Math.ceil(window.innerHeight / TILE_SIZE);
  const startX = camera.x, startY = camera.y;

  // background
  ctx.fillStyle = '#071018';
  ctx.fillRect(0,0,window.innerWidth, window.innerHeight);

  // draw tiles (simple: walls filled rects, floors as dots)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${TILE_SIZE-2}px system-ui, monospace`;
  for (let ry = 0; ry < rows; ry++){
    const my = startY + ry; if (my < 0 || my >= MAP_H) continue;
    for (let rx = 0; rx < cols; rx++){
      const mx = startX + rx; if (mx < 0 || mx >= MAP_W) continue;
      const ch = map[my][mx];
      const px = rx * TILE_SIZE + TILE_SIZE/2;
      const py = ry * TILE_SIZE + TILE_SIZE/2;
      if (ch === TILE.WALL){
        ctx.fillStyle = '#2b3440';
        ctx.fillRect(rx * TILE_SIZE, ry * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#90a0b8';
        ctx.fillText('#', px, py);
      } else {
        // floor
        ctx.fillStyle = '#071018';
        // subtle dot
        ctx.fillStyle = '#2e3a4a';
        ctx.fillText('.', px, py);
      }
    }
  }

  // Draw player
  const playerScreenX = (player.x - startX) * TILE_SIZE + TILE_SIZE/2;
  const playerScreenY = (player.y - startY) * TILE_SIZE + TILE_SIZE/2;
  ctx.fillStyle = '#4fc3f7'; ctx.font = `${TILE_SIZE}px system-ui, monospace`;
  ctx.fillText('@', playerScreenX, playerScreenY);

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
