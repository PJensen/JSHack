// display/ui/overlay.js
// Minimal UI overlays for inventory and message log; display-only.

import { ensureMemoryGraph } from './memoryGraph.js';
import { renderAlchemyBench } from './alchemyBenchOverlay.js';

const PANEL_Z_BASE = 1200;
let _panelZCounter = PANEL_Z_BASE;

/**
 * @param {any} it
 */
function isInventoryItemEquippable(it) {
  const type = String(it?.type || '');
  const slot = String(it?.slot || '').toLowerCase();
  return type === 'equip' || type === 'ammo' || type === 'wand' || slot === 'ranged';
}

/**
 * @param {any} it
 */
function isInventoryItemUsable(it) {
  if (!it) return false;
  return it.type === 'potion'
    || it.type === 'learn'
    || it.type === 'book'
    || it.type === 'scroll'
    || it.type === 'wand'
    || it.type === 'food';
}

/**
 * Resolve default inventory enter-action for the selected row.
 * @param {any} it
 * @returns {"none"|"apply"|"equip"|"use"|"set-spell"}
 */
export function getInventoryDefaultAction(it) {
  if (!it) return 'none';
  if (isInventoryItemEquippable(it)) return 'equip';
  if (isInventoryItemUsable(it)) return 'use';
  if (it.canApply && Number(it.applyTargetCount || 0) > 0) return 'apply';
  if (it.type === 'spell') return 'set-spell';
  return 'none';
}

export function initOverlays() {
  const root = ensureRoot();
  const inv = ensurePanel('inventory');
  const log = ensurePanel('messageLog');
  const pick = ensurePanel('pickup');
  const usePanel = ensurePanel('use');
  const throwPanel = ensurePanel('throw');
  const spells = ensurePanel('spells');
  const alchemy = ensurePanel('alchemy');
  const shop = ensurePanel('shop');
  const chest = ensurePanel('chest');
  const groundTip = ensureGroundTooltip(root);
  const stairTip = ensureStairTooltip(root);
  const tombstoneTip = ensureTombstoneTooltip(root);
  const spellGestureHint = ensureSpellGestureHint(root);
  const gestureDebug = ensureGestureDebugLayer(root);
  const memoryGraph = ensureMemoryGraph(root);
  const deathLog = ensurePanel('deathLog');
  const bookReader = ensurePanel('bookReader');
  const deathScreen = ensureDeathScreen(root);
  const WRATH_DEATH_SCREEN_DELAY_MS = 320;
  let deathScreenShowTimer = 0;

  // Always-on, semi-transparent message ticker (non-modal)
  const ticker = ensureMessageTicker(root);
  let spellGestureTimer = 0;

  window.addEventListener('ui:openInventory', () => {
    show(inv);
    // Request data from app; app will respond with ui:inventoryData
    window.dispatchEvent(new CustomEvent('ui:requestInventoryData'));
  });
  // Toggle inventory panel open/close
  window.addEventListener('ui:toggleInventory', () => {
    if (inv.style.display === 'block') {
      hide(inv);
    } else {
      show(inv);
      window.dispatchEvent(new CustomEvent('ui:requestInventoryData'));
    }
  });
  // Toggle memory graph
  window.addEventListener('ui:toggleMemoryGraph', () => {
    if (memoryGraph.canvas.style.display === 'block') {
      memoryGraph.hide();
      memoryGraph.stopSampling();
    } else {
      memoryGraph.show();
      memoryGraph.startSampling();
    }
  });
  window.addEventListener('ui:openMessageLog', () => {
    show(log);
    // Request messages; app may respond with ui:messageLogData
    window.dispatchEvent(new CustomEvent('ui:requestMessageLogData'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hide(inv);
      hide(log);
      hide(pick);
      hide(usePanel);
      hide(throwPanel);
      hide(spells);
      hide(alchemy);
      hide(shop);
      hide(chest);
      hide(applyPanel);
      hide(deathLog);
      hide(bookReader);
      // Close memory graph
      if (memoryGraph.canvas.style.display === 'block') {
        memoryGraph.hide();
        memoryGraph.stopSampling();
      }
      if ((/** @type {any} */ (ticker))._expanded) {
        (/** @type {any} */ (ticker))._expanded = false;
        renderMessageTicker(ticker, (/** @type {any} */ (ticker))._entries || []);
      }
    }
  });

  // Data feeds
  window.addEventListener('ui:inventoryData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    const ground = e?.detail?.ground || null;
    renderInventory(inv, items, ground);
  });
  window.addEventListener('ui:messageLogData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const entries = (e?.detail?.entries) || [];
    renderMessageLog(log, entries);
  });

  // Spell picker overlay
  window.addEventListener('ui:openSpellPicker', () => {
    show(spells);
    window.dispatchEvent(new CustomEvent('ui:requestSpellData'));
  });
  window.addEventListener('ui:spellData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.spells) || [];
    const activeId = e?.detail?.activeSpellId || null;
    renderSpellPicker(spells, items, activeId);
  });

  // Open pickup chooser: expects items array [{ id, name, type, count }]
  window.addEventListener('ui:openPickupChooser', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    renderPickupChooser(pick, items);
    show(pick);
  });

  // Use-item chooser (filtered inventory for usable items)
  window.addEventListener('ui:openUseChooser', () => {
    show(usePanel);
    window.dispatchEvent(new CustomEvent('ui:requestUsableItemsData'));
  });
  window.addEventListener('ui:usableItemsData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    renderUseChooser(usePanel, items);
  });

  // Throw-item chooser
  window.addEventListener('ui:openThrowChooser', () => {
    show(throwPanel);
    window.dispatchEvent(new CustomEvent('ui:requestThrowableItemsData'));
  });
  window.addEventListener('ui:throwableItemsData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    renderThrowChooser(throwPanel, items);
  });

  // Apply-tool chooser (two-step: pick tool, then pick target)
  const applyPanel = ensurePanel('apply');
  let _applyToolId = 0;
  window.addEventListener('ui:openApplyChooser', () => {
    _applyToolId = 0;
    // Keep modal overlays exclusive; prevents touch click-through into inventory rows.
    hide(inv);
    show(applyPanel);
    window.dispatchEvent(new CustomEvent('ui:requestApplyToolsData'));
  });
  window.addEventListener('ui:openApplyForTool', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const toolId = Number(e?.detail?.toolId || 0);
    if (!Number.isInteger(toolId) || toolId <= 0) return;
    _applyToolId = toolId;
    // Opening apply from inventory should not leave inventory interactive behind it.
    hide(inv);
    show(applyPanel);
    window.dispatchEvent(new CustomEvent('ui:requestApplyTargetsData', { detail: { toolId } }));
  });
  window.addEventListener('ui:applyToolsData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const tools = (e?.detail?.items) || [];
    renderApplyToolChooser(applyPanel, tools, (toolId) => {
      _applyToolId = toolId;
      window.dispatchEvent(new CustomEvent('ui:requestApplyTargetsData', { detail: { toolId } }));
    });
  });
  window.addEventListener('ui:applyTargetsData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const targets = (e?.detail?.items) || [];
    const toolId = _applyToolId;
    renderApplyTargetChooser(applyPanel, targets, toolId, (targetItemId) => {
      window.dispatchEvent(new CustomEvent('ui:requestApply', { detail: { toolId, targetItemId } }));
      hide(applyPanel);
    });
  });

  // Shop overlay
  let _shopState = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5, mode: 'browse' };
  window.addEventListener('ui:openShop', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _shopState.shopkeeperId = d.shopkeeperId || 0;
    _shopState.buyMarkup = d.buyMarkup ?? 1.0;
    _shopState.sellDiscount = d.sellDiscount ?? 0.5;
    _shopState.mode = d.mode || 'browse';
    show(shop);
  });
  window.addEventListener('ui:closeShop', () => {
    _shopState.shopkeeperId = 0;
    _shopState.mode = 'browse';
    hide(shop);
  });
  window.addEventListener('ui:shopData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderShop(shop, d, _shopState);
  });

  // Alchemy bench overlay
  let _alchemyState = {
    benchId: 0,
    ingredients: { berries: 0, herbs: 0, thornPods: 0, venomFronds: 0 },
    recipes: [],
  };
  window.addEventListener('ui:openAlchemyBench', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _alchemyState.benchId = Number(d.benchId || 0) | 0;
    show(alchemy);
    renderAlchemyBench(alchemy, _alchemyState);
  });
  window.addEventListener('ui:closeAlchemyBench', () => {
    _alchemyState.benchId = 0;
    hide(alchemy);
  });
  window.addEventListener('ui:alchemyBenchData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _alchemyState = {
      benchId: Number(d.benchId || _alchemyState.benchId || 0) | 0,
      ingredients: d.ingredients && typeof d.ingredients === 'object'
        ? d.ingredients
        : { berries: 0, herbs: 0, thornPods: 0, venomFronds: 0 },
      recipes: Array.isArray(d.recipes) ? d.recipes : [],
    };
    renderAlchemyBench(alchemy, _alchemyState);
  });

  // Chest overlay
  let _chestState = { chestId: 0 };
  window.addEventListener('ui:openChest', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _chestState.chestId = d.chestId || 0;
    show(chest);
  });
  window.addEventListener('ui:chestData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderChest(chest, d, _chestState);
  });

  // Ground item tooltip lifecycle
  window.addEventListener('ui:showGroundItem', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderGroundTooltip(groundTip, d);
    groundTip.style.display = 'block';
  });
  window.addEventListener('ui:hideGroundItem', () => {
    groundTip.style.display = 'none';
  });

  // Stair tooltip lifecycle
  window.addEventListener('ui:showStairTooltip', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderStairTooltip(stairTip, d);
    stairTip.style.display = 'block';
  });
  window.addEventListener('ui:hideStairTooltip', () => {
    stairTip.style.display = 'none';
  });

  // Tombstone tooltip lifecycle
  window.addEventListener('ui:showTombstoneTooltip', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderTombstoneTooltip(tombstoneTip, d);
    tombstoneTip.style.display = 'block';
  });
  window.addEventListener('ui:hideTombstoneTooltip', () => {
    tombstoneTip.style.display = 'none';
  });

  // Passive updates to the always-on ticker
  window.addEventListener('ui:updateMessageTicker', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const entries = (e?.detail?.entries) || [];
    renderMessageTicker(ticker, entries);
  });

  // Gesture debug path overlay
  window.addEventListener('ui:gestureProgress', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const pts = Array.isArray(e?.detail?.points) ? e.detail.points : [];
    const active = !!e?.detail?.active;
    const rec = e?.detail?.recognized || null;
    drawGestureDebug(gestureDebug, pts, active, rec);
  });

  window.addEventListener('ui:showSpellGestureHint', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = String(e?.detail?.id || '');
    if (id !== 'lightning' && id !== 'meteor' && id !== 'blastwave') return;
    const mode = String(e?.detail?.mode || 'cast');
    const quality = Number(e?.detail?.quality);
    const clamped = Number.isFinite(quality) ? Math.max(0.35, Math.min(1, quality)) : 1;
    let duration = mode === 'learn' ? 2600 : 900;
    if (id === 'meteor' && mode === 'cast') duration = 1800;
    if (id === 'lightning') {
      spellGestureHint.glyph.textContent = 'Z';
      spellGestureHint.glyph.style.textShadow = buildLightningShadow(clamped);
      spellGestureHint.wrap.style.filter = 'drop-shadow(0 0 22px rgba(120,200,255,0.45))';
      spellGestureHint.caption.textContent = mode === 'learn'
        ? 'Draw a Z to unleash Lightning!'
        : '';
      spellGestureHint.caption.style.display = mode === 'learn' ? 'block' : 'none';
    } else if (id === 'blastwave') {
      spellGestureHint.glyph.textContent = '◯';
      spellGestureHint.glyph.style.textShadow = '0 0 16px rgba(255,170,80,0.55), 0 0 30px rgba(255,140,50,0.35)';
      spellGestureHint.wrap.style.filter = 'drop-shadow(0 0 22px rgba(255,170,80,0.45))';
      spellGestureHint.caption.textContent = mode === 'learn'
        ? 'Draw a circle to unleash Blast Wave!'
        : '';
      spellGestureHint.caption.style.display = mode === 'learn' ? 'block' : 'none';
    } else {
      spellGestureHint.glyph.textContent = '/';
      spellGestureHint.glyph.style.textShadow = buildFlameShadow(clamped);
      spellGestureHint.wrap.style.filter = 'drop-shadow(0 0 22px rgba(255,160,80,0.45))';
      spellGestureHint.caption.textContent = (mode === 'learn')
        ? 'Draw a diagonal to call Meteor!'
        : 'Tap a target';
      spellGestureHint.caption.style.display = 'block';
    }
    spellGestureHint.glyph.style.opacity = mode === 'cast' ? '0.92' : '1';
    spellGestureHint.wrap.style.display = 'flex';
    spellGestureHint.wrap.style.animation = 'none';
    spellGestureHint.wrap.style.transform = 'translate(-50%, -50%) scale(1)';
    if (spellGestureTimer) window.clearTimeout(spellGestureTimer);
    spellGestureTimer = window.setTimeout(() => {
      spellGestureHint.wrap.style.display = 'none';
      spellGestureTimer = 0;
    }, duration);
  });

  // Death log overlay (all past deaths)
  window.addEventListener('ui:openDeathLog', () => {
    show(deathLog);
    window.dispatchEvent(new CustomEvent('ui:requestDeathLogData'));
  });
  window.addEventListener('ui:deathLogData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const records = (e?.detail?.records) || [];
    renderDeathLog(deathLog, records);
  });

  // Book reader overlay (decorative dungeon books)
  window.addEventListener('ui:openBookReader', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderBookReader(bookReader, d.title || 'Book', d.text || '');
    show(bookReader);
  });

  // Death screen with social share
  window.addEventListener('ui:playerDied', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    const showDeathScreen = () => {
      renderDeathScreen(deathScreen, d);
      deathScreen.style.display = 'block';
    };

    if (deathScreenShowTimer) {
      window.clearTimeout(deathScreenShowTimer);
      deathScreenShowTimer = 0;
    }

    if (String(d?.cause || '').toLowerCase() === 'divine_wrath') {
      // Let divine strike VFX read before the opaque death panel takes over.
      deathScreenShowTimer = window.setTimeout(() => {
        deathScreenShowTimer = 0;
        showDeathScreen();
      }, WRATH_DEATH_SCREEN_DELAY_MS);
      return;
    }

    showDeathScreen();
  });

  return { root, inv, log, ticker };
}

function ensureRoot() {
  let root = document.getElementById('ui-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'ui-root';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '1000';
    document.body.appendChild(root);
  }
  return root;
}

// --- Gesture debug overlay -------------------------------------------------
function ensureGestureDebugLayer(root) {
  const canvas = document.createElement('canvas');
  canvas.id = 'gesture-debug-layer';
  Object.assign(canvas.style, {
    position: 'fixed',
    left: '0', top: '0', right: '0', bottom: '0',
    width: '100vw', height: '100vh',
    pointerEvents: 'none',
    zIndex: 910,
    display: 'none',
  });
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const resize = () => {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(1, window.innerWidth | 0);
    const h = Math.max(1, window.innerHeight | 0);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  return { canvas, ctx, resize };
}

function drawGestureDebug(layer, points, active, recognized) {
  if (!layer || !layer.ctx) return;
  const ctx = layer.ctx;
  const canvas = layer.canvas;
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hasPoints = Array.isArray(points) && points.length > 0;
  const show = !!(active || recognized || hasPoints);
  canvas.style.display = show ? 'block' : 'none';
  if (!show || !hasPoints) return;

  // Draw path
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = recognized ? '#5ff' : (active ? '#8cf' : '#bbb');
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // Endpoints
  const first = points[0];
  const last = points[points.length - 1];
  if (first) { ctx.beginPath(); ctx.arc(first.x, first.y, 4, 0, Math.PI * 2); ctx.fill(); }
  if (last) { ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fill(); }

  // Recognition bounds
  if (recognized && recognized.bounds) {
    const b = recognized.bounds;
    const bx = Number.isFinite(Number(b.x)) ? Number(b.x) : Number(b.minX || 0);
    const by = Number.isFinite(Number(b.y)) ? Number(b.y) : Number(b.minY || 0);
    const bw = Number.isFinite(Number(b.w)) ? Number(b.w) : Number(b.width || 0);
    const bh = Number.isFinite(Number(b.h)) ? Number(b.h) : Number(b.height || 0);
    ctx.strokeStyle = 'rgba(120,200,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
  }
  ctx.restore();
}

// --- Ground item tooltip (click to pick up) -------------------------------
/** @param {HTMLElement} root */
function ensureGroundTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'ground-item-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 32px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '220px', maxWidth: '70vw', pointerEvents: 'auto', display: 'none',
    background: 'rgba(14,18,26,0.96)', color: '#dbeaff', borderRadius: '10px',
    border: '1px solid #33435f', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '10px 12px', zIndex: 850
  });
  root.appendChild(tip);
  return tip;
}

// --- Stair tooltip (tap to descend/ascend) ---------------------------------
/** @param {HTMLElement} root */
function ensureStairTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'stair-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 96px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '180px', pointerEvents: 'auto', display: 'none',
    background: 'rgba(14,18,26,0.96)', color: '#dbeaff', borderRadius: '10px',
    border: '1px solid #33435f', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '10px 16px', zIndex: 850,
    textAlign: 'center', cursor: 'pointer'
  });
  root.appendChild(tip);
  return tip;
}

/** @param {HTMLDivElement} tip @param {{stairId?:number, direction?:string}} detail */
function renderStairTooltip(tip, detail) {
  tip.innerHTML = '';
  const dir = detail?.direction || 'down';
  const isReturn = dir === 'return';
  const label = isReturn
    ? 'Return Portal'
    : (dir === 'down' ? 'Descend Stairs' : 'Ascend Stairs');

  const title = document.createElement('div');
  title.textContent = label;
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' });
  tip.appendChild(title);

  const hint = document.createElement('div');
  hint.style.opacity = '0.8';
  hint.style.fontSize = '12px';
  hint.textContent = isReturn
    ? 'Tap to return'
    : `Tap to ${dir === 'down' ? 'descend' : 'ascend'}`;
  tip.appendChild(hint);

  tip.onclick = () => {
    window.dispatchEvent(new CustomEvent('ui:requestStairTraverse', {
      detail: { stairId: detail?.stairId, direction: dir }
    }));
    tip.style.display = 'none';
  };
}

// --- Tombstone tooltip (epitaph sign at top of screen) ---------------------
/** @param {HTMLElement} root */
function ensureTombstoneTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'tombstone-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    top: '24px',
    transform: 'translateX(-50%)',
    minWidth: '200px', maxWidth: '320px', pointerEvents: 'none', display: 'none',
    background: 'rgba(30,28,24,0.95)', color: '#b0a890',
    borderRadius: '4px',
    border: '2px solid #6b6252',
    boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
    fontFamily: 'monospace', padding: '14px 20px', zIndex: 900,
    textAlign: 'center', whiteSpace: 'pre-line'
  });
  root.appendChild(tip);
  return tip;
}

/** @param {HTMLDivElement} tip @param {{epitaph?:string}} detail */
function renderTombstoneTooltip(tip, detail) {
  tip.innerHTML = '';

  const header = document.createElement('div');
  header.textContent = '\u2020 TOMBSTONE \u2020';
  Object.assign(header.style, {
    fontSize: '11px', letterSpacing: '3px', color: '#887860',
    marginBottom: '8px', textTransform: 'uppercase'
  });
  tip.appendChild(header);

  const rule = document.createElement('hr');
  Object.assign(rule.style, {
    border: 'none', borderTop: '1px solid #5a5040',
    margin: '0 0 8px 0'
  });
  tip.appendChild(rule);

  const text = document.createElement('div');
  text.textContent = detail?.epitaph || 'The inscription has faded\u2026';
  Object.assign(text.style, {
    fontSize: '13px', lineHeight: '1.5', color: '#c8b898'
  });
  tip.appendChild(text);
}

function ensureSpellGestureHint(root) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    left: '50%',
    top: '38%',
    transform: 'translate(-50%, -50%)',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    gap: '12px',
    zIndex: 920,
  });

  const glyph = document.createElement('div');
  glyph.textContent = 'Z';
  Object.assign(glyph.style, {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 'min(160px, 28vw)',
    color: '#d6f3ff',
    letterSpacing: '-0.04em',
    textShadow: buildLightningShadow(1),
    transition: 'opacity 120ms ease-out',
  });

  const caption = document.createElement('div');
  caption.textContent = 'Draw a Z to cast Lightning';
  Object.assign(caption.style, {
    fontFamily: 'monospace',
    fontSize: 'min(24px, 5vw)',
    color: '#d6f3ff',
    textShadow: '0 0 6px rgba(80,160,255,0.55)',
    background: 'rgba(8,12,18,0.55)',
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(80,140,200,0.45)',
  });

  wrap.appendChild(glyph);
  wrap.appendChild(caption);
  root.appendChild(wrap);

  return { wrap, glyph, caption };
}

function buildLightningShadow(intensity) {
  const base = Math.max(0.2, Math.min(1, intensity));
  const outer = (12 + base * 32).toFixed(1);
  const inner = (6 + base * 18).toFixed(1);
  const core = (3 + base * 10).toFixed(1);
  return `0 0 ${outer}px rgba(120,200,255,0.55), 0 0 ${inner}px rgba(180,240,255,0.7), 0 0 ${core}px rgba(255,255,255,0.9)`;
}

function buildFlameShadow(intensity) {
  const base = Math.max(0.2, Math.min(1, intensity));
  const outer = (12 + base * 32).toFixed(1);
  const inner = (6 + base * 18).toFixed(1);
  const core = (3 + base * 10).toFixed(1);
  return `0 0 ${outer}px rgba(255,160,80,0.55), 0 0 ${inner}px rgba(255,200,120,0.7), 0 0 ${core}px rgba(255,255,200,0.9)`;
}

/** @param {HTMLDivElement} tip @param {{mode?:'single'|'multi', item?:any, items?:any[], count?:number, pickupRange?:number}} detail */
function renderGroundTooltip(tip, detail) {
  tip.innerHTML = '';
  const mode = detail?.mode || 'single';
  if (mode === 'multi') {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
    const lbl = document.createElement('div');
    lbl.textContent = detail?.fromChest ? 'Open Chest' : `${detail?.count || (detail?.items?.length || 0)} items nearby`;
    lbl.style.fontWeight = 'bold';
    const hint = document.createElement('div');
    hint.textContent = 'Tap to choose'; hint.style.marginLeft = 'auto'; hint.style.opacity = '0.8';
    row.appendChild(lbl); row.appendChild(hint);
    tip.appendChild(row);
    tip.onclick = () => {
      const items = Array.isArray(detail?.items) ? detail.items : [];
      window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
      tip.style.display = 'none';
    };
    return;
  }

  const it = detail?.item || {};
  const title = document.createElement('div');
  const rarity = String(it.rarityName || 'common').toLowerCase();
  const name = bracketize(sanitize(it.name || 'item'));
  title.textContent = name;
  Object.assign(title.style, rarityStyle(rarity));
  title.style.marginBottom = '6px';
  tip.appendChild(title);

  // Bonus lines
  const bonuses = it.bonuses && typeof it.bonuses === 'object' ? it.bonuses : {};
  const bonusKeys = Object.keys(bonuses);
  // Damage summary (if present)
  const dmgWrap = document.createElement('div');
  let hasDmg = false;
  if (it.damageDice) {
    const line = document.createElement('div');
    line.textContent = `Damage: ${String(it.damageDice)}`;
    line.style.color = '#ffd7a0';
    dmgWrap.appendChild(line);
    hasDmg = true;
  }
  if (Number.isFinite(Number(bonuses.attack))) {
    const v = Number(bonuses.attack);
    const line = document.createElement('div');
    const sign = v > 0 ? '+' : '';
    line.textContent = `Attack: ${sign}${v}`;
    line.style.color = '#ffd7a0';
    dmgWrap.appendChild(line);
    hasDmg = true;
  }
  if (Number.isFinite(Number(bonuses.damage))) {
    const v = Number(bonuses.damage);
    const line = document.createElement('div');
    const sign = v > 0 ? '+' : '';
    line.textContent = `Damage Bonus: ${sign}${v}`;
    line.style.color = '#ffd7a0';
    dmgWrap.appendChild(line);
    hasDmg = true;
  }
  if (Number.isFinite(Number(bonuses.critChance)) || Number.isFinite(Number(bonuses.critMult))) {
    const cc = Number(bonuses.critChance) || 0;
    const cm = Number(bonuses.critMult) || 0;
    const line = document.createElement('div');
    line.textContent = `Crit: ${cc ? `${cc}%` : '—'}${cm ? ` x${cm.toFixed(2)}` : ''}`;
    line.style.color = '#ffd7a0';
    dmgWrap.appendChild(line);
    hasDmg = true;
  }
  if (hasDmg) {
    const sep = document.createElement('div'); sep.textContent = '—'; sep.style.opacity = '0.4'; sep.style.margin = '6px 0 4px';
    tip.appendChild(sep);
    tip.appendChild(dmgWrap);
  }
  if (bonusKeys.length) {
    for (const k of bonusKeys) {
      const v = Number(bonuses[k]);
      if (!Number.isFinite(v) || v === 0) continue;
      const line = document.createElement('div');
      const sign = v > 0 ? '+' : '';
      line.textContent = `${sign}${v} ${humanize(k)}`;
      tip.appendChild(line);
    }
  }

  // Affixes (names only for now)
  const aff = Array.isArray(it.affixes) ? it.affixes : [];
  if (aff.length) {
    const sep = document.createElement('div'); sep.textContent = '────────────'; sep.style.opacity = '0.4'; sep.style.margin = '6px 0 4px'; tip.appendChild(sep);
    for (const a of aff) {
      const line = document.createElement('div');
      line.textContent = humanize(String(a));
      line.style.opacity = '0.9';
      tip.appendChild(line);
    }
  }

  // Footer hint
  const foot = document.createElement('div');
  foot.style.marginTop = '6px'; foot.style.opacity = '0.8'; foot.style.fontSize = '12px';
  foot.textContent = 'Tap to pick up';
  tip.appendChild(foot);

  // Click behavior: attempt pickup via shared flow
  tip.onclick = () => {
    const id = Number(it.id || 0);
    if (id > 0) {
      window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: [id] } }));
    }
    tip.style.display = 'none';
  };
}

/** @param {string} k */
function humanize(k) {
  const s = String(k || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase().trim();
  return s;
}

/** @param {string} kind */
function ensurePanel(kind) {
  const root = ensureRoot();
  const panel = document.createElement('div');
  panel.className = `ui-panel ui-panel-${kind}`;
  Object.assign(panel.style, {
    position: 'absolute', left: '0', top: '0', right: '0', bottom: '0',
    display: 'none', pointerEvents: 'auto',
    background: 'rgba(6,9,14,0.85)', color: '#cfe8ff',
    backdropFilter: 'blur(4px)',
    fontFamily: 'monospace',
    zIndex: String(PANEL_Z_BASE),
  });

  // Tapping/clicking outside the inner content should close the overlay.
  panel.addEventListener('pointerdown', (ev) => {
    if (ev.target === panel) {
      hide(panel);
    }
  });

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(600px, 90vw)', maxHeight: '80vh', overflow: 'auto',
    boxSizing: 'border-box',
    border: '1px solid #2d3b52', borderRadius: '8px', padding: '12px',
    background: '#0b0e16', boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
  });
  // Close button
  const close = document.createElement('button');
  close.textContent = '×';
  Object.assign(close.style, {
    position: 'absolute', right: '6px', top: '6px', width: '28px', height: '28px',
    border: '1px solid #2d3b52', borderRadius: '6px', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  close.addEventListener('click', () => hide(panel));
  inner.appendChild(close);
  panel.appendChild(inner);
  root.appendChild(panel);
  /** @type {any} */ (panel)._inner = inner;
  return panel;
}

/** @param {HTMLDivElement} panel */
function show(panel) {
  _panelZCounter += 1;
  panel.style.zIndex = String(_panelZCounter);
  panel.style.display = 'block';
}
/** @param {HTMLDivElement} panel */
function hide(panel) { panel.style.display = 'none'; }

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items @param {any} [ground] */
function renderInventory(panel, items, ground) {
  const existingDetach = /** @type {any} */ (panel)._inventoryDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] inventory detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  const title = document.createElement('div');
  title.textContent = 'Inventory';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    (/** @type {any} */ (panel))._inventorySelectionKey = '';
    (/** @type {any} */ (panel))._inventorySelectionIndex = 0;
    (/** @type {any} */ (panel))._inventoryScrollTop = 0;
    const empty = document.createElement('div');
    empty.textContent = '(empty)';
    el.appendChild(empty);
    return;
  }

  // Keyboard-driven list
  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  list.style.maxHeight = '42vh';
  list.style.overflowY = 'auto';
  list.style.overflowX = 'hidden';
  el.appendChild(list);

  const savedSelectionKey = String((/** @type {any} */ (panel))._inventorySelectionKey || '');
  const savedSelectionIndex = Number((/** @type {any} */ (panel))._inventorySelectionIndex || 0);
  const savedScrollTop = Number((/** @type {any} */ (panel))._inventoryScrollTop || 0);
  if (Number.isFinite(savedScrollTop) && savedScrollTop > 0) {
    list.scrollTop = savedScrollTop;
  }
  list.addEventListener('scroll', () => {
    (/** @type {any} */ (panel))._inventoryScrollTop = list.scrollTop;
  });

  let sel = 0;
  /** @param {string} rarityName */
  function rarityStyle(rarityName) {
    const rn = String(rarityName || 'common').toLowerCase();
    if (rn === 'rare' || rn === 'magic') return { color: '#55aaff', weight: 'bold' };
    if (rn === 'epic') return { color: '#c47bff', weight: 'bold' };
    if (rn === 'legendary') return { color: '#ff9f3b', weight: 'bold' };
    return { color: '#ffffff', weight: 'bold' }; // common
  }

  const rows = items.map((it, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', padding: '6px 8px',
      boxSizing: 'border-box',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px'
    });
    if (it.unpaid) {
      row.style.borderColor = '#d9963b';
      row.style.background = 'rgba(65, 35, 10, 0.75)';
    }
    row.dataset.itemId = String(it.id);
    row.tabIndex = 0;

    const star = document.createElement('span');
    star.textContent = it.equipped ? '*' : ' ';
    star.style.width = '1ch';
    star.style.color = '#ffd27d';

    const name = document.createElement('span');
    const rs = rarityStyle(it.rarityName);
    name.textContent = bracketize(sanitize(it.name || it.description || it.type));
    name.style.color = rs.color; name.style.fontWeight = rs.weight;
    name.style.flex = '1 1 auto';
    name.style.minWidth = '0';
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    name.style.whiteSpace = 'nowrap';

    const slot = document.createElement('span');
    slot.style.opacity = '0.7'; slot.textContent = it.slot ? `(${it.slot})` : '';

    const qty = document.createElement('span');
    qty.style.marginLeft = 'auto';
    qty.style.opacity = '0.8';
    const count = Math.max(0, Number(it.count ?? 1) | 0);
    qty.textContent = it.type === 'wand' ? `${count} ch` : `x${count}`;

    const unpaidTag = document.createElement('span');
    if (it.unpaid) {
      const bill = Number(it.unpaidPrice || 0);
      unpaidTag.textContent = bill > 0 ? `UNPAID ${bill}g` : 'UNPAID';
      unpaidTag.style.color = '#ffbf5a';
      unpaidTag.style.fontWeight = 'bold';
      unpaidTag.style.fontSize = '11px';
      unpaidTag.style.marginLeft = '6px';
    }

    row.appendChild(star);
    row.appendChild(name);
    row.appendChild(slot);
    if (it.unpaid) row.appendChild(unpaidTag);
    row.appendChild(qty);

    row.addEventListener('click', () => { setSel(idx); });
    row.addEventListener('dblclick', () => {
      setSel(idx);
      defaultAction();
    });
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.style.whiteSpace = 'normal';
  hint.style.overflowWrap = 'anywhere';
  hint.style.wordBreak = 'break-word';
  el.appendChild(hint);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    marginTop: '8px',
    padding: '8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    minHeight: '48px',
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
  });
  el.appendChild(actions);

  const details = document.createElement('div');
  Object.assign(details.style, {
    marginTop: '8px',
    padding: '8px',
    minHeight: '4.8em',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    color: '#cfe8ff',
    opacity: '0.9',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  });
  el.appendChild(details);

  function triggerApplyForTool(it) {
    const toolId = Number(it?.id || 0);
    if (!Number.isInteger(toolId) || toolId <= 0) return;
    window.dispatchEvent(new CustomEvent('ui:openApplyForTool', { detail: { toolId } }));
  }

  /** @param {any} it */
  function enterActionLabel(it) {
    const action = getInventoryDefaultAction(it);
    if (action === 'apply') return 'Apply';
    if (action === 'equip') return it?.equipped ? 'Unequip' : 'Equip';
    if (action === 'use') return 'Use';
    if (action === 'set-spell') return 'Set Spell';
    return 'None';
  }

  function updateHint() {
    const it = items[sel];
    const groundAction = resolveGroundPickupAction();
    const canApplyTool = !!it?.canApply;
    const hasApplyTargets = !!(canApplyTool && Number(it?.applyTargetCount || 0) > 0);
    const applyHint = canApplyTool
      ? (hasApplyTargets ? ' · A=Apply' : ' · A=Apply (no targets)')
      : '';
    hint.textContent = `↑/↓ to select · Enter=${enterActionLabel(it)} · U=Use · E=Equip/Unequip · ,=Drop · T=Throw${applyHint}${groundAction ? ' · P=Pickup' : ''} · S=Set Spell · Esc=Close · UNPAID items are stolen`;
    const text = String(it?.description || '').trim();
    details.textContent = text || '(no description)';
    renderInventoryActions();
  }

  function createActionButton(label, onClick, opts) {
    const btn = document.createElement('button');
    btn.textContent = label;
    decorateButton(btn);
    btn.style.minHeight = '44px';
    btn.style.padding = '8px 12px';
    if (opts?.disabled) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      if (opts?.disabledReason) btn.title = String(opts.disabledReason);
    }
    if (opts?.primary) {
      btn.style.background = '#173458';
      btn.style.borderColor = '#5fb3ff';
      btn.style.fontWeight = '700';
      btn.style.color = '#e9f5ff';
      btn.style.boxShadow = '0 0 0 1px rgba(95,179,255,0.2)';
      btn.title = 'Default action (Enter)';
    }
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderInventoryActions() {
    const it = items[sel];
    actions.innerHTML = '';
    if (!it) return;

    const hasItemId = Number.isInteger(it.id) && it.id > 0;
    const canApplyTool = !!it?.canApply;
    const hasApplyTargets = !!(canApplyTool && Number(it.applyTargetCount || 0) > 0);
    const available = [];
    if (isInventoryItemEquippable(it) && hasItemId) {
      available.push({ key: 'equip', label: it.equipped ? 'Unequip' : 'Equip', enabled: true });
    }
    if (isInventoryItemUsable(it) && hasItemId) {
      available.push({ key: 'use', label: 'Use', enabled: true });
    }
    if (canApplyTool && hasItemId) {
      available.push({
        key: 'apply',
        label: 'Apply',
        enabled: hasApplyTargets,
        disabledReason: hasApplyTargets ? '' : 'No valid targets in inventory',
      });
    }
    if (it.type === 'spell') {
      const spellId = String(it.id || '').replace(/^spell:/, '');
      if (spellId) {
        available.push({ key: 'set-spell', label: it.equipped ? 'Active Spell' : 'Set Spell', enabled: true });
      }
    }
    if (hasItemId) {
      available.push({ key: 'throw', label: 'Throw', enabled: true });
    }
    if (hasItemId) {
      available.push({ key: 'drop', label: 'Drop', enabled: true });
    }

    const defaultKey = getInventoryDefaultAction(it);
    const order = {
      equip: 1,
      use: 2,
      apply: 3,
      'set-spell': 4,
      throw: 5,
      drop: 6,
    };
    available.sort((a, b) => {
      const ar = a.key === defaultKey ? 0 : (order[a.key] || 90);
      const br = b.key === defaultKey ? 0 : (order[b.key] || 90);
      return ar - br;
    });
    const defaultIndex = available.findIndex((entry) => entry.key === defaultKey && entry.enabled !== false);
    const firstEnabledIndex = available.findIndex((entry) => entry.enabled !== false);
    const primaryIndex = defaultIndex >= 0 ? defaultIndex : firstEnabledIndex;
    available.forEach((entry, i) => {
      actions.appendChild(createActionButton(entry.label, () => {
        dispatchInventoryAction(it, entry.key);
      }, {
        primary: i === primaryIndex,
        disabled: entry.enabled === false,
        disabledReason: entry.disabledReason,
      }));
    });

    const groundAction = resolveGroundPickupAction();
    if (groundAction) {
      actions.appendChild(createActionButton(groundAction.label, groundAction.run));
    }
  }

  /**
   * @param {any} it
   * @param {"apply"|"equip"|"use"|"set-spell"|"throw"|"drop"} actionKey
   */
  function dispatchInventoryAction(it, actionKey) {
    if (!it) return;
    if (actionKey === 'apply') {
      if (it?.canApply && Number(it?.applyTargetCount || 0) > 0) {
        triggerApplyForTool(it);
      }
      return;
    }
    if (actionKey === 'equip') {
      if (isInventoryItemEquippable(it) && Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
      }
      return;
    }
    if (actionKey === 'use') {
      if (!isInventoryItemUsable(it) || !Number.isInteger(it.id) || it.id <= 0) return;
      if (it.type === 'potion') {
        window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
      }
      return;
    }
    if (actionKey === 'set-spell') {
      const spellId = String(it.id || '').replace(/^spell:/, '');
      if (spellId) {
        window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', { detail: { spellId } }));
      }
      return;
    }
    if (actionKey === 'throw') {
      if (Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestThrow', { detail: { itemId: it.id } }));
        hide(panel);
      }
      return;
    }
    if (actionKey === 'drop') {
      if (Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestDrop', { detail: { itemId: it.id } }));
      }
    }
  }

  function resolveGroundPickupAction() {
    if (!ground || typeof ground !== 'object') return null;
    const mode = String(ground.mode || '');
    if (mode === 'single') {
      const itemId = Number(ground?.item?.id || 0);
      if (!Number.isInteger(itemId) || itemId <= 0) return null;
      return {
        label: 'Pickup',
        run: () => {
          window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: [itemId] } }));
        },
      };
    }
    const items = Array.isArray(ground.items) ? ground.items.filter((it) => Number.isInteger(it?.id) && it.id > 0) : [];
    if (!items.length) return null;
    const fromChest = ground.fromChest === true;
    return {
      label: fromChest ? 'Open Chest' : `Pickup (${items.length})`,
      run: () => {
        window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
      },
    };
  }

  /** @param {number} i @param {{ensureVisible?:boolean}} [opts] */
  function setSel(i, opts) {
    sel = Math.max(0, Math.min(items.length - 1, i|0));
    (/** @type {any} */ (panel))._inventorySelectionKey = String(items[sel]?.id ?? '');
    (/** @type {any} */ (panel))._inventorySelectionIndex = sel;
    rows.forEach((r, j) => {
      const baseBg = items[j]?.unpaid ? 'rgba(65, 35, 10, 0.75)' : '#0f1421';
      const activeBg = items[j]?.unpaid ? 'rgba(85, 45, 14, 0.9)' : '#0b1323';
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? activeBg : baseBg;
    });
    if (opts?.ensureVisible !== false) {
      rows[sel]?.scrollIntoView({ block: 'nearest' });
    }
    updateHint();
  }

  function defaultAction() {
    const it = items[sel]; if (!it) return;
    const action = getInventoryDefaultAction(it);
    if (action === 'none') return;
    dispatchInventoryAction(it, action);
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(items.length - 1); e.preventDefault(); }
    else if (k === 'Enter' || e.code === 'NumpadEnter') { defaultAction(); e.preventDefault(); }
    else if (k === 'a' || k === 'A') { const it = items[sel]; if (it?.canApply && Number(it?.applyTargetCount || 0) > 0) { triggerApplyForTool(it); e.preventDefault(); } }
    else if (k === ',' || e.code === 'Comma') { const it = items[sel]; if (it && Number.isInteger(it.id) && it.id > 0) { window.dispatchEvent(new CustomEvent('ui:requestDrop', { detail: { itemId: it.id } })); e.preventDefault(); } }
    else if (k === 'e' || k === 'E') { const it = items[sel]; if (isInventoryItemEquippable(it)) { window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } })); e.preventDefault(); } }
    else if (k === 'd' || k === 'D') { const it = items[sel]; if (it?.type === 'potion') { window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } })); e.preventDefault(); } }
    else if (k === 'u' || k === 'U') {
      const it = items[sel];
      if (isInventoryItemUsable(it)) {
        if (it.type === 'potion') {
          window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
        } else {
          window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
        }
        e.preventDefault();
      }
    }
    else if (k === 't' || k === 'T') { const it = items[sel]; if (it && Number.isInteger(it.id) && it.id > 0) { window.dispatchEvent(new CustomEvent('ui:requestThrow', { detail: { itemId: it.id } })); hide(panel); e.preventDefault(); } }
    else if (k === 's' || k === 'S') { const it = items[sel]; if (it?.type === 'spell') { const spellId = String(it.id || '').replace(/^spell:/, ''); if (spellId) { window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', { detail: { spellId } })); e.preventDefault(); } } }
    else if (k === 'p' || k === 'P') {
      const groundAction = resolveGroundPickupAction();
      if (groundAction) {
        groundAction.run();
        e.preventDefault();
      }
    }
  }

  // Activate keyboard navigation while panel is open
  let initialSel = 0;
  if (savedSelectionKey) {
    const found = items.findIndex((it) => String(it?.id ?? '') === savedSelectionKey);
    if (found >= 0) initialSel = found;
    else if (Number.isFinite(savedSelectionIndex)) initialSel = Math.max(0, Math.min(items.length - 1, savedSelectionIndex | 0));
  } else if (Number.isFinite(savedSelectionIndex)) {
    initialSel = Math.max(0, Math.min(items.length - 1, savedSelectionIndex | 0));
  }
  setSel(initialSel, { ensureVisible: false });
  /** @param {KeyboardEvent} e */
  /** @param {KeyboardEvent} e */
  const keyHandler = (e) => onKey(e);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      detach();
    }
  });

  const detach = () => {
    window.removeEventListener('keydown', keyHandler);
    obs.disconnect();
    if ((/** @type {any} */ (panel))._inventoryDetach === detach) {
      (/** @type {any} */ (panel))._inventoryDetach = null;
    }
  };

  window.addEventListener('keydown', keyHandler);
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  (/** @type {any} */ (panel))._inventoryDetach = detach;
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<{id:string,name:string,cost?:number}>} spells @param {string|null} activeId */
function renderSpellPicker(panel, spells, activeId) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Select Active Spell';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!spells.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no learned spells)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '6px';
  el.appendChild(list);

  for (const sp of spells) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 8px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: sp.id === activeId ? '#0b1323' : '#0f1421', cursor: 'pointer'
    });
    const name = document.createElement('span');
    name.textContent = sp.name ? `[${sp.name}]` : `[${sp.id}]`;
    const cost = document.createElement('span');
    cost.style.marginLeft = 'auto'; cost.style.opacity = '0.8'; cost.textContent = sp.cost ? `Mana ${sp.cost}` : '';
    row.appendChild(name); row.appendChild(cost);
    row.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', { detail: { spellId: sp.id } }));
      hide(panel);
    });
    list.appendChild(row);
  }

  const btn = document.createElement('button');
  btn.textContent = 'Close';
  decorateButton(btn);
  btn.style.marginTop = '10px';
  btn.addEventListener('click', () => hide(panel));
  el.appendChild(btn);
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} entries */
function renderMessageLog(panel, entries) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Message Log';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);
  const box = document.createElement('div');
  Object.assign(box.style, {
    display: 'flex', flexDirection: 'column', gap: '4px'
  });
  for (const m of entries) {
    const row = document.createElement('div');
    // Handle both plain strings (legacy) and message objects with types
    if (typeof m === 'string') {
      row.textContent = m;
    } else if (m && typeof m === 'object') {
      row.textContent = m.text || String(m);
      row.style.color = getMessageColor(m.type);
    } else {
      row.textContent = String(m);
    }
    box.appendChild(row);
  }
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no messages yet)';
    box.appendChild(empty);
  }
  el.appendChild(box);
}

/** @param {string} s */
function sanitize(s) {
  return (s ?? '').toString().replace(/[<>]/g, '');
}

/** @param {string} s */
function bracketize(s) {
  const str = String(s ?? '');
  if (!str.length) return str;
  // Avoid double-bracketing if already bracketed
  if (str.startsWith('[') && str.endsWith(']')) return str;
  return `[${str}]`;
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items */
function renderPickupChooser(panel, items) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Pick up what?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(nothing here)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';

  const selections = new Set();
  let sel = 0;

  const checkboxes = [];
  const rows = items.map((it, idx) => {
    const row = document.createElement('label');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 8px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421'
    });
    row.tabIndex = 0;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) selections.add(it.id); else selections.delete(it.id);
    });
    checkboxes.push(cb);
  const name = document.createElement('span');
    const rn = String(it.rarityName || 'common').toLowerCase();
    name.style.color = (rn === 'rare' || rn === 'magic') ? '#55aaff' : rn === 'epic' ? '#c47bff' : rn === 'legendary' ? '#ff9f3b' : '#ffffff';
    name.style.fontWeight = 'bold';
  name.textContent = bracketize(sanitize(it.name || it.type || 'item'));
    const desc = document.createElement('span');
    desc.style.opacity = '0.85';
    desc.textContent = `x${it.count ?? 1}`;

    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(desc);
    row.addEventListener('mouseenter', () => { setSel(idx); });
    list.appendChild(row);
    return row;
  });

  el.appendChild(list);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85';
  hint.textContent = '↑/↓ select · Space=Toggle · Enter=Take All · Esc=Close';
  el.appendChild(hint);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '10px';

  function takeSelected() {
    const ids = Array.from(selections);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  }

  function takeAll() {
    const ids = items.map((i) => i.id);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  }

  const btnPickSel = document.createElement('button');
  btnPickSel.textContent = 'Take Selected';
  decorateButton(btnPickSel);
  btnPickSel.addEventListener('click', takeSelected);

  const btnPickAll = document.createElement('button');
  btnPickAll.textContent = 'Take All';
  decorateButton(btnPickAll);
  btnPickAll.addEventListener('click', takeAll);

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  decorateButton(btnCancel);
  btnCancel.addEventListener('click', () => hide(panel));

  actions.appendChild(btnPickAll);
  actions.appendChild(btnPickSel);
  actions.appendChild(btnCancel);
  el.appendChild(actions);

  /** @param {number} i */
  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i|0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(items.length - 1); e.preventDefault(); }
    else if (k === ' ') { checkboxes[sel].checked = !checkboxes[sel].checked; checkboxes[sel].dispatchEvent(new Event('change')); e.preventDefault(); }
    else if (k === 'Enter') { selections.size ? takeSelected() : takeAll(); e.preventDefault(); }
  }

  setSel(0);
  const keyHandler = (/** @type {KeyboardEvent} */ e) => onKey(e);
  window.addEventListener('keydown', keyHandler);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', keyHandler);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items */
function renderUseChooser(panel, items) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Use which item?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no usable items)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  el.appendChild(list);

  let sel = 0;

  const rows = items.map((it, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', padding: '6px 8px',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer'
    });

    const name = document.createElement('span');
    const rn = String(it.rarityName || 'common').toLowerCase();
    const rs = rarityStyle(rn);
    name.textContent = bracketize(sanitize(it.name || it.description || it.type));
    Object.assign(name.style, rs);

    const typeLabel = document.createElement('span');
    typeLabel.style.opacity = '0.6';
    typeLabel.style.fontSize = '12px';
    typeLabel.textContent = it.type || '';

    const qty = document.createElement('span');
    qty.style.marginLeft = 'auto'; qty.style.opacity = '0.8';
    qty.textContent = it.count > 1 ? `x${it.count}` : '';

    row.appendChild(name);
    row.appendChild(typeLabel);
    row.appendChild(qty);

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', () => useSelected());
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Use \u00b7 T=Throw \u00b7 Esc=Close';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }

  function useSelected() {
    const it = items[sel]; if (!it) return;
    if (it.type === 'potion') {
      window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    } else {
      window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
    }
    hide(panel);
  }

  setSel(0);

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Enter') { useSelected(); e.preventDefault(); }
    else if (k === 't' || k === 'T') {
      const it = items[sel];
      if (it && Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestThrow', { detail: { itemId: it.id } }));
        hide(panel);
        e.preventDefault();
      }
    }
  }

  window.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items */
function renderThrowChooser(panel, items) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Throw which item?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(nothing to throw)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  el.appendChild(list);

  let sel = 0;

  const rows = items.map((it, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', padding: '6px 8px',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer'
    });

    const name = document.createElement('span');
    const rn = String(it.rarityName || 'common').toLowerCase();
    const rs = rarityStyle(rn);
    name.textContent = bracketize(sanitize(it.name || it.description || it.type));
    Object.assign(name.style, rs);

    const typeLabel = document.createElement('span');
    typeLabel.style.opacity = '0.6';
    typeLabel.style.fontSize = '12px';
    typeLabel.textContent = it.type || '';

    const qty = document.createElement('span');
    qty.style.marginLeft = 'auto'; qty.style.opacity = '0.8';
    qty.textContent = it.count > 1 ? `x${it.count}` : '';

    row.appendChild(name);
    row.appendChild(typeLabel);
    row.appendChild(qty);

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', () => throwSelected());
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Select item \u00b7 then tap target \u00b7 Esc=Close';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }

  function throwSelected() {
    const it = items[sel]; if (!it) return;
    window.dispatchEvent(new CustomEvent('ui:requestThrow', { detail: { itemId: it.id } }));
    hide(panel);
  }

  setSel(0);

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Enter') { throwSelected(); e.preventDefault(); }
  }

  window.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} tools @param {(toolId:number)=>void} onSelect */
function renderApplyToolChooser(panel, tools, onSelect) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Apply which tool?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!tools.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no applicable tools)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  el.appendChild(list);

  let sel = 0;
  const rows = tools.map((it, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', padding: '6px 8px',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer'
    });
    const name = document.createElement('span');
    name.textContent = bracketize(sanitize(it.name || 'tool'));
    row.appendChild(name);
    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pickTool();
    });
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Apply \u00b7 Esc=Close';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(tools.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }
  function pickTool() {
    const it = tools[sel]; if (!it) return;
    onSelect(it.id);
  }
  setSel(0);

  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Enter') { pickTool(); e.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} targets @param {number} toolId @param {(targetId:number)=>void} onSelect */
function renderApplyTargetChooser(panel, targets, toolId, onSelect) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Apply to which item?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!targets.length) {
    const empty = document.createElement('div');
    empty.textContent = '(no valid targets)';
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  el.appendChild(list);

  let sel = 0;
  const rows = targets.map((it, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      width: '100%', padding: '6px 8px',
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer'
    });
    const name = document.createElement('span');
    name.textContent = bracketize(sanitize(it.name || 'item'));
    row.appendChild(name);

    if (it.description) {
      const desc = document.createElement('span');
      desc.style.opacity = '0.6';
      desc.style.fontSize = '12px';
      desc.textContent = it.description;
      row.appendChild(desc);
    }

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      pickTarget();
    });
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Apply \u00b7 Esc=Close';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(targets.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }
  function pickTarget() {
    const it = targets[sel]; if (!it) return;
    onSelect(it.id);
  }
  setSel(0);

  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Enter') { pickTarget(); e.preventDefault(); }
  }
  window.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{shopkeeperId:number, buyMarkup:number, sellDiscount:number, mode:string}} state */
function renderShop(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const mode = data?.mode || state?.mode || 'browse';
  const shopItems = data?.shopItems || [];
  const playerItems = data?.playerItems || [];
  const unpaidItems = data?.unpaidItems || [];
  const totalBill = data?.totalBill || 0;
  const gold = data?.gold || 0;

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = mode === 'checkout' ? 'Shopkeeper Invoice' : 'Shopkeeper';
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  const goldLabel = document.createElement('div');
  goldLabel.textContent = `Gold: ${gold}`;
  goldLabel.style.marginLeft = 'auto'; goldLabel.style.color = '#ffde5a'; goldLabel.style.fontWeight = 'bold';
  header.appendChild(title); header.appendChild(goldLabel);
  el.appendChild(header);

  if (mode === 'checkout') {
    const billLine = document.createElement('div');
    billLine.textContent = `Amount Due: ${totalBill}g`;
    billLine.style.marginBottom = '10px';
    billLine.style.color = '#ffde5a';
    billLine.style.fontWeight = 'bold';
    el.appendChild(billLine);

    const listContainer = document.createElement('div');
    listContainer.style.maxHeight = '45vh';
    listContainer.style.overflow = 'auto';
    el.appendChild(listContainer);

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' });
    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay Bill';
    decorateButton(payBtn);
    payBtn.style.fontWeight = 'bold';
    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Return Item';
    decorateButton(returnBtn);
    actions.appendChild(payBtn);
    actions.appendChild(returnBtn);
    el.appendChild(actions);

    const hint = document.createElement('div');
    hint.style.marginTop = '8px';
    hint.style.opacity = '0.85';
    hint.style.fontSize = '12px';
    el.appendChild(hint);

    let sel = 0;
    const rows = [];
    if (!unpaidItems.length) {
      const empty = document.createElement('div');
      empty.textContent = '(invoice is empty)';
      listContainer.appendChild(empty);
      returnBtn.disabled = true;
      hint.textContent = 'P=Pay bill · Esc=Close';
    } else {
      unpaidItems.forEach((it, idx) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', padding: '6px 8px',
          background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
          cursor: 'pointer', marginBottom: '4px',
        });

        const name = document.createElement('span');
        name.textContent = bracketize(sanitize(it.name || 'item'));
        const rn = String(it.rarityName || 'common').toLowerCase();
        Object.assign(name.style, rarityStyle(rn));

        const price = document.createElement('span');
        price.style.marginLeft = 'auto';
        price.style.color = '#ffde5a';
        price.style.fontWeight = 'bold';
        price.textContent = `${it.price || 0}g`;

        row.appendChild(name);
        if (it.count > 1) {
          const qty = document.createElement('span');
          qty.style.opacity = '0.7';
          qty.textContent = `x${it.count}`;
          row.appendChild(qty);
        }
        row.appendChild(price);
        row.addEventListener('mouseenter', () => setSel(idx));
        row.addEventListener('click', () => returnSelected());
        listContainer.appendChild(row);
        rows.push(row);
      });
      hint.textContent = '↑/↓ select · Enter=Return item · P=Pay bill · Esc=Close';
      setSel(0);
    }

    function setSel(i) {
      sel = Math.max(0, Math.min(unpaidItems.length - 1, i | 0));
      rows.forEach((r, j) => {
        r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
        r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
      });
    }

    function payBill() {
      window.dispatchEvent(new CustomEvent('ui:payBill', {
        detail: { shopkeeperId: state.shopkeeperId }
      }));
    }

    function returnSelected() {
      const it = unpaidItems[sel];
      if (!it) return;
      window.dispatchEvent(new CustomEvent('ui:removeFromInvoice', {
        detail: { shopkeeperId: state.shopkeeperId, itemId: it.id }
      }));
    }

    payBtn.addEventListener('click', payBill);
    returnBtn.addEventListener('click', returnSelected);

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
      else if (k === 'Enter') { returnSelected(); e.preventDefault(); }
      else if (k === 'p' || k === 'P') { payBill(); e.preventDefault(); }
    }

    window.addEventListener('keydown', onKey);
    const obs = new MutationObserver(() => {
      if (panel.style.display === 'none') {
        window.removeEventListener('keydown', onKey);
        obs.disconnect();
      }
    });
    obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
    return;
  }

  // Tabs
  let activeTab = 'buy';
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '4px', marginBottom: '10px' });

  const buyTab = document.createElement('button');
  buyTab.textContent = 'Buy';
  decorateButton(buyTab);

  const sellTab = document.createElement('button');
  sellTab.textContent = 'Sell';
  decorateButton(sellTab);

  tabBar.appendChild(buyTab); tabBar.appendChild(sellTab);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  let sel = 0;
  let currentItems = [];

  function updateTabStyle() {
    buyTab.style.background = activeTab === 'buy' ? '#1a2640' : '#101626';
    buyTab.style.borderColor = activeTab === 'buy' ? '#55aaff' : '#2d3b52';
    sellTab.style.background = activeTab === 'sell' ? '#1a2640' : '#101626';
    sellTab.style.borderColor = activeTab === 'sell' ? '#55aaff' : '#2d3b52';
  }

  function renderList() {
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'buy' ? shopItems : playerItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'buy' ? '(nothing for sale)' : '(nothing to sell)';
      listContainer.appendChild(empty);
      hint.textContent = 'Tab=Switch · Esc=Close';
      return;
    }

    const rows = currentItems.map((it, idx) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '6px 8px',
        background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
        cursor: 'pointer', marginBottom: '4px',
      });

      const name = document.createElement('span');
      const rn = String(it.rarityName || 'common').toLowerCase();
      const rs = rarityStyle(rn);
      name.textContent = bracketize(sanitize(it.name || 'item'));
      Object.assign(name.style, rs);

      const price = document.createElement('span');
      price.style.marginLeft = 'auto';
      price.style.color = '#ffde5a';
      price.style.fontWeight = 'bold';
      const cost = activeTab === 'buy' ? (it.buyPrice || 0) : (it.sellPrice || 0);
      price.textContent = `${cost}g`;

      row.appendChild(name);
      if (it.count > 1) {
        const qty = document.createElement('span');
        qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
        row.appendChild(qty);
      }
      row.appendChild(price);

      row.addEventListener('mouseenter', () => setSel(idx));
      row.addEventListener('click', () => doTransaction());
      listContainer.appendChild(row);
      return row;
    });

    function setSel(i) {
      sel = Math.max(0, Math.min(currentItems.length - 1, i | 0));
      rows.forEach((r, j) => {
        r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
        r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
      });
    }

    setSel(0);
    hint.textContent = activeTab === 'buy'
      ? '↑/↓ select · Enter=Buy · Tab=Sell tab · Esc=Close'
      : '↑/↓ select · Enter=Sell · Tab=Buy tab · Esc=Close';

    function doTransaction() {
      const it = currentItems[sel]; if (!it) return;
      if (activeTab === 'buy') {
        window.dispatchEvent(new CustomEvent('ui:requestBuy', {
          detail: { shopkeeperId: state.shopkeeperId, itemId: it.id }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestSell', {
          detail: { shopkeeperId: state.shopkeeperId, itemId: it.id }
        }));
      }
    }

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'Tab') {
        e.preventDefault();
        activeTab = activeTab === 'buy' ? 'sell' : 'buy';
        updateTabStyle();
        renderList();
      }
    }

    window.addEventListener('keydown', onKey);
    const obs = new MutationObserver(() => {
      if (panel.style.display === 'none') {
        window.removeEventListener('keydown', onKey);
        obs.disconnect();
      }
    });
    obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  }

  buyTab.addEventListener('click', () => { activeTab = 'buy'; updateTabStyle(); renderList(); });
  sellTab.addEventListener('click', () => { activeTab = 'sell'; updateTabStyle(); renderList(); });

  updateTabStyle();
  renderList();
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{chestId:number}} state */
function renderChest(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const chestItems = data?.chestItems || [];
  const playerItems = data?.playerItems || [];

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = 'Chest';
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  header.appendChild(title);
  el.appendChild(header);

  // Tabs
  let activeTab = 'take';
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '4px', marginBottom: '10px' });

  const takeTab = document.createElement('button');
  takeTab.textContent = 'Take';
  decorateButton(takeTab);

  const putTab = document.createElement('button');
  putTab.textContent = 'Put';
  decorateButton(putTab);

  tabBar.appendChild(takeTab); tabBar.appendChild(putTab);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  let sel = 0;
  let currentItems = [];

  function updateTabStyle() {
    takeTab.style.background = activeTab === 'take' ? '#1a2640' : '#101626';
    takeTab.style.borderColor = activeTab === 'take' ? '#55aaff' : '#2d3b52';
    putTab.style.background = activeTab === 'put' ? '#1a2640' : '#101626';
    putTab.style.borderColor = activeTab === 'put' ? '#55aaff' : '#2d3b52';
  }

  function renderList() {
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'take' ? chestItems : playerItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'take' ? '(chest is empty)' : '(nothing to store)';
      listContainer.appendChild(empty);
      hint.textContent = 'Tab=Switch \u00b7 Esc=Close';
      return;
    }

    const rows = currentItems.map((it, idx) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '100%', padding: '6px 8px',
        background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px',
        cursor: 'pointer', marginBottom: '4px',
      });

      const name = document.createElement('span');
      const rn = String(it.rarityName || 'common').toLowerCase();
      const rs = rarityStyle(rn);
      name.textContent = bracketize(sanitize(it.name || 'item'));
      Object.assign(name.style, rs);

      row.appendChild(name);
      if (it.count > 1) {
        const qty = document.createElement('span');
        qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
        row.appendChild(qty);
      }

      row.addEventListener('mouseenter', () => setSel(idx));
      row.addEventListener('click', () => doTransaction());
      listContainer.appendChild(row);
      return row;
    });

    function setSel(i) {
      sel = Math.max(0, Math.min(currentItems.length - 1, i | 0));
      rows.forEach((r, j) => {
        r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
        r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
      });
    }

    setSel(0);
    hint.textContent = activeTab === 'take'
      ? '\u2191/\u2193 select \u00b7 Enter=Take \u00b7 Tab=Put tab \u00b7 Esc=Close'
      : '\u2191/\u2193 select \u00b7 Enter=Put \u00b7 Tab=Take tab \u00b7 Esc=Close';

    function doTransaction() {
      const it = currentItems[sel]; if (!it) return;
      const chestId = Number(state.chestId || 0) | 0;
      const itemId = Number(it.id || 0) | 0;
      if (!(chestId > 0) || !(itemId > 0)) return;
      if (activeTab === 'take') {
        window.dispatchEvent(new CustomEvent('ui:requestChestTake', {
          detail: { chestId, itemId }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestChestPut', {
          detail: { chestId, itemId }
        }));
      }
    }

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'Tab') {
        e.preventDefault();
        activeTab = activeTab === 'take' ? 'put' : 'take';
        updateTabStyle();
        renderList();
      }
    }

    window.addEventListener('keydown', onKey);
    const obs = new MutationObserver(() => {
      if (panel.style.display === 'none') {
        window.removeEventListener('keydown', onKey);
        obs.disconnect();
      }
    });
    obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  }

  takeTab.addEventListener('click', () => { activeTab = 'take'; updateTabStyle(); renderList(); });
  putTab.addEventListener('click', () => { activeTab = 'put'; updateTabStyle(); renderList(); });

  updateTabStyle();
  renderList();
}

/** @param {HTMLButtonElement} btn */
function decorateButton(btn) {
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
}

// --- Always-on message ticker ---------------------------------------------
/** @param {HTMLElement} root */
function ensureMessageTicker(root) {
  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed',
    left: 'calc(8px + env(safe-area-inset-left, 0px))',
    top: 'calc(8px + env(safe-area-inset-top, 0px))',
    width: 'min(58vw, 560px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    pointerEvents: 'auto',
    zIndex: 850,
    color: '#cfe8ff',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.25',
    background: 'rgba(10, 14, 22, 0.72)',
    borderRadius: '8px',
    padding: '7px 9px',
    border: '1px solid rgba(45,59,82,0.56)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'width 140ms ease-out, max-height 140ms ease-out, background 140ms ease-out, border-color 140ms ease-out, box-shadow 140ms ease-out',
  });
  (/** @type {any} */ (box))._entries = [];
  (/** @type {any} */ (box))._expanded = false;
  box.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const next = !(/** @type {any} */ (box))._expanded;
    (/** @type {any} */ (box))._expanded = next;
    renderMessageTicker(box, (/** @type {any} */ (box))._entries || []);
  });
  root.appendChild(box);
  return box;
}

/** @param {HTMLElement} container @param {Array<any>} entries */
function renderMessageTicker(container, entries) {
  if (!container) return;
  const store = /** @type {any} */ (container);
  const allEntries = Array.isArray(entries) ? entries.slice() : [];
  store._entries = allEntries;
  const expanded = !!store._expanded;
  if (expanded) {
    Object.assign(container.style, {
      width: 'min(86vw, 760px)',
      maxHeight: 'min(50vh, 430px)',
      gap: '6px',
      fontSize: '13px',
      lineHeight: '1.3',
      padding: '10px 12px',
      background: 'rgba(8,12,18,0.92)',
      border: '1px solid rgba(80,120,170,0.82)',
      boxShadow: '0 12px 34px rgba(0,0,0,0.52)',
      cursor: 'pointer',
    });
  } else {
    Object.assign(container.style, {
      width: 'min(58vw, 560px)',
      maxHeight: '',
      gap: '3px',
      fontSize: '12px',
      lineHeight: '1.25',
      padding: '7px 9px',
      background: 'rgba(10, 14, 22, 0.72)',
      border: '1px solid rgba(45,59,82,0.56)',
      boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
      cursor: 'pointer',
    });
  }

  container.innerHTML = '';
  if (!allEntries.length) return;

  if (expanded) {
    const header = document.createElement('div');
    header.textContent = 'Message Log';
    Object.assign(header.style, {
      fontWeight: '700',
      letterSpacing: '0.02em',
      color: '#cfe8ff',
      textShadow: '0 1px 0 rgba(0,0,0,0.45)',
    });
    container.appendChild(header);

    const sub = document.createElement('div');
    sub.textContent = 'Tap/click to collapse';
    Object.assign(sub.style, {
      fontSize: '11px',
      opacity: '0.72',
      marginTop: '-2px',
      marginBottom: '2px',
    });
    container.appendChild(sub);

    const list = document.createElement('div');
    Object.assign(list.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      overflowY: 'auto',
      maxHeight: 'min(40vh, 320px)',
      paddingRight: '2px',
    });

    const expandedEntries = allEntries.slice().reverse();

    if (!expandedEntries.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No messages yet.';
      Object.assign(empty.style, { opacity: '0.78', fontStyle: 'italic' });
      list.appendChild(empty);
    } else {
      for (let i = 0; i < expandedEntries.length; i++) {
        const m = expandedEntries[i];
        const row = document.createElement('div');
        if (typeof m === 'string') {
          row.textContent = m;
          row.style.color = getMessageColor('default');
        } else if (m && typeof m === 'object') {
          row.textContent = String(m.text || '');
          row.style.color = getMessageColor(String(m.type || 'default'));
        } else {
          row.textContent = String(m ?? '');
          row.style.color = getMessageColor('default');
        }
        row.style.opacity = i === 0 ? '1' : '0.9';
        row.style.textShadow = '0 1px 0 rgba(0,0,0,0.42)';
        row.style.whiteSpace = 'nowrap';
        row.style.overflow = 'hidden';
        row.style.textOverflow = 'ellipsis';
        list.appendChild(row);
      }
    }
    container.appendChild(list);
    return;
  }

  // Collapsed mode: newest 3 messages with recency opacity hierarchy.
  const recent = allEntries.slice(-3).reverse();
  if (!recent.length) return;

  const tierStyles = [
    { opacity: 1.0, textShadow: '0 1px 0 rgba(0,0,0,0.45), 0 0 6px rgba(0,0,0,0.25)' },
    { opacity: 0.62, textShadow: '0 1px 0 rgba(0,0,0,0.38), 0 0 4px rgba(0,0,0,0.2)' },
    { opacity: 0.38, textShadow: '0 1px 0 rgba(0,0,0,0.32), 0 0 3px rgba(0,0,0,0.16)' },
  ];

  for (let i = 0; i < recent.length; i++) {
    const m = recent[i];
    const row = document.createElement('div');
    const tier = tierStyles[Math.min(i, tierStyles.length - 1)];
    // Handle both plain strings (legacy) and message objects with types
    if (typeof m === 'string') {
      row.textContent = m;
    } else if (m && typeof m === 'object') {
      row.textContent = m.text || String(m);
      row.style.color = getMessageColor(m.type);
    } else {
      row.textContent = String(m ?? '');
    }
    row.style.textShadow = tier.textShadow;
    row.style.opacity = String(tier.opacity);
    row.style.filter = '';
    row.style.whiteSpace = 'nowrap';
    row.style.overflow = 'hidden';
    row.style.textOverflow = 'ellipsis';
    row.style.transformOrigin = 'left center';
    row.style.transform = i === 0 ? 'scale(1)' : (i === 1 ? 'scale(0.995)' : 'scale(0.99)');
    container.appendChild(row);
  }
}

/**
 * Get color for message type
 * @param {string} type - Message type
 * @returns {string} Hex color code
 */
function getMessageColor(type) {
  switch (type) {
    case 'combat': return '#ff6b6b';    // Red - attacks, damage, death
    case 'deity': return '#c47bff';     // Purple - deity events, prayers, miracles
    case 'ambient': return '#77dd77';   // Soft green - environmental sounds, atmosphere
    case 'system': return '#ffd966';    // Yellow - items, doors, level ups
    case 'default':
    default: return '#cfe8ff';          // Default blue-white
  }
}

// Shared style helper for rarity
/** @param {string} rarityName */
function rarityStyle(rarityName) {
  const rn = String(rarityName || 'common').toLowerCase();
  if (rn === 'rare' || rn === 'magic') return { color: '#55aaff', fontWeight: 'bold' };
  if (rn === 'epic') return { color: '#c47bff', fontWeight: 'bold' };
  if (rn === 'legendary') return { color: '#ff9f3b', fontWeight: 'bold' };
  return { color: '#ffffff', fontWeight: 'bold' };
}

// --- Book reader overlay (decorative dungeon books) ------------------------
/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {string} title
 * @param {string} text
 */
function renderBookReader(panel, title, text) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' });
  const icon = document.createElement('span');
  icon.textContent = '\uD83D\uDCD6'; // 📖
  icon.style.fontSize = '22px';
  const heading = document.createElement('span');
  heading.textContent = title;
  Object.assign(heading.style, { fontWeight: 'bold', fontSize: '16px', color: '#c8a882' });
  header.appendChild(icon);
  header.appendChild(heading);
  el.appendChild(header);

  // Body text
  const body = document.createElement('div');
  Object.assign(body.style, {
    padding: '14px 16px',
    border: '1px solid #2d3b52', borderRadius: '6px',
    background: '#0f1421',
    lineHeight: '1.6', fontSize: '14px', color: '#cfe8ff',
    whiteSpace: 'pre-wrap',
  });
  body.textContent = text;
  el.appendChild(body);

  // Hint
  const hint = document.createElement('div');
  Object.assign(hint.style, { marginTop: '12px', opacity: '0.6', fontSize: '11px', textAlign: 'center' });
  hint.textContent = 'Esc=Close';
  el.appendChild(hint);
}

// --- Death log overlay (past deaths from localStorage) ---------------------
/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} records */
function renderDeathLog(panel, records) {
  const existingDetach = /** @type {any} */ (panel)._deathLogDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] deathLog detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' });
  const skull = document.createElement('span');
  skull.textContent = '\u2620';
  skull.style.fontSize = '22px';
  const title = document.createElement('span');
  title.textContent = 'Book of the Dead';
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '16px', color: '#ff9999' });
  const countBadge = document.createElement('span');
  countBadge.textContent = `${records.length} death${records.length !== 1 ? 's' : ''}`;
  Object.assign(countBadge.style, { marginLeft: 'auto', opacity: '0.7', fontSize: '12px' });
  header.appendChild(skull);
  header.appendChild(title);
  header.appendChild(countBadge);
  el.appendChild(header);

  if (!records.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No deaths recorded yet. Stay alive out there.';
    Object.assign(empty.style, { opacity: '0.6', padding: '20px 0', textAlign: 'center' });
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
  el.appendChild(list);

  let sel = 0;

  const rows = records.map((rec, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '8px 10px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421', cursor: 'default',
    });

    // Top line: name, cause, depth
    const top = document.createElement('div');
    Object.assign(top.style, { display: 'flex', alignItems: 'center', gap: '8px' });

    const name = document.createElement('span');
    name.textContent = rec.playerName || 'Hero';
    Object.assign(name.style, { fontWeight: 'bold', color: '#ff9999' });

    const sep = document.createElement('span');
    sep.textContent = '\u2014';
    sep.style.opacity = '0.4';

    const cause = document.createElement('span');
    if (rec.cause === 'combat' && rec.killerName) {
      cause.textContent = `Slain by ${rec.killerName}`;
      cause.style.color = '#ff6b6b';
    } else if (rec.cause === 'starvation') {
      cause.textContent = 'Starved';
      cause.style.color = '#ffcc66';
    } else if (rec.cause === 'trap') {
      cause.textContent = 'Trap';
      cause.style.color = '#ff8844';
    } else if (rec.cause === 'spell') {
      cause.textContent = 'Magic';
      cause.style.color = '#c47bff';
    } else {
      cause.textContent = rec.cause || 'unknown';
      cause.style.color = '#aabbcc';
    }

    const depthLabel = document.createElement('span');
    depthLabel.textContent = `Depth ${rec.depth || '?'}`;
    Object.assign(depthLabel.style, { marginLeft: 'auto', color: '#88aacc', fontSize: '12px' });

    top.appendChild(name);
    top.appendChild(sep);
    top.appendChild(cause);
    top.appendChild(depthLabel);
    row.appendChild(top);

    // Bottom line: turn + timestamp
    const bottom = document.createElement('div');
    Object.assign(bottom.style, { display: 'flex', gap: '12px', fontSize: '11px', opacity: '0.55' });

    if (rec.turn) {
      const turnLabel = document.createElement('span');
      turnLabel.textContent = `Turn ${rec.turn}`;
      bottom.appendChild(turnLabel);
    }
    if (rec.timestamp) {
      const dateLabel = document.createElement('span');
      dateLabel.style.marginLeft = 'auto';
      try {
        dateLabel.textContent = new Date(rec.timestamp).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch {
        dateLabel.textContent = String(rec.timestamp);
      }
      bottom.appendChild(dateLabel);
    }
    row.appendChild(bottom);

    row.addEventListener('mouseenter', () => setSel(idx));
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  Object.assign(hint.style, { marginTop: '10px', opacity: '0.6', fontSize: '11px', textAlign: 'center' });
  hint.textContent = '\u2191/\u2193 scroll \u00b7 Esc=Close \u00b7 # to toggle';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(records.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '1px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
    // Scroll selected row into view
    rows[sel]?.scrollIntoView?.({ block: 'nearest' });
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(records.length - 1); e.preventDefault(); }
  }

  setSel(0);
  const keyHandler = (/** @type {KeyboardEvent} */ e) => onKey(e);

  const detach = () => {
    window.removeEventListener('keydown', keyHandler);
    obs.disconnect();
    if ((/** @type {any} */ (panel))._deathLogDetach === detach) {
      (/** @type {any} */ (panel))._deathLogDetach = null;
    }
  };

  window.addEventListener('keydown', keyHandler);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') detach();
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  (/** @type {any} */ (panel))._deathLogDetach = detach;
}

// --- Death screen with social share ----------------------------------------
/** @param {HTMLElement} root */
function ensureDeathScreen(root) {
  const panel = document.createElement('div');
  panel.id = 'death-screen';
  Object.assign(panel.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'none', pointerEvents: 'auto',
    background: 'rgba(0,0,0,0.88)',
    fontFamily: 'monospace', zIndex: '1300',
  });
  root.appendChild(panel);
  return panel;
}

/** @param {HTMLDivElement} panel @param {{depth?:number, score?:number, seed?:number, killerName?:string|null, cause?:string, shareUrl?:string}} detail */
function renderDeathScreen(panel, detail) {
  panel.innerHTML = '';

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(420px, 88vw)', textAlign: 'center',
    background: '#0b0e16', border: '1px solid #3a1c1c', borderRadius: '10px',
    padding: '28px 24px', boxShadow: '0 0 60px rgba(180,40,40,0.35)',
    color: '#cfe8ff',
  });

  // Skull
  const skull = document.createElement('div');
  skull.textContent = '\u2620\uFE0F';
  skull.style.fontSize = '64px';
  skull.style.marginBottom = '8px';
  box.appendChild(skull);

  // Title
  const title = document.createElement('div');
  title.textContent = 'You Have Perished';
  Object.assign(title.style, {
    fontSize: '22px', fontWeight: 'bold', color: '#ff6b6b',
    textShadow: '0 0 12px rgba(255,60,60,0.4)', marginBottom: '16px',
  });
  box.appendChild(title);

  // Stats
  const depth = detail?.depth ?? 1;
  const score = detail?.score ?? 0;
  const seed = detail?.seed ?? 0;
  const seedHex = seed ? '0x' + seed.toString(16).toUpperCase() : '???';
  const killerName = detail?.killerName;
  const cause = detail?.cause;

  const stats = document.createElement('div');
  Object.assign(stats.style, { marginBottom: '18px', lineHeight: '1.8', fontSize: '14px' });

  if (killerName) {
    const line = document.createElement('div');
    line.textContent = `Slain by ${killerName}`;
    line.style.color = '#ff9999';
    stats.appendChild(line);
  } else if (cause && cause !== 'unknown') {
    const line = document.createElement('div');
    line.textContent = `Cause: ${cause}`;
    line.style.color = '#ff9999';
    stats.appendChild(line);
  }

  const depthLine = document.createElement('div');
  depthLine.textContent = `Depth reached: ${depth}`;
  stats.appendChild(depthLine);

  const scoreLine = document.createElement('div');
  scoreLine.textContent = `Score: ${score}`;
  stats.appendChild(scoreLine);

  const seedLine = document.createElement('div');
  seedLine.textContent = `Seed: ${seedHex}`;
  seedLine.style.opacity = '0.7';
  stats.appendChild(seedLine);

  box.appendChild(stats);

  // Share button
  if (detail?.shareUrl) {
    const shareBtn = document.createElement('a');
    shareBtn.href = detail.shareUrl;
    shareBtn.target = '_blank';
    shareBtn.rel = 'noopener';
    shareBtn.textContent = 'Share on X';
    Object.assign(shareBtn.style, {
      display: 'inline-block', padding: '10px 22px',
      background: '#1a1a2e', color: '#cfe8ff', fontFamily: 'monospace',
      border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer', textDecoration: 'none', fontSize: '14px',
      marginBottom: '12px',
      transition: 'background 120ms',
    });
    shareBtn.addEventListener('mouseenter', () => { shareBtn.style.background = '#242448'; });
    shareBtn.addEventListener('mouseleave', () => { shareBtn.style.background = '#1a1a2e'; });
    box.appendChild(shareBtn);
    box.appendChild(document.createElement('br'));
  }

  // JS-Hack link
  const jshackLink = document.createElement('a');
  jshackLink.href = 'https://pjensen.github.io/JSHack/';
  jshackLink.target = '_blank';
  jshackLink.rel = 'noopener';
  jshackLink.textContent = 'Play JS-Hack';
  Object.assign(jshackLink.style, {
    display: 'inline-block', fontSize: '12px', color: '#7aacdf',
    textDecoration: 'none', marginBottom: '10px', opacity: '0.8',
  });
  jshackLink.addEventListener('mouseenter', () => { jshackLink.style.opacity = '1'; });
  jshackLink.addEventListener('mouseleave', () => { jshackLink.style.opacity = '0.8'; });
  box.appendChild(jshackLink);
  box.appendChild(document.createElement('br'));

  // Dismiss hint
  const hint = document.createElement('div');
  hint.textContent = 'Press any key to continue';
  Object.assign(hint.style, { opacity: '0.5', fontSize: '12px', marginTop: '10px' });
  box.appendChild(hint);

  panel.appendChild(box);

  // Dismiss on key or tap (after a short delay to avoid accidental dismiss)
  const dismiss = () => {
    panel.style.display = 'none';
    window.removeEventListener('keydown', onKey);
    panel.removeEventListener('pointerdown', onTap);
  };
  const onKey = () => dismiss();
  const onTap = (/** @type {PointerEvent} */ ev) => {
    if (ev.target === panel) dismiss();
  };
  setTimeout(() => {
    window.addEventListener('keydown', onKey, { once: true });
    panel.addEventListener('pointerdown', onTap);
  }, 600);
}
