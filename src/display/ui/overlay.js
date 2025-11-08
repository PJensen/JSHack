// display/ui/overlay.js
// Minimal UI overlays for inventory and message log; display-only.

export function initOverlays() {
  const root = ensureRoot();
  const inv = ensurePanel('inventory');
  const log = ensurePanel('messageLog');
  const pick = ensurePanel('pickup');
  const spells = ensurePanel('spells');
  const groundTip = ensureGroundTooltip(root);
  const spellGestureHint = ensureSpellGestureHint(root);
  const gestureDebug = ensureGestureDebugLayer(root);

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
  window.addEventListener('ui:openMessageLog', () => {
    show(log);
    // Request messages; app may respond with ui:messageLogData
    window.dispatchEvent(new CustomEvent('ui:requestMessageLogData'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hide(inv); hide(log); hide(pick); hide(spells); }
  });

  // Data feeds
  window.addEventListener('ui:inventoryData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    renderInventory(inv, items);
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
    if (id !== 'lightning') return;
    const mode = String(e?.detail?.mode || 'cast');
    const quality = Number(e?.detail?.quality);
    const clamped = Number.isFinite(quality) ? Math.max(0.35, Math.min(1, quality)) : 1;
    const duration = mode === 'learn' ? 2600 : 900;
    spellGestureHint.glyph.textContent = 'Z';
    spellGestureHint.glyph.style.textShadow = buildLightningShadow(clamped);
    spellGestureHint.glyph.style.opacity = mode === 'cast' ? '0.92' : '1';
    spellGestureHint.wrap.style.display = 'flex';
    spellGestureHint.wrap.style.animation = 'none';
    spellGestureHint.wrap.style.transform = 'translate(-50%, -50%) scale(1)';
    spellGestureHint.wrap.style.filter = 'drop-shadow(0 0 22px rgba(120,200,255,0.45))';
    // Only announce on learn; keep caption hidden on cast.
    spellGestureHint.caption.textContent = mode === 'learn'
      ? 'Draw a Z to unleash Lightning!'
      : '';
    spellGestureHint.caption.style.display = mode === 'learn' ? 'block' : 'none';
    if (spellGestureTimer) window.clearTimeout(spellGestureTimer);
    spellGestureTimer = window.setTimeout(() => {
      spellGestureHint.wrap.style.display = 'none';
      spellGestureTimer = 0;
    }, duration);
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
  if (!Array.isArray(points) || points.length === 0) return;

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
    ctx.strokeStyle = 'rgba(120,200,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

// --- Ground item tooltip (click to pick up) -------------------------------
/** @param {HTMLElement} root */
function ensureGroundTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'ground-item-tooltip';
  Object.assign(tip.style, {
    position: 'fixed', left: '50%', bottom: '64px', transform: 'translateX(-50%)',
    minWidth: '220px', maxWidth: '70vw', pointerEvents: 'auto', display: 'none',
    background: 'rgba(14,18,26,0.96)', color: '#dbeaff', borderRadius: '10px',
    border: '1px solid #33435f', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '10px 12px', zIndex: 850
  });
  root.appendChild(tip);
  return tip;
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

/** @param {HTMLDivElement} tip @param {{mode?:'single'|'multi', item?:any, items?:any[], count?:number, pickupRange?:number}} detail */
function renderGroundTooltip(tip, detail) {
  tip.innerHTML = '';
  const mode = detail?.mode || 'single';
  if (mode === 'multi') {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
    const lbl = document.createElement('div');
    lbl.textContent = `${detail?.count || (detail?.items?.length || 0)} items nearby`;
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
function show(panel) { panel.style.display = 'block'; }
/** @param {HTMLDivElement} panel */
function hide(panel) { panel.style.display = 'none'; }

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items */
function renderInventory(panel, items) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = 'Inventory';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
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
  el.appendChild(list);

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
      background: '#0f1421', color: '#cfe8ff', border: '1px solid #2d3b52', borderRadius: '6px'
    });
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

    const slot = document.createElement('span');
    slot.style.opacity = '0.7'; slot.textContent = it.slot ? `(${it.slot})` : '';

    const qty = document.createElement('span');
    qty.style.marginLeft = 'auto'; qty.style.opacity = '0.8'; qty.textContent = `x${it.count ?? 1}`;

    row.appendChild(star);
    row.appendChild(name);
    row.appendChild(slot);
    row.appendChild(qty);

    row.addEventListener('mouseenter', () => { setSel(idx); });
    row.addEventListener('click', () => defaultAction());
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85';
  hint.textContent = '↑/↓ to select · Enter to Use (Drink/Equip/Learn) · E=Equip · D=Drink · U=Use · Esc=Close';
  el.appendChild(hint);

  /** @param {number} i */
  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i|0));
  rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }

  function defaultAction() {
    const it = items[sel]; if (!it) return;
    if (it.type === 'potion') {
      window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    } else if (it.type === 'equip') {
      window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
    } else if (it.type === 'learn' || it.type === 'book' || it.type === 'scroll') {
      window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(items.length - 1); e.preventDefault(); }
    else if (k === 'Enter') { defaultAction(); e.preventDefault(); }
    else if (k === 'e' || k === 'E') { const it = items[sel]; if (it?.type === 'equip') { window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } })); e.preventDefault(); } }
    else if (k === 'd' || k === 'D') { const it = items[sel]; if (it?.type === 'potion') { window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } })); e.preventDefault(); } }
    else if (k === 'u' || k === 'U') { const it = items[sel]; if (it && (it.type === 'learn' || it.type === 'book' || it.type === 'scroll')) { window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } })); e.preventDefault(); } }
  }

  // Activate keyboard navigation while panel is open
  setSel(0);
  /** @param {KeyboardEvent} e */
  /** @param {KeyboardEvent} e */
  const keyHandler = (e) => onKey(e);
  window.addEventListener('keydown', keyHandler);
  // Remove handler when panel hides
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', keyHandler);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
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
    row.textContent = String(m);
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

  for (const it of items) {
    const row = document.createElement('label');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 8px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421'
    });
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.addEventListener('change', () => {
      if (cb.checked) selections.add(it.id); else selections.delete(it.id);
    });
  const name = document.createElement('span');
    name.style.color = '#9cf';
  name.textContent = bracketize(sanitize(it.name || it.type || 'item'));
    const desc = document.createElement('span');
    desc.style.opacity = '0.85';
    desc.textContent = `x${it.count ?? 1}`;

    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(desc);
    list.appendChild(row);
  }

  el.appendChild(list);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '10px';

  const btnPickSel = document.createElement('button');
  btnPickSel.textContent = 'Pick Selected';
  decorateButton(btnPickSel);
  btnPickSel.addEventListener('click', () => {
    const ids = Array.from(selections);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  });

  const btnPickAll = document.createElement('button');
  btnPickAll.textContent = 'Pick All';
  decorateButton(btnPickAll);
  btnPickAll.addEventListener('click', () => {
    const ids = items.map((i) => i.id);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  });

  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancel';
  decorateButton(btnCancel);
  btnCancel.addEventListener('click', () => hide(panel));

  actions.appendChild(btnPickAll);
  actions.appendChild(btnPickSel);
  actions.appendChild(btnCancel);
  el.appendChild(actions);

  queueMicrotask(() => {
    try { btnPickAll.focus(); } catch {}
  });
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
    position: 'fixed', left: '8px', top: '8px',
    maxWidth: '40vw', maxHeight: '40vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', gap: '2px',
    pointerEvents: 'none', zIndex: 850,
    opacity: '0.75', color: '#cfe8ff', fontFamily: 'monospace', fontSize: '12px',
    background: 'rgba(10, 14, 22, 0.35)',
    borderRadius: '6px', padding: '6px 8px', border: '1px solid rgba(45,59,82,0.5)'
  });
  root.appendChild(box);
  return box;
}

/** @param {HTMLElement} container @param {Array<any>} entries */
function renderMessageTicker(container, entries) {
  if (!container) return;
  // Show last ~8 messages newest at bottom
  const recent = entries.slice(-8);
  container.innerHTML = '';
  // With top-right layout, show newest at the top
  for (let i = recent.length - 1; i >= 0; i--) {
    const row = document.createElement('div');
    row.textContent = String(recent[i] ?? '');
    row.style.textShadow = '0 1px 0 rgba(0,0,0,0.4)';
    container.appendChild(row);
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
