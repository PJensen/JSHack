// display/ui/hud.js
// Minimal HUD with an Active Spell button.
import { createConcentricGauge } from './concentricGauge.js';
import { renderItemDetails } from './overlay.js';
import { rarityStyle } from './overlayUtils.js';

/**
 * @template T
 * @param {T[]} stack
 * @returns {T|undefined}
 */
export function peekStackTop(stack) {
  if (!Array.isArray(stack) || stack.length <= 0) return undefined;
  return stack[stack.length - 1];
}

/**
 * @template T
 * @param {T[]} stack
 * @param {(entry: T) => boolean} isActionable
 */
export function popUntilActionableTop(stack, isActionable) {
  if (!Array.isArray(stack)) return;
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (isActionable(top)) break;
    stack.pop();
  }
}

/**
 * @param {any} it
 * @returns {"identify"|"apply"|"equip"|"drink"|"use"}
 */
export function getQuickChipPrimaryAction(it) {
  const identity = String(it?.identity || it?.details?.identity || '');
  if (identity === 'scroll_identify') return 'apply';
  if (it?.canApply) return 'apply';
  const t = String(it?.type || '');
  if (t === 'gem') return 'apply';
  if (t === 'equip' || t === 'ammo' || t === 'wand') return 'equip';
  if (t === 'potion') return 'drink';
  return 'use';
}

/**
 * @param {any} it
 * @returns {boolean}
 */
export function canQuickChipIdentify(it) {
  const identity = String(it?.identity || it?.details?.identity || '');
  if (identity === 'scroll_identify') return false;
  const identified = it?.details?.identified ?? it?.identified;
  return identified === false;
}

/**
 * @param {any} it
 * @returns {boolean}
 */
export function hasScrollForIdentify(it) {
  return !!it?.hasScrollOfIdentify;
}

/**
 * @param {any} it
 * @returns {string}
 */
export function getQuickChipPrimaryActionLabel(it) {
  const action = getQuickChipPrimaryAction(it);
  if (action === 'apply') return String(it?.type || '') === 'gem' ? 'Socket' : 'Apply';
  if (action === 'equip') return 'Equip';
  if (action === 'drink') return 'Drink';
  return 'Use';
}

/**
 * @param {any} it
 * @param {{ expanded?: boolean }} opts
 * @returns {string}
 */
export function getQuickChipDetailLine(it, opts = {}) {
  const expanded = !!opts?.expanded;
  const count = normalizePositiveCount(it?.count);
  if (expanded) return `x${count} • details open`;
  const actionable = isQuickChipActionable(it);
  if (actionable && !!it?.justPickedUp) return `x${count} • just picked up • tap for details/pin`;
  if (actionable) return `x${count} • tap for details`;
  return `x${count} • picked up`;
}

/**
 * @param {any} it
 * @returns {boolean}
 */
export function isQuickChipActionable(it) {
  const t = String(it?.type || '');
  if (t === 'equip' || t === 'ammo' || t === 'wand') return true;
  if (t === 'tool') return true;
  if (t === 'potion' || t === 'scroll' || t === 'learn' || t === 'book' || t === 'food' || t === 'gem') return (it?.count || 0) > 0;
  return false;
}

export const QUICK_CHIP_DISMISS_LAYOUT = Object.freeze({
  chipPosition: 'relative',
  contentPaddingRight: '66px',
  top: '6px',
  right: '8px',
});

export const MOBILE_ACTION_BAR_GRID_AREAS = Object.freeze({
  character: Object.freeze({ col: '1', row: '1' }),
  pet: Object.freeze({ col: '2', row: '1' }),
  posture: Object.freeze({ col: '3', row: '1' }),
  pray: Object.freeze({ col: '4', row: '1' }),
  wait: Object.freeze({ col: '5', row: '1' }),
  shoot: Object.freeze({ col: '6', row: '1' }),
});

const STARTER_PIN_PRIORITY = Object.freeze([
  Object.freeze(['hearthstone']),
  Object.freeze(['potion_mana', 'mana_potion']),
  Object.freeze(['potion_health', 'healing_potion']),
]);

const STARTER_PIN_SKIP_IDENTITIES = new Set([
  'scroll_identify',
  'ammo_arrows',
  'ammo_fire_arrows',
  'ammo_piercing_arrows',
  'ammo_bodkin_arrows',
  'ammo_blunt_arrows',
]);

/**
 * @param {any} item
 * @returns {string}
 */
export function getQuickPinKey(item) {
  const identity = String(item?.identity || item?.details?.identity || '');
  if (identity) return identity;
  const id = Number(item?.id || 0) | 0;
  return id > 0 ? `id:${id}` : '';
}

/**
 * @param {Array<any>} pinned
 * @param {any} item
 * @returns {boolean}
 */
export function isPinnedQuickItem(pinned, item) {
  const key = getQuickPinKey(item);
  if (!key) return false;
  const source = Array.isArray(pinned) ? pinned : [];
  return source.some((entry) => getQuickPinKey(entry) === key);
}

/**
 * @param {Array<any>} inventoryItems
 * @param {number} capacity
 * @returns {Array<any>}
 */
export function buildStartingPinnedQuickItems(inventoryItems, capacity = 4) {
  const max = Math.max(1, Number(capacity || 4) | 0);
  const bag = Array.isArray(inventoryItems)
    ? inventoryItems.filter((item) => Math.max(0, Number(item?.count || 0) | 0) > 0)
    : [];
  if (!bag.length) return [];

  const selected = [];
  const usedKeys = new Set();
  const pushUnique = (item) => {
    if (!item || selected.length >= max) return;
    const key = getQuickPinKey(item);
    if (!key || usedKeys.has(key)) return;
    usedKeys.add(key);
    selected.push(item);
  };

  for (const aliases of STARTER_PIN_PRIORITY) {
    const pick = bag.find((item) => aliases.includes(String(item?.identity || '').toLowerCase()));
    if (pick) pushUnique(pick);
    if (selected.length >= max) return selected;
  }

  const coreIdentities = new Set(STARTER_PIN_PRIORITY.flat());
  for (const item of bag) {
    const identity = String(item?.identity || '').toLowerCase();
    if (!identity) continue;
    if (coreIdentities.has(identity)) continue;
    if (STARTER_PIN_SKIP_IDENTITIES.has(identity)) continue;
    pushUnique(item);
    break;
  }

  return selected;
}

/**
 * @param {Array<any>} pinned
 * @param {any} item
 * @param {number} capacity
 * @returns {Array<any>}
 */
export function upsertPinnedQuickItemLifo(pinned, item, capacity = 3) {
  const max = Math.max(1, Number(capacity || 3) | 0);
  const source = Array.isArray(pinned) ? pinned : [];
  const next = source.slice();
  const id = Number(item?.id || 0) | 0;
  const identity = String(item?.identity || item?.details?.identity || '');
  const pinKey = getQuickPinKey(item);
  if (!pinKey) return next;
  const idx = next.findIndex((entry) => String(entry?.pinKey || '') === pinKey);
  if (idx >= 0) next.splice(idx, 1);
  if (next.length >= max) next.shift();
  next.push({ ...item, id, identity, pinKey });
  return next;
}

/**
 * @param {Array<any>} pinned
 * @param {Array<any>} inventoryItems
 * @returns {Array<any>}
 */
export function reconcilePinnedQuickItemsWithInventory(pinned, inventoryItems) {
  const source = Array.isArray(pinned) ? pinned : [];
  const items = Array.isArray(inventoryItems) ? inventoryItems : [];
  /** @type {Map<string, { count:number, item:any }>} */
  const byPinKey = new Map();
  for (const item of items) {
    const count = Math.max(0, Number(item?.count || 0) | 0);
    const identity = String(item?.identity || item?.details?.identity || '');
    if (identity) {
      const prev = byPinKey.get(identity);
      byPinKey.set(identity, { count: (prev?.count || 0) + count, item: item });
      continue;
    }
    const rawIds = Array.isArray(item?.entityIds) ? item.entityIds : [item?.id];
    for (const rawId of rawIds) {
      const id = Number(rawId || 0) | 0;
      if (!(id > 0)) continue;
      byPinKey.set(`id:${id}`, { count, item });
    }
  }
  const out = [];
  for (const entry of source) {
    const entryId = Number(entry?.id || 0) | 0;
    const entryIdentity = String(entry?.identity || entry?.details?.identity || '');
    const key = String(entry?.pinKey || entryIdentity || (entryId > 0 ? `id:${entryId}` : ''));
    if (!key) continue;
    const rec = byPinKey.get(key);
    const count = Number(rec?.count || 0) | 0;
    if (!(count > 0)) continue;
    const fresh = rec?.item && typeof rec.item === 'object' ? rec.item : null;
    out.push({
      ...entry,
      ...(fresh || {}),
      pinKey: key,
      count,
      id: Number(fresh?.id || entry?.id || 0) | 0,
      identity: String(fresh?.identity || entry?.identity || ''),
      details: fresh?.details || entry?.details,
    });
  }
  return out;
}

/**
 * @param {Array<any>} pinned
 * @param {{ pinKey?:string, identity?:string, itemId?:number } | null | undefined} usedDetail
 * @returns {Array<any>}
 */
export function applyPinnedQuickItemUse(pinned, usedDetail) {
  const source = Array.isArray(pinned) ? pinned : [];
  const key = String(usedDetail?.pinKey || usedDetail?.identity || '');
  const hasKey = key.length > 0;
  const itemId = Number(usedDetail?.itemId || 0) | 0;
  const hasItemId = itemId > 0;
  if (!hasKey && !hasItemId) return source.slice();
  const out = [];
  for (const entry of source) {
    const entryId = Number(entry?.id || 0) | 0;
    const entryIdentity = String(entry?.identity || entry?.details?.identity || '');
    const entryKey = String(entry?.pinKey || entryIdentity || (entryId > 0 ? `id:${entryId}` : ''));
    const matches = (hasKey && entryKey === key) || (!hasKey && hasItemId && entryId === itemId);
    if (!matches) {
      out.push(entry);
      continue;
    }
    const nextCount = Math.max(0, Number(entry?.count || 0) - 1);
    if (!(nextCount > 0)) continue;
    out.push({ ...entry, count: nextCount });
  }
  return out;
}

/**
 * @param {Array<any>} a
 * @param {Array<any>} b
 * @returns {boolean}
 */
function arePinnedArraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (String(a[i]?.pinKey || '') !== String(b[i]?.pinKey || '')) return false;
    if (Number(a[i]?.id || 0) !== Number(b[i]?.id || 0)) return false;
    if (Number(a[i]?.count || 0) !== Number(b[i]?.count || 0)) return false;
  }
  return true;
}

/**
 * @param {any} value
 * @returns {number}
 */
function normalizePositiveCount(value) {
  return Math.max(1, Number(value || 1) | 0);
}

/**
 * @param {string} text
 * @returns {string}
 */
function bracketizeLabel(text) {
  const s = String(text || "");
  if (s.startsWith("[") && s.endsWith("]")) return s;
  return `[${s}]`;
}

export function initHUD() {
  const root = ensureRoot();
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', left: '8px', right: '8px', bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center',
    pointerEvents: 'auto', zIndex: 900
  });

  // Top-right HUD cluster for gauge + active effects (vertical stack).
  const topRightHud = document.createElement('div');
  Object.assign(topRightHud.style, {
    position: 'fixed',
    right: 'calc(8px + env(safe-area-inset-right, 0px))',
    top: 'calc(8px + env(safe-area-inset-top, 0px))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    pointerEvents: 'none',
    zIndex: 905,
  });

  // Top-right concentric vitals gauge (HP/Mana/Stamina)
  const vitals = document.createElement('div');
  vitals.id = 'hud-vitals';
  Object.assign(vitals.style, {
    position: 'relative',
    width: 'min(188px, 22vw)',
    height: 'min(188px, 22vw)',
    flex: '0 0 auto',
    pointerEvents: 'none',
  });
  const vitalsGauge = createConcentricGauge(vitals, {
    health: 1,
    mana: 1,
    stamina: 1,
    hpValue: 1,
    hpMax: 1,
    manaValue: 1,
    manaMax: 1,
    staminaValue: 1,
    staminaMax: 1,
  });

  // Camera zoom buttons (+ / −) below the gauge
  function makeZoomBtn(label, factor) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = factor > 1 ? 'Zoom in' : 'Zoom out';
    Object.assign(btn.style, {
      width: '22px', height: '22px',
      padding: '0', margin: '0',
      border: '1px solid rgba(255,255,255,0.18)',
      borderRadius: '4px',
      background: 'rgba(16,22,38,0.75)',
      color: 'rgba(255,255,255,0.7)',
      fontSize: '14px', lineHeight: '1',
      cursor: 'pointer',
      pointerEvents: 'auto',
      display: 'grid', placeItems: 'center',
      touchAction: 'manipulation',
    });
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ui:zoom', { detail: { factor } }));
    });
    return btn;
  }

  const zoomBar = document.createElement('div');
  Object.assign(zoomBar.style, {
    display: 'flex', gap: '4px',
    justifyContent: 'center',
    marginTop: '4px',
    pointerEvents: 'auto',
  });
  zoomBar.appendChild(makeZoomBtn('\u2212', 1 / 1.2)); // zoom out
  zoomBar.appendChild(makeZoomBtn('+', 1.2));           // zoom in

  // Active effects HUD: vertical stack below the gauge on the right side.
  const effectsHud = document.createElement('div');
  Object.assign(effectsHud.style, {
    position: 'relative',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px',
    padding: '6px 8px', borderRadius: '6px',
    background: 'rgba(10,14,22,0.55)', border: '1px solid #2d3b52',
    pointerEvents: 'none',
  });
  const statusRow = document.createElement('div');
  Object.assign(statusRow.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
  });
  const affixRow = document.createElement('div');
  Object.assign(affixRow.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' });
  effectsHud.appendChild(statusRow);
  effectsHud.appendChild(affixRow);
  topRightHud.appendChild(vitals);
  topRightHud.appendChild(zoomBar);
  topRightHud.appendChild(effectsHud);
  root.appendChild(topRightHud);
  vitalsGauge.draw();

  // Help button — desktop only, top-left corner
  const helpBtn = document.createElement('button');
  helpBtn.textContent = '\u2139'; // ℹ information symbol
  helpBtn.title = 'Help & Reference';
  Object.assign(helpBtn.style, {
    position: 'fixed', left: '8px', bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
    width: '36px', height: '36px',
    padding: '0', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    fontSize: '20px', cursor: 'pointer',
    pointerEvents: 'auto', zIndex: 910,
    lineHeight: '36px', textAlign: 'center',
    display: 'none'
  });
  helpBtn.addEventListener('click', () => window.open('./tools/help/', '_blank'));
  root.appendChild(helpBtn);

  const charBtn = document.createElement('button');
  charBtn.id = 'btn-character-sheet';
  charBtn.textContent = 'Character';
  Object.assign(charBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  charBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:toggleCharacter')); } catch (e) { console.debug('[hud] dispatch ui:toggleCharacter:', e); }
  });

  // Bag (inventory) button
  const bagBtn = document.createElement('button');
  bagBtn.id = 'btn-bag';
  bagBtn.textContent = 'Bag';
  Object.assign(bagBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  bagBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ui:openInventory'));
  });

  const castBtn = document.createElement('button');
  castBtn.id = 'active-spell';
  castBtn.textContent = 'Cast';
  Object.assign(castBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  castBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ui:castActiveSpell'));
  });
  // Shift-click (or right-click) opens spell picker
  castBtn.addEventListener('contextmenu', (e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('ui:openSpellPicker')); });
  castBtn.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.shiftKey && e.button === 0)) { // middle or Shift+Left
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ui:openSpellPicker'));
    }
  });

  // Spell-select button (opens spell picker directly)
  const spellSelectBtn = document.createElement('button');
  spellSelectBtn.id = 'btn-spell-select';
  spellSelectBtn.textContent = 'Spells';
  Object.assign(spellSelectBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  spellSelectBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ui:openSpellPicker'));
  });

  // Ranged attack button (to the right of Cast)
  const shootBtn = document.createElement('button');
  shootBtn.id = 'btn-shoot';
  shootBtn.textContent = 'Shoot';
  Object.assign(shootBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  shootBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:shootRanged')); } catch (e) { console.debug('[hud] dispatch ui:shootRanged:', e); }
  });

  // Pray button
  const prayBtn = document.createElement('button');
  prayBtn.id = 'btn-pray';
  prayBtn.textContent = 'Pray';
  Object.assign(prayBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  prayBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:pray')); } catch (e) { console.debug('[hud] dispatch ui:pray:', e); }
  });

  const quickInteractBtn = document.createElement('button');
  quickInteractBtn.id = 'btn-quick-interact';
  Object.assign(quickInteractBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  quickInteractBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:quickInteract')); } catch (e) { console.debug('[hud] dispatch ui:quickInteract:', e); }
  });

  const postureBtn = document.createElement('button');
  postureBtn.id = 'btn-posture';
  postureBtn.textContent = 'Posture';
  Object.assign(postureBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  postureBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:cyclePosture')); } catch (e) { console.debug('[hud] dispatch ui:cyclePosture:', e); }
  });

  // Search/Wait button
  // Short tap → search action (reveals hidden traps, etc.)
  // Long hold (≥500ms) → continuously emit wait at 222ms intervals while held
  const waitBtn = document.createElement('button');
  waitBtn.id = 'btn-wait';
  waitBtn.textContent = 'Search';
  Object.assign(waitBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });

  function attachButtonHoldRing(btn) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    Object.assign(svg.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '4',
      opacity: '0',
      transition: 'opacity 120ms ease',
      filter: 'drop-shadow(0 0 2px rgba(95,179,255,0.35))',
    });
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M 8 3 H 92 A 8 8 0 0 1 97 8 V 92 A 8 8 0 0 1 92 97 H 8 A 8 8 0 0 1 3 92 V 8 A 8 8 0 0 1 8 3 Z');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#5fb3ff');
    path.setAttribute('stroke-width', '4');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    const pathLength = path.getTotalLength();
    path.style.strokeDasharray = String(pathLength);
    path.style.strokeDashoffset = String(pathLength);
    svg.appendChild(path);
    const ring = {
      svg,
      path,
      pathLength,
      setProgress(progress) {
        const p = Math.max(0, Math.min(1, Number(progress || 0)));
        svg.style.opacity = p > 0 ? '1' : '0';
        path.style.strokeDashoffset = String(pathLength * (1 - p));
      },
      reset() {
        svg.style.opacity = '0';
        path.style.strokeDashoffset = String(pathLength);
      },
    };
    btn.appendChild(svg);
    btn.__holdRing = ring;
    return ring;
  }

  const waitHoldRing = attachButtonHoldRing(waitBtn);

  {
    const SEARCH_LONG_PRESS_MS = 500;
    const WAIT_REPEAT_MS = 140;
    let searchPressTimer = null;
    let searchRepeatTimer = null;
    let searchProgressTimer = null;
    let searchPressStartedAt = 0;
    let searchIsLongPress = false;

    function setSearchButtonHoldVisual(waitMode) {
      const active = !!waitMode;
      setDesktopIcon(waitBtn, active ? ACTION_ICONS.wait : ACTION_ICONS.search);
      setMobileIcon(waitBtn, active ? ACTION_ICONS.wait : ACTION_ICONS.search);
      setBarLabel(waitBtn, active ? 'Wait' : 'Search');
      refreshCommandLabels();
    }

    function searchStartPress() {
      searchIsLongPress = false;
      searchPressStartedAt = performance.now();
      waitHoldRing.setProgress(0.02);
      const tickProgress = () => {
        const elapsed = Math.max(0, performance.now() - searchPressStartedAt);
        waitHoldRing.setProgress(elapsed / SEARCH_LONG_PRESS_MS);
        if (searchPressTimer && !searchIsLongPress) {
          searchProgressTimer = requestAnimationFrame(tickProgress);
        }
      };
      searchProgressTimer = requestAnimationFrame(tickProgress);
      searchPressTimer = setTimeout(() => {
        searchIsLongPress = true;
        waitHoldRing.setProgress(1);
        setSearchButtonHoldVisual(true);
        waitBtn.style.background = '#0a1120';
        // Immediately emit one wait, then repeat
        try { window.dispatchEvent(new CustomEvent('ui:wait')); } catch (e) { console.debug('[hud] dispatch ui:wait:', e); }
        searchRepeatTimer = setInterval(() => {
          try { window.dispatchEvent(new CustomEvent('ui:wait')); } catch (e) { console.debug('[hud] dispatch ui:wait:', e); }
        }, WAIT_REPEAT_MS);
      }, SEARCH_LONG_PRESS_MS);
    }

    function searchEndPress() {
      if (searchPressTimer) { clearTimeout(searchPressTimer); searchPressTimer = null; }
      if (searchRepeatTimer) { clearInterval(searchRepeatTimer); searchRepeatTimer = null; }
      if (searchProgressTimer) { cancelAnimationFrame(searchProgressTimer); searchProgressTimer = null; }
      waitHoldRing.reset();
      setSearchButtonHoldVisual(false);
      waitBtn.style.background = '#101626';
      if (!searchIsLongPress) {
        // Short tap → search
        try { window.dispatchEvent(new CustomEvent('ui:search')); } catch (e) { console.debug('[hud] dispatch ui:search:', e); }
      }
      searchIsLongPress = false;
    }

    function searchCancelPress() {
      if (searchPressTimer) { clearTimeout(searchPressTimer); searchPressTimer = null; }
      if (searchRepeatTimer) { clearInterval(searchRepeatTimer); searchRepeatTimer = null; }
      if (searchProgressTimer) { cancelAnimationFrame(searchProgressTimer); searchProgressTimer = null; }
      waitHoldRing.reset();
      setSearchButtonHoldVisual(false);
      waitBtn.style.background = '#101626';
      searchIsLongPress = false;
    }

    waitBtn.addEventListener('touchstart', () => searchStartPress(), { passive: true });
    waitBtn.addEventListener('touchend', () => searchEndPress(), { passive: true });
    waitBtn.addEventListener('touchcancel', () => searchCancelPress(), { passive: true });
    waitBtn.addEventListener('mousedown', (e) => { if (e.button === 0) searchStartPress(); });
    waitBtn.addEventListener('mouseup', (e) => { if (e.button === 0) searchEndPress(); });
    waitBtn.addEventListener('mouseleave', () => searchCancelPress());
  }

  // Pet control button (touch/press interface)
  const petBtn = document.createElement('button');
  petBtn.id = 'btn-pet';
  petBtn.textContent = 'Pet: Following';
  Object.assign(petBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  const petHoldRing = attachButtonHoldRing(petBtn);

  const ACTION_ICONS = Object.freeze({
    character: '@',
    bag: '\u{1F392}',         // 🎒
    cast: '\u2726',           // ✦
    spells: '\u{1F4D6}',      // 📖
    shoot: '\u{1F3F9}',       // 🏹
    zap: '\u26A1',            // ⚡
    pray: '\u{1F64F}',        // 🙏
    door: '\u{1F6AA}',        // 🚪
    postureBalanced: '\u2696',   // ⚖
    postureAggressive: '\u2694', // ⚔
    postureGuarded: '\u{1F6E1}', // 🛡
    wait: '\u23F3',           // ⏳ (kept for backward compat; button now uses 'search')
    search: '\u{1F50D}',      // 🔍
    bug: '\u{1F47E}',         // 👾
    petDefault: '\u{1F43E}',  // 🐾
  });

  const PET_STATE_ICONS = Object.freeze({
    following: '\u{1F43E}',    // 🐾
    staying: '\u2693',         // ⚓
    fetching: '\u{1F9B4}',     // 🦴
    returning: '\u21A9',       // ↩
    guarding: '\u{1F6E1}\uFE0F', // 🛡️
    aggressive: '\u2694\uFE0F', // ⚔️
    fleeing: '\u{1F4A8}',      // 💨
    idle: '\u{1F4A4}',         // 💤
  });

  // Long-press detection for state rotation vs menu (touch and mouse interface)
  let pressTimer = null;
  let pressProgressTimer = null;
  let pressStartedAt = 0;
  let isLongPress = false;
  const LONG_PRESS_DURATION = 500; // ms

  function resetBackground() {
    const currentState = petBtn.dataset.state || 'following';
    if (currentState === 'fleeing') {
      petBtn.style.background = '#3d1616';
    } else if (currentState === 'guarding') {
      petBtn.style.background = '#16263d';
    } else if (currentState === 'aggressive') {
      petBtn.style.background = '#3d2616';
    } else {
      petBtn.style.background = '#101626';
    }
  }

  function startPress() {
    isLongPress = false;
    pressStartedAt = performance.now();
    petHoldRing.setProgress(0.02);
    const tickProgress = () => {
      const elapsed = Math.max(0, performance.now() - pressStartedAt);
      petHoldRing.setProgress(elapsed / LONG_PRESS_DURATION);
      if (pressTimer && !isLongPress) {
        pressProgressTimer = requestAnimationFrame(tickProgress);
      }
    };
    pressProgressTimer = requestAnimationFrame(tickProgress);
    pressTimer = setTimeout(() => {
      isLongPress = true;
      petHoldRing.setProgress(1);
      window.dispatchEvent(new CustomEvent('ui:openPetMenu'));
      // Visual feedback for long press
      petBtn.style.background = '#1a2636';
    }, LONG_PRESS_DURATION);
  }

  function endPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (pressProgressTimer) {
      cancelAnimationFrame(pressProgressTimer);
      pressProgressTimer = null;
    }
    petHoldRing.reset();
    resetBackground();
    // If not a long press, rotate state
    if (!isLongPress) {
      try { window.dispatchEvent(new CustomEvent('ui:rotatePetState')); } catch (e) { console.debug('[hud] dispatch ui:rotatePetState:', e); }
    }
    isLongPress = false;
  }

  function cancelPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (pressProgressTimer) {
      cancelAnimationFrame(pressProgressTimer);
      pressProgressTimer = null;
    }
    petHoldRing.reset();
    isLongPress = false;
    resetBackground();
  }

  // Touch event handlers
  petBtn.addEventListener('touchstart', () => {
    startPress();
  }, { passive: true });

  petBtn.addEventListener('touchend', () => {
    endPress();
  }, { passive: true });

  petBtn.addEventListener('touchcancel', () => {
    cancelPress();
  }, { passive: true });

  // Mouse event handlers
  petBtn.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click only
      startPress();
    }
  });

  petBtn.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      endPress();
    }
  });

  petBtn.addEventListener('mouseleave', () => {
    cancelPress();
  });

  // Right-click or context menu: Open full menu immediately
  petBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cancelPress(); // Cancel any ongoing long-press
    window.dispatchEvent(new CustomEvent('ui:openPetMenu'));
  });

  const commandButtons = [charBtn, bagBtn, petBtn, castBtn, spellSelectBtn, shootBtn, prayBtn, quickInteractBtn, postureBtn, waitBtn];
  for (const btn of commandButtons) {
    Object.assign(btn.style, {
      position: 'relative',
      minHeight: '44px',
      minWidth: '44px',
      fontSize: '22px',
      lineHeight: '1',
      display: 'grid',
      placeItems: 'center',
      whiteSpace: 'nowrap',
      touchAction: 'manipulation'
    });
  }

  const mobileLayoutMq = window.matchMedia('(max-width: 760px)');
  let _mobileRadialEl = null;
  let _pinnedSpellDockEl = null;
  let _pinnedSpellDockFanEl = null;
  const setDesktopLabel = (btn, text) => { btn.dataset.desktopLabel = String(text || ''); };
  const setMobileLabel = (btn, text) => { btn.dataset.mobileLabel = String(text || ''); };
  const setDesktopIcon = (btn, text) => { btn.dataset.desktopIcon = String(text || ''); };
  const setMobileIcon = (btn, text) => { btn.dataset.mobileIcon = String(text || ''); };
  const setBarLabel = (btn, text) => { btn.dataset.barLabel = String(text || ''); };
  const refreshCommandLabels = () => {
    const isMobile = mobileLayoutMq.matches;
    for (const btn of commandButtons) {
      const desktopText = String(btn.dataset.desktopLabel || btn.textContent || '');
      const mobileText = String(btn.dataset.mobileLabel || desktopText);
      const desktopIcon = String(btn.dataset.desktopIcon || btn.textContent || '');
      const mobileIcon = String(btn.dataset.mobileIcon || desktopIcon);
      const visibleText = isMobile ? mobileText : desktopText;
      const icon = isMobile ? mobileIcon : desktopIcon;
      const barLabel = btn.dataset.barLabel || '';
      btn.textContent = '';
      const iconSpan = document.createElement('span');
      iconSpan.textContent = icon;
      iconSpan.style.lineHeight = '1';
      btn.appendChild(iconSpan);
      if (barLabel) {
        const labelSpan = document.createElement('span');
        labelSpan.textContent = barLabel;
        Object.assign(labelSpan.style, {
          position: 'absolute',
          bottom: '2px',
          left: '0',
          right: '0',
          textAlign: 'center',
          fontSize: '9px',
          lineHeight: '1',
          opacity: '0.7',
          letterSpacing: '0.3px',
          pointerEvents: 'none',
        });
        btn.appendChild(labelSpan);
      }
      if (!isMobile && btn.dataset.keyHint) {
        const keySpan = document.createElement('span');
        keySpan.textContent = btn.dataset.keyHint;
        Object.assign(keySpan.style, {
          position: 'absolute',
          top: '2px',
          right: '4px',
          fontSize: '9px',
          lineHeight: '1',
          opacity: '0.8',
          pointerEvents: 'none',
          fontFamily: 'monospace',
        });
        btn.appendChild(keySpan);
      }
      btn.title = desktopText || visibleText || '';
      btn.setAttribute('aria-label', desktopText || visibleText || 'Action');
      const holdRing = btn.__holdRing;
      if (holdRing?.svg) btn.appendChild(holdRing.svg);
    }
  };

  setDesktopLabel(charBtn, 'Character'); setMobileLabel(charBtn, 'Character');
  setDesktopLabel(bagBtn, 'Inventory'); setMobileLabel(bagBtn, 'Bag');
  setDesktopLabel(petBtn, 'Pet: Following'); setMobileLabel(petBtn, 'Pet');
  setDesktopLabel(castBtn, 'Cast'); setMobileLabel(castBtn, 'Cast');
  setDesktopLabel(spellSelectBtn, 'Spells'); setMobileLabel(spellSelectBtn, 'Spells');
  setDesktopLabel(shootBtn, 'Shoot'); setMobileLabel(shootBtn, 'Shoot');
  setDesktopLabel(prayBtn, 'Pray'); setMobileLabel(prayBtn, 'Pray');
  setDesktopLabel(quickInteractBtn, 'Door'); setMobileLabel(quickInteractBtn, 'Door');
  setDesktopLabel(postureBtn, 'Posture: Balanced'); setMobileLabel(postureBtn, 'Posture');
  setDesktopLabel(waitBtn, 'Search'); setMobileLabel(waitBtn, 'Search');
  setDesktopIcon(charBtn, ACTION_ICONS.character); setMobileIcon(charBtn, ACTION_ICONS.character);
  setDesktopIcon(bagBtn, ACTION_ICONS.bag); setMobileIcon(bagBtn, ACTION_ICONS.bag);
  setDesktopIcon(petBtn, ACTION_ICONS.petDefault); setMobileIcon(petBtn, ACTION_ICONS.petDefault);
  setDesktopIcon(castBtn, ACTION_ICONS.cast); setMobileIcon(castBtn, ACTION_ICONS.cast);
  setDesktopIcon(spellSelectBtn, ACTION_ICONS.spells); setMobileIcon(spellSelectBtn, ACTION_ICONS.spells);
  setDesktopIcon(shootBtn, ACTION_ICONS.shoot); setMobileIcon(shootBtn, ACTION_ICONS.shoot);
  setDesktopIcon(prayBtn, ACTION_ICONS.pray); setMobileIcon(prayBtn, ACTION_ICONS.pray);
  setDesktopIcon(quickInteractBtn, ACTION_ICONS.door); setMobileIcon(quickInteractBtn, ACTION_ICONS.door);
  setDesktopIcon(postureBtn, ACTION_ICONS.postureBalanced); setMobileIcon(postureBtn, ACTION_ICONS.postureBalanced);
  setDesktopIcon(waitBtn, ACTION_ICONS.search); setMobileIcon(waitBtn, ACTION_ICONS.search);
  setBarLabel(charBtn, 'Char');
  setBarLabel(bagBtn, 'Bag');
  setBarLabel(petBtn, 'Pet');
  setBarLabel(castBtn, 'Cast');
  setBarLabel(spellSelectBtn, 'Spells');
  setBarLabel(shootBtn, 'Shoot');
  setBarLabel(prayBtn, 'Pray');
  setBarLabel(quickInteractBtn, 'Door');
  setBarLabel(postureBtn, 'Posture');
  setBarLabel(waitBtn, 'Search');
  charBtn.dataset.keyHint = 'c';
  bagBtn.dataset.keyHint = 'i';
  petBtn.dataset.keyHint = 'p';
  castBtn.dataset.keyHint = 'f';
  spellSelectBtn.dataset.keyHint = 'S';
  shootBtn.dataset.keyHint = 'r';
  prayBtn.dataset.keyHint = 'P';
  quickInteractBtn.dataset.keyHint = 'o';
  postureBtn.dataset.keyHint = 'v';
  waitBtn.dataset.keyHint = '.';

  let pinSlots = null;
  function setPinSlotsGridPlacement(col = '', row = '') {
    if (!pinSlots?.el) return;
    pinSlots.el.style.gridColumn = col;
    pinSlots.el.style.gridRow = row;
  }

  function applyCommandBarLayout() {
    const isMobile = mobileLayoutMq.matches;
    // Temporarily hidden per UX direction.
    helpBtn.style.display = 'none';
    // Resize vitals gauge for mobile vs desktop
    const gaugeSize = isMobile ? 'min(110px, 26vw)' : 'min(188px, 22vw)';
    vitals.style.width = gaugeSize;
    vitals.style.height = gaugeSize;
    // Hide spell slots on mobile (spell dock handles it), show on desktop
    spellSlotsContainer.style.display = isMobile ? 'none' : 'flex';
    bagBtn.style.display = isMobile ? 'none' : 'grid';
    castBtn.style.display = isMobile ? 'none' : 'grid';
    spellSelectBtn.style.display = isMobile ? 'none' : 'grid';
    // Door button hidden on mobile
    quickInteractBtn.style.display = isMobile ? 'none' : 'grid';
    // Hide main radial — pinned spell dock replaces it
    if (_mobileRadialEl) _mobileRadialEl.style.display = 'none';
    if (_pinnedSpellDockEl) _pinnedSpellDockEl.style.display = isMobile ? 'flex' : 'none';
    if (_pinnedSpellDockFanEl) _pinnedSpellDockFanEl.style.display = isMobile ? '' : 'none';

    // Move pinned quick items into the spell dock row on mobile, back to bar on desktop
    if (isMobile && _pinnedSpellDockEl) {
      _pinnedSpellDockEl.appendChild(pinSlots.el);
      Object.assign(pinSlots.el.style, {
        display: 'flex',
        flexDirection: 'row',
        gap: '6px',
        gridTemplateColumns: '',
        gridTemplateRows: '',
        alignItems: 'center',
      });
      for (const btn of pinSlots.el.children) {
        Object.assign(btn.style, {
          width: '40px', height: '40px',
          minWidth: '0', minHeight: '0',
          borderRadius: '50%',
        });
      }
    } else {
      // Reparent back into the action bar for desktop
      if (!bar.contains(pinSlots.el)) {
        bar.insertBefore(pinSlots.el, spellSlotsContainer);
      }
      Object.assign(pinSlots.el.style, {
        display: 'grid',
        flexDirection: '',
        gap: '4px',
        gridTemplateColumns: 'repeat(2, 44px)',
        gridTemplateRows: 'repeat(2, 44px)',
        alignItems: 'center',
      });
      for (const btn of pinSlots.el.children) {
        Object.assign(btn.style, {
          width: '', height: '',
          minWidth: '', minHeight: '',
          borderRadius: '6px',
        });
      }
    }

    if (isMobile) {
      // Single-row action bar
      Object.assign(bar.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gridTemplateRows: '44px',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        gap: '6px'
      });
      for (const btn of commandButtons) {
        btn.style.width = '100%';
        btn.style.minWidth = '0';
        btn.style.padding = '8px 4px';
        btn.style.fontSize = '20px';
        btn.style.overflow = 'hidden';
        btn.style.textOverflow = 'ellipsis';
      }
      const area = MOBILE_ACTION_BAR_GRID_AREAS;
      charBtn.style.gridColumn = area.character.col;
      charBtn.style.gridRow = area.character.row;
      petBtn.style.gridColumn = area.pet.col;
      petBtn.style.gridRow = area.pet.row;
      postureBtn.style.gridColumn = area.posture.col;
      postureBtn.style.gridRow = area.posture.row;
      prayBtn.style.gridColumn = area.pray.col;
      prayBtn.style.gridRow = area.pray.row;
      waitBtn.style.gridColumn = area.wait.col;
      waitBtn.style.gridRow = area.wait.row;
      shootBtn.style.gridColumn = area.shoot.col;
      shootBtn.style.gridRow = area.shoot.row;
      refreshCommandLabels();
      return;
    }

    Object.assign(bar.style, {
      display: 'flex',
      gridTemplateColumns: '',
      gridTemplateRows: '',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '8px'
    });
    for (const btn of commandButtons) {
      btn.style.width = '';
      btn.style.minWidth = '44px';
      btn.style.padding = '8px 10px';
      btn.style.fontSize = '22px';
      btn.style.overflow = '';
      btn.style.textOverflow = '';
      btn.style.gridColumn = '';
      btn.style.gridRow = '';
    }
    setPinSlotsGridPlacement('', '');
    refreshCommandLabels();
  }

  function syncActionBarHeight() {
    const h = Math.max(44, Math.ceil(bar.getBoundingClientRect().height || 44));
    document.documentElement.style.setProperty('--jshack-actionbar-height', `${h}px`);
  }

  // Show/hide pet button based on pet existence
  window.addEventListener('ui:petExists', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const exists = Boolean(e?.detail?.exists);
    petBtn.style.visibility = exists ? 'visible' : 'hidden';
    petBtn.style.pointerEvents = exists ? 'auto' : 'none';
    petBtn.setAttribute('aria-hidden', exists ? 'false' : 'true');
  });
  // Update button based on pet state
  window.addEventListener('ui:updatePetButton', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const state = String(e?.detail?.state || 'following');
    const stateLabels = {
      following: 'Following',
      staying: 'Staying',
      fetching: 'Fetching',
      returning: 'Returning',
      guarding: 'Guarding',
      aggressive: 'Aggressive',
      fleeing: 'Fleeing!',
      idle: 'Idle'
    };
    const stateLabel = `Pet: ${stateLabels[state] || state}`;
    setDesktopLabel(petBtn, stateLabel);
    setMobileLabel(petBtn, stateLabel);
    const stateIcon = PET_STATE_ICONS[state] || ACTION_ICONS.petDefault;
    setDesktopIcon(petBtn, stateIcon);
    setMobileIcon(petBtn, stateIcon);
    petBtn.dataset.state = state; // Store for background reset
    refreshCommandLabels();
    // Color code by state
    if (state === 'fleeing') {
      petBtn.style.background = '#3d1616'; // Red tint for danger
    } else if (state === 'guarding') {
      petBtn.style.background = '#16263d'; // Blue tint for combat
    } else if (state === 'aggressive') {
      petBtn.style.background = '#3d2616'; // Orange tint for aggro
    } else {
      petBtn.style.background = '#101626'; // Default
    }
  });

  function setPrayButtonHighlight(active) {
    const enabled = !!active;
    prayBtn.dataset.openingHighlight = enabled ? 'true' : 'false';
    prayBtn.style.transform = enabled ? 'translateY(-1px) scale(1.04)' : '';
    prayBtn.style.borderColor = enabled ? '#f3d46b' : '#2d3b52';
    prayBtn.style.background = enabled
      ? 'linear-gradient(180deg, #4b3a12 0%, #2a1f0a 100%)'
      : '#101626';
    prayBtn.style.boxShadow = enabled
      ? '0 0 0 2px rgba(243,212,107,0.28), 0 0 18px rgba(243,212,107,0.45)'
      : 'none';
    prayBtn.style.color = enabled ? '#fff2b8' : '#cfe8ff';
  }

  window.addEventListener('ui:highlightPrayButton', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    setPrayButtonHighlight(Boolean(e?.detail?.active));
  });

  // Update label when app sets active spell
  window.addEventListener('ui:updateActiveSpellLabel', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const name = String(e?.detail?.name || '').trim();
    const symbol = String(e?.detail?.symbol || '').trim();
    const cost = Number(e?.detail?.cost || 0);
    const costKind = String(e?.detail?.costKind || 'mana');
    const canCast = Boolean(e?.detail?.canCast ?? true);
    const costSuffix = costKind === 'stamina' ? ' stam' : costKind === 'life' ? ' hp' : '';
    setDesktopLabel(castBtn, name ? (cost ? `Cast [${name}] (${cost}${costSuffix})` : `Cast [${name}]`) : 'Cast');
    if (symbol) {
      setDesktopIcon(castBtn, symbol);
      setMobileIcon(castBtn, symbol);
    } else {
      setDesktopIcon(castBtn, ACTION_ICONS.cast);
      setMobileIcon(castBtn, ACTION_ICONS.cast);
    }
    setBarLabel(castBtn, name || 'Cast');
    refreshCommandLabels();
    castBtn.disabled = !canCast;
    castBtn.style.opacity = canCast ? '1' : '0.6';
    castBtn.style.cursor = canCast ? 'pointer' : 'not-allowed';
  });

  // Update vitals gauge
  window.addEventListener('ui:updateVitals', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const hpVal = Number(e?.detail?.hp ?? 0), hpMax = Math.max(1, Number(e?.detail?.maxHp ?? 1));
    const mpVal = Number(e?.detail?.mana ?? 0), mpMax = Math.max(1, Number(e?.detail?.maxMana ?? 1));
    const stVal = Number(e?.detail?.stamina ?? 0), stMax = Math.max(1, Number(e?.detail?.maxStamina ?? 1));
    const hpf = Math.max(0, Math.min(1, hpVal / hpMax));
    const mpf = Math.max(0, Math.min(1, mpVal / mpMax));
    const stf = Math.max(0, Math.min(1, stVal / stMax));
    vitalsGauge.set({
      health: hpf,
      mana: mpf,
      stamina: stf,
      hpValue: hpVal,
      hpMax,
      manaValue: mpVal,
      manaMax: mpMax,
      staminaValue: stVal,
      staminaMax: stMax,
    });
  });

  // Update combat HUD details
  window.addEventListener('ui:updateCombatHUD', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const weapon = e?.detail?.weapon || null;
    const ranged = e?.detail?.ranged || null;
    const statuses = Array.isArray(e?.detail?.statuses) ? e.detail.statuses : [];
    const affixes = Array.isArray(e?.detail?.affixes) ? e.detail.affixes : [];
    const posture = String(e?.detail?.posture || 'balanced').toLowerCase();

    const rangedCount = Math.max(0, Number(ranged?.count || 0) | 0);
    const ammoCount = Math.max(0, Number(e?.detail?.ammo ?? 0) | 0);

    // Shoot button label follows ranged item type
    let rangedLabel = 'Shoot';
    let rangedIcon = ACTION_ICONS.shoot;
    if (ranged?.isWand) {
      rangedLabel = `Zap (${rangedCount})`;
      rangedIcon = ACTION_ICONS.zap;
    }
    else if (ranged) rangedLabel = `Shoot (${ammoCount})`;
    setDesktopLabel(shootBtn, rangedLabel);
    setMobileLabel(shootBtn, rangedLabel);
    setDesktopIcon(shootBtn, rangedIcon);
    setMobileIcon(shootBtn, rangedIcon);

    if (posture === 'aggressive') {
      setDesktopLabel(postureBtn, 'Posture: Aggressive');
      setMobileLabel(postureBtn, 'Aggressive');
      setDesktopIcon(postureBtn, ACTION_ICONS.postureAggressive);
      setMobileIcon(postureBtn, ACTION_ICONS.postureAggressive);
      setBarLabel(postureBtn, 'Aggro');
      postureBtn.style.borderColor = '#69412a';
    } else if (posture === 'guarded') {
      setDesktopLabel(postureBtn, 'Posture: Guarded');
      setMobileLabel(postureBtn, 'Guarded');
      setDesktopIcon(postureBtn, ACTION_ICONS.postureGuarded);
      setMobileIcon(postureBtn, ACTION_ICONS.postureGuarded);
      setBarLabel(postureBtn, 'Guard');
      postureBtn.style.borderColor = '#2a4f69';
    } else {
      setDesktopLabel(postureBtn, 'Posture: Balanced');
      setMobileLabel(postureBtn, 'Balanced');
      setDesktopIcon(postureBtn, ACTION_ICONS.postureBalanced);
      setMobileIcon(postureBtn, ACTION_ICONS.postureBalanced);
      setBarLabel(postureBtn, 'Balance');
      postureBtn.style.borderColor = '#2d3b52';
    }
    refreshCommandLabels();

    // Effects stack (badges + pie timers)
    ensureEffectsStack(statusRow).update(statuses);

    // Affix chips (equipped gear effects)
    affixRow.innerHTML = '';
    if (affixes.length) {
      for (const name of affixes) {
        const chip = document.createElement('div');
        chip.textContent = String(name);
        Object.assign(chip.style, {
          fontSize: '11px', padding: '2px 6px', borderRadius: '999px',
          background: 'rgba(180,120,255,0.15)', color: '#e6d6ff', border: '1px solid #3b2d52'
        });
        affixRow.appendChild(chip);
      }
    }

    // Weapon coating chip
    const coating = weapon?.coating;
    if (coating && coating.kind) {
      const charges = Number(coating.charges || 0);
      const chip = document.createElement('div');
      const coatColor = coating.color || '#88ee88';
      chip.textContent = `\u2022 ${String(coating.kind)}` + (charges > 0 ? ` (${charges})` : '');
      Object.assign(chip.style, {
        fontSize: '11px', padding: '2px 6px', borderRadius: '999px',
        background: 'rgba(80,200,80,0.18)', color: coatColor, border: '1px solid #2d5234'
      });
      affixRow.appendChild(chip);
    }
  });

  // --- Action bar spell slots (WoW-style, desktop only) ---
  const spellSlotsContainer = document.createElement('div');
  Object.assign(spellSlotsContainer.style, {
    display: 'flex', gap: '4px', alignItems: 'center',
  });
  const SPELL_SLOT_COUNT = 6;
  /** @type {HTMLButtonElement[]} */
  const _slotBtns = [];
  /** @type {string} */
  let _lastSlotFingerprint = '';

  function buildSlotButton(index) {
    const btn = document.createElement('button');
    btn.dataset.slotIndex = String(index);
    Object.assign(btn.style, {
      position: 'relative',
      minHeight: '44px', minWidth: '44px',
      padding: '8px 10px', borderRadius: '6px',
      border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
      cursor: 'pointer', fontSize: '22px', lineHeight: '1',
      display: 'grid', placeItems: 'center', whiteSpace: 'nowrap',
      touchAction: 'manipulation', opacity: '0.4',
    });
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('ui:castSpellSlot', { detail: { slot: index } }));
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ui:openSpellPicker', { detail: { bindSlot: index } }));
    });
    btn.addEventListener('mousedown', (e) => {
      if (e.shiftKey && e.button === 0) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ui:openSpellPicker', { detail: { bindSlot: index } }));
      }
    });
    return btn;
  }

  for (let i = 0; i < SPELL_SLOT_COUNT; i++) {
    const btn = buildSlotButton(i);
    _slotBtns.push(btn);
    spellSlotsContainer.appendChild(btn);
  }

  function refreshSpellSlots(detail) {
    const slots = Array.isArray(detail?.slots) ? detail.slots : [];
    const activeId = detail?.activeSpellId || null;
    const mana = Number(detail?.mana || 0);
    const stamina = Number(detail?.stamina || 0);

    // Fingerprint includes cooldown state so UI updates each tick while any CD is active
    const fp = JSON.stringify(slots.map(s => {
      if (!s) return '';
      return s.id + ':' + (s.cdRemaining || 0);
    })) + '|' + (activeId || '') + '|' + mana + '|' + stamina;
    if (fp === _lastSlotFingerprint) return;
    _lastSlotFingerprint = fp;

    for (let i = 0; i < SPELL_SLOT_COUNT; i++) {
      const btn = _slotBtns[i];
      const spell = (i < slots.length) ? slots[i] : null;
      btn.textContent = '';

      const iconSpan = document.createElement('span');
      iconSpan.style.lineHeight = '1';

      const cdRemaining = Number(spell?.cdRemaining || 0);
      const cdMax = Number(spell?.cdMax || 0);
      const onCooldown = cdRemaining > 0 && cdMax > 0;

      if (spell && spell.id) {
        iconSpan.textContent = spell.symbol || ACTION_ICONS.cast;
        const resource = String(spell.costKind || 'mana');
        const canAfford = (resource === 'stamina' ? stamina : mana) >= Number(spell.cost || 0);
        btn.style.opacity = (canAfford && !onCooldown) ? '1' : '0.5';
        const isActive = spell.id === activeId;
        btn.style.borderColor = isActive ? '#6b8fbf' : '#2d3b52';
        btn.style.background = isActive ? '#152035' : '#101626';
        const cdTip = onCooldown ? ` [${cdRemaining} turns]` : '';
        const label = resource === 'stamina' ? 'stamina' : resource === 'life' ? 'life' : 'mana';
        btn.title = `${spell.name || spell.id} (${spell.cost || 0} ${label})${cdTip}`;
        btn.setAttribute('aria-label', btn.title);
        btn.disabled = false;
      } else {
        iconSpan.textContent = String(i + 1);
        iconSpan.style.fontSize = '14px';
        iconSpan.style.opacity = '0.4';
        btn.style.opacity = '0.3';
        btn.style.borderColor = '#2d3b52';
        btn.style.background = '#101626';
        btn.title = `Slot ${i + 1} (empty)`;
        btn.setAttribute('aria-label', btn.title);
        btn.disabled = true;
      }

      btn.appendChild(iconSpan);

      // Cooldown clock-sweep overlay
      if (onCooldown) {
        const pct = (1 - cdRemaining / cdMax) * 100;
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position: 'absolute', inset: '0', borderRadius: '6px',
          background: `conic-gradient(from 0deg, transparent ${pct}%, rgba(0,0,0,0.65) ${pct}%)`,
          pointerEvents: 'none', zIndex: '1',
        });
        btn.appendChild(overlay);

        // Turns remaining number
        const cdLabel = document.createElement('span');
        cdLabel.textContent = String(cdRemaining);
        Object.assign(cdLabel.style, {
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '15px', fontWeight: 'bold', lineHeight: '1',
          color: '#ff9999', textShadow: '0 0 4px #000, 0 0 2px #000',
          pointerEvents: 'none', zIndex: '2',
        });
        btn.appendChild(cdLabel);
      }

      // Bar label (spell name)
      if (spell && spell.name) {
        const labelSpan = document.createElement('span');
        labelSpan.textContent = spell.name.length > 6 ? spell.name.slice(0, 5) + '\u2026' : spell.name;
        Object.assign(labelSpan.style, {
          position: 'absolute', bottom: '1px', left: '0', right: '0',
          textAlign: 'center', fontSize: '11px', lineHeight: '1',
          opacity: '0.95', letterSpacing: '0.3px', pointerEvents: 'none',
          zIndex: '3', textShadow: '0 0 3px #000, 0 1px 2px #000',
        });
        btn.appendChild(labelSpan);
      }

      // Key hint
      const keySpan = document.createElement('span');
      keySpan.textContent = String(i + 1);
      Object.assign(keySpan.style, {
        position: 'absolute', top: '2px', right: '4px',
        fontSize: '9px', lineHeight: '1', opacity: '0.8',
        pointerEvents: 'none', fontFamily: 'monospace',
        zIndex: '3',
      });
      btn.appendChild(keySpan);
    }
  }

  window.addEventListener('ui:updateSpellBar', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    if (mobileLayoutMq.matches) return;
    refreshSpellSlots(e?.detail);
    syncActionBarHeight();
  });

  // Right-aligned bar: compact core actions only.
  pinSlots = createPinnedItemSlots();
  const quick = createQuickSlot({
    onPinItem: (item) => pinSlots.pinItem(item),
  });
  pinSlots.setPresenter((item) => quick.presentItem(item));
  bar.appendChild(charBtn);
  bar.appendChild(bagBtn);
  bar.appendChild(petBtn);
  bar.appendChild(castBtn);
  bar.appendChild(spellSelectBtn);
  bar.appendChild(quickInteractBtn);
  bar.appendChild(postureBtn);
  bar.appendChild(pinSlots.el);
  bar.appendChild(spellSlotsContainer);
  bar.appendChild(prayBtn);
  bar.appendChild(waitBtn);
  bar.appendChild(shootBtn);
  root.appendChild(bar);
  root.appendChild(quick.el);

  // --- Channeling overlay (progress bar + cancel button) ---
  const channelingOverlay = createChannelingOverlay();
  root.appendChild(channelingOverlay.el);

  // --- Mobile radial spell button ---
  const mobileRadial = createMobileSpellRadial(mobileLayoutMq);
  _mobileRadialEl = mobileRadial.el;
  root.appendChild(mobileRadial.el);

  // --- Pinned spell dock (row of mini-radials to the left of main radial) ---
  const pinnedSpellDock = createPinnedSpellDock(mobileLayoutMq);
  _pinnedSpellDockEl = pinnedSpellDock.el;
  _pinnedSpellDockFanEl = pinnedSpellDock.fan;
  root.appendChild(pinnedSpellDock.el);
  root.appendChild(pinnedSpellDock.fan);

  function syncQuickSlotPosition() {
    quick.syncPosition(_pinnedSpellDockEl, mobileLayoutMq);
  }

  applyCommandBarLayout();
  syncActionBarHeight();
  syncQuickSlotPosition();

  window.addEventListener('ui:updatePinnedSpellBar', () => {
    syncQuickSlotPosition();
  });

  if (typeof mobileLayoutMq.addEventListener === 'function') {
    mobileLayoutMq.addEventListener('change', () => {
      applyCommandBarLayout();
      syncActionBarHeight();
      syncQuickSlotPosition();
    });
  } else if (typeof mobileLayoutMq.addListener === 'function') {
    mobileLayoutMq.addListener(() => {
      applyCommandBarLayout();
      syncActionBarHeight();
      syncQuickSlotPosition();
    });
  }
  window.addEventListener('resize', () => {
    syncActionBarHeight();
    syncQuickSlotPosition();
  });
  if (typeof ResizeObserver !== 'undefined') {
    const obs = new ResizeObserver(() => {
      syncActionBarHeight();
      syncQuickSlotPosition();
    });
    obs.observe(bar);
  }

  return { castBtn, charBtn, bagBtn, spellSelectBtn, shootBtn, prayBtn, quickInteractBtn, postureBtn, waitBtn, petBtn };
}

// --- Effects Stack (status badges with pie timers) -------------------------
function ensureEffectsStack(container) {
  if (container.__effectsStack) return container.__effectsStack;

  /** @type {Map<string, { el: HTMLDivElement, total: number, overlay: HTMLDivElement, ticksEl: HTMLDivElement, stacksEl: HTMLDivElement }>} */
  const byKey = new Map();

  // Keyed by canonical Status.type strings from effectDefs statuses[]
  const VIS = {
    invulnerable: { name: 'Aegis',     glyph: '\u{1F6E1}\uFE0F', hue: 190 },
    invisible:    { name: 'Invisible', glyph: '\u2307',          hue: 265 },
    burning:      { name: 'Burning',   glyph: '\u{1F525}',       hue: 20  },
    poisoned:     { name: 'Poison',    glyph: '\u2620\uFE0F',    hue: 120 },
    regen:        { name: 'Regen',     glyph: '\u{1F49A}',       hue: 140 },
    stunned:      { name: 'Stunned',   glyph: '\u{1F4AB}',       hue: 45  },
    thorns:       { name: 'Thorns',    glyph: '\u{1F339}',       hue: 110 },
    disease:      { name: 'Disease',   glyph: '\u{1F9A0}',       hue: 55  },
    bleeding:     { name: 'Bleed',     glyph: '\u{1FA78}',       hue: 350 },
    shocked:      { name: 'Shocked',   glyph: '\u26A1',          hue: 55  },
    blinded:      { name: 'Blinded',   glyph: '\u{1F441}\uFE0F', hue: 260 },
    deafened:     { name: 'Deafened',  glyph: '\u{1F507}',       hue: 230 },
    electrocuted: { name: 'Electrocuted', glyph: '\u26A1',       hue: 45  },
    frozen:       { name: 'Frozen',    glyph: '\u2744\uFE0F',    hue: 200 },
    slowed:       { name: 'Slowed',    glyph: '\u{1F40C}',       hue: 195 },
    confused:     { name: 'Confused',     glyph: '\u{1F635}',       hue: 280 },
    hallucinating: { name: 'Hallucinating', glyph: '\u{1F300}',      hue: 210 },
    weakened:     { name: 'Weakened',  glyph: '\u{1FAB6}',       hue: 40  },
    cursed:       { name: 'Cursed',    glyph: '\u{1F52E}',       hue: 270 },
    blessed:      { name: 'Blessed',   glyph: '\u{1F31F}',       hue: 50  },
    stoneskin:    { name: 'Stoneskin', glyph: '\u{1FAA8}',       hue: 220 },
    taunted:      { name: 'Taunted',   glyph: '\u{1F624}',       hue: 0   },
    mindwiped:    { name: 'Mindwipe',  glyph: '\u{1F9E0}',       hue: 300 },
    berserk:      { name: 'Berserk',   glyph: '\u2694\uFE0F',    hue: 0   },
    energized:    { name: 'Energized', glyph: '\u{1F4AA}',       hue: 60  },
    mana_surge:   { name: 'Mana Surge', glyph: '\u{1F4A0}',      hue: 250 },
    lucky:        { name: 'Lucky',     glyph: '\u{1F340}',       hue: 100 },
    resist_fire:  { name: 'Fire Res',  glyph: '\u{1F9EF}',       hue: 15  },
    resist_poison: { name: 'Poison Res', glyph: '\u{1F9EA}',     hue: 130 },
    resist_electric: { name: 'Elec Res', glyph: '\u{1F50C}',     hue: 50  },
    resist_acid:  { name: 'Acid Res',  glyph: '\u{1F9F4}',       hue: 80  },
    // Corpse-eat timed buffs
    cunning_reflex:   { name: 'Reflexes',     glyph: '\u{1F4A8}',       hue: 45  },  // 💨 jittery dodge
    keen_eye:         { name: 'Keen Eye',      glyph: '\u{1F441}\uFE0F', hue: 50  },  // 👁️ predator focus
    web_immune:       { name: 'Web Immune',    glyph: '\u{1F578}\uFE0F', hue: 170 },  // 🕸️ dissolves webs
    spider_sense:     { name: 'Spider Sense',  glyph: '\u{1F577}\uFE0F', hue: 290 },  // 🕷️ danger sense
    thermal_sense:    { name: 'Heat Sight',    glyph: '\u{1F321}\uFE0F', hue: 15  },  // 🌡️ thermal vision
    bear_vigor:       { name: 'Bear Vigor',    glyph: '\u{1F43B}',       hue: 30  },  // 🐻 primal regen
    fire_blood:       { name: 'Fire Blood',    glyph: '\u{1F9E8}',       hue: 10  },  // 🧨 fire immunity
    blood_rage:       { name: 'Blood Rage',    glyph: '\u{1FA78}',       hue: 0   },  // 🩸 orcish fury
    frost_blood:      { name: 'Frost Blood',   glyph: '\u2744\uFE0F',    hue: 195 },  // ❄️ frost veins
    war_fed:          { name: 'War Fed',       glyph: '\u{1F5E1}\uFE0F', hue: 35  },  // 🗡️ iron strikes
    phase_shift:      { name: 'Phase Shift',   glyph: '\u{1F300}',       hue: 260 },  // 🌀 phasing
    ravenous:         { name: 'Ravenous',      glyph: '\u{1F924}',       hue: 25  },  // 🤤 insatiable hunger
    spectral_form:    { name: 'Spectral',      glyph: '\u{1F47B}',       hue: 210 },  // 👻 translucent
    ogre_bulk:        { name: 'Ogre Bulk',     glyph: '\u{1F9CC}',       hue: 90  },  // 🧌 brutish mass
    shadow_cloak:     { name: 'Shadow Cloak',  glyph: '\u{1F311}',       hue: 270 },  // 🌑 devastating strike
    dark_sight:       { name: 'Dark Sight',    glyph: '\u{1F440}',       hue: 280 },  // 👀 dark vision
    battle_fury:      { name: 'Battle Fury',   glyph: '\u{1F525}',       hue: 5   },  // 🔥 kill = heal
    lichdom_echo:     { name: 'Lichdom',       glyph: '\u{1F480}',       hue: 310 },  // 💀 death save
    fey_grace:        { name: 'Fey Grace',     glyph: '\u{1FAB6}',       hue: 150 },  // 🪶 wind-weave
    // Proc states (player-side)
    echo_strike_memory: { name: 'Echo',      glyph: '\u{1F47B}',    hue: 200 },  // 👻 spectral echo stored
    soul_mortgage_debt: { name: 'Soul Debt', glyph: '\u2696\uFE0F', hue: 350 },  // ⚖️ debt accruing
    // Hunger levels
    satiated:     { name: 'Satiated',  glyph: '\u{1F60B}',       hue: 130 },
    peckish:      { name: 'Peckish',   glyph: '\u{1F37D}\uFE0F', hue: 55  },
    hungry:       { name: 'Hungry',    glyph: '\u{1F356}',       hue: 35  },
    famished:     { name: 'Famished',  glyph: '\u{1F9B4}',       hue: 20  },
    starving:     { name: 'Starving',  glyph: '\u{1F480}',       hue: 5   },
    wasting:      { name: 'Wasting',   glyph: '\u2620\uFE0F',    hue: 350 },
  };

  const hsla = (h, a = 0.2) => `hsla(${h} 80% 50% / ${a})`;
  const shadowColor = (h) => `hsl(${h} 55% 35%)`;
  const VIS_SCALE = 0.8;
  const scaledPx = (px) => `${Math.max(1, Math.round(px * VIS_SCALE))}px`;

  function createBadge(spec, total) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'relative', width: scaledPx(58), height: scaledPx(58), borderRadius: scaledPx(8),
      display: 'grid', placeItems: 'center',
      boxShadow: '0 1px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)',
      outline: `1px solid ${hsla(spec.hue, 0.28)}`,
      background: hsla(spec.hue, 0.2),
    });
    el.title = `${spec.name} \u2022 ${total} turns`;

    const glyph = document.createElement('div');
    glyph.textContent = spec.glyph;
    Object.assign(glyph.style, { fontSize: scaledPx(28), lineHeight: '1', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.6))', color: shadowColor(spec.hue) });

    const label = document.createElement('div');
    Object.assign(label.style, { position: 'absolute', left: scaledPx(6), bottom: scaledPx(2), fontSize: scaledPx(10), color: 'rgba(255,255,255,.8)' });
    label.textContent = String(spec.name).split(' ')[0];

    const ticks = document.createElement('div');
    Object.assign(ticks.style, { position: 'absolute', right: scaledPx(4), bottom: scaledPx(2), fontSize: scaledPx(12), fontWeight: '700', color: '#fff', textShadow: '0 1px 0 #000, 0 0 4px rgba(0,0,0,.7)' });
    ticks.textContent = String(total);

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute', left: scaledPx(6), top: scaledPx(6), right: scaledPx(6), bottom: scaledPx(6), borderRadius: scaledPx(8), pointerEvents: 'none',
      background: 'conic-gradient(rgba(180,190,200,.2) 0deg, transparent 0)'
    });

    const stacksEl = document.createElement('div');
    Object.assign(stacksEl.style, { position: 'absolute', right: scaledPx(4), top: scaledPx(2), fontSize: scaledPx(11), fontWeight: '700', color: '#ffcc44', textShadow: '0 1px 0 #000, 0 0 4px rgba(0,0,0,.7)', zIndex: '2' });
    stacksEl.textContent = 'x1';

    el.appendChild(glyph);
    el.appendChild(label);
    el.appendChild(ticks);
    el.appendChild(overlay);
    el.appendChild(stacksEl);

    return { el, overlay, ticksEl: ticks, stacksEl };
  }

  function setAngle(rec, remaining) {
    const total = Math.max(1, rec.total | 0);
    const pct = Math.max(0, Math.min(1, remaining / total));
    const deg = (pct * 360).toFixed(2) + 'deg';
    rec.overlay.style.background = `conic-gradient(rgba(180,190,200,.2) ${deg}, transparent 0)`;
    const r = Math.max(0, remaining | 0);
    rec.ticksEl.textContent = r >= 9999 ? '\u221E' : String(r);
  }

  const MASKED_SPEC = { name: '?', glyph: '\u2753', hue: 200 };

  function update(statuses) {
    const seen = new Set();
    for (const s of (Array.isArray(statuses) ? statuses : [])) {
      const key = String(s.key || '').toLowerCase();
      if (!key) continue;
      const turns = Math.max(0, Number(s.turns || 0));
      const stacks = Math.max(1, Number(s.stacks || 1));
      const masked = !!s.masked;
      const spellFallback = !masked && !VIS[key] && s.spellGlyph ? { name: s.spellName || key, glyph: s.spellGlyph, hue: 210 } : null;
      const spec = masked ? MASKED_SPEC : (VIS[key] || spellFallback || { name: key.replace(/^./, c => c.toUpperCase()), glyph: '\u2728', hue: 210 });
      let rec = byKey.get(key);
      if (!rec) {
        const { el, overlay, ticksEl, stacksEl } = createBadge(spec, turns || 1);
        rec = { el, overlay, ticksEl, stacksEl, total: Math.max(1, turns || 1) };
        byKey.set(key, rec);
        container.appendChild(el);
      }
      rec.total = Math.max(1, Math.max(rec.total || 1, turns || 1));
      setAngle(rec, turns);
      rec.stacksEl.textContent = stacks >= 9999 ? '\u221E' : `x${stacks}`;
      seen.add(key);
    }
    for (const [key, rec] of byKey.entries()) {
      if (!seen.has(key)) {
        if (rec?.el?.parentNode === container) container.removeChild(rec.el);
        byKey.delete(key);
      }
    }
  }

  const api = { update };
  container.__effectsStack = api;
  return api;
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

// --- Singular Quick Slot (LIFO, most recent pickup first) -----------------
function createQuickSlot(opts = {}) {
  const onPinItem = typeof opts?.onPinItem === 'function' ? opts.onPinItem : null;
  const BASE_BOTTOM = 'calc(var(--jshack-actionbar-height, 48px) + 12px + env(safe-area-inset-bottom, 0px))';
  const MOBILE_DOCK_GAP_PX = 8;
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    right: '8px',
    bottom: BASE_BOTTOM,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    pointerEvents: 'auto',
    zIndex: 925,
  });

  /** @type {Array<{id:number, identity?:string, type:string, slot?:string, name:string, count:number, rarityName?:string, glyph?:string, glyphColor?:string, hasScrollOfIdentify?:boolean, details?:any, interacted?:boolean, addedAt:number}>} */
  const stack = [];
  const AUTO_DISMISS_MS = 4000;

  function normalizeQuickItem(item) {
    const id = Number(item?.id || 0) | 0;
    return {
      id,
      identity: String(item?.identity || ''),
      type: String(item?.type || ''),
      slot: String(item?.slot || ''),
      name: String(item?.name || 'item'),
      count: normalizePositiveCount(item?.count),
      rarityName: String(item?.rarityName || 'common'),
      glyph: String(item?.glyph || ''),
      glyphColor: String(item?.glyphColor || ''),
      hasScrollOfIdentify: !!item?.hasScrollOfIdentify,
      canApply: !!item?.canApply,
      applyTargetCount: Math.max(0, Number(item?.applyTargetCount || 0) | 0),
      justPickedUp: !!item?.justPickedUp,
      interacted: false,
      details: item?.details || item,
    };
  }

  function actionable(it) {
    return isQuickChipActionable(it);
  }

  let dismissTimer = 0;
  let fadeTimer = 0;
  function stopFadeForTopChip() {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (fadeTimer) clearTimeout(fadeTimer);
    dismissTimer = 0;
    fadeTimer = 0;
    const topChip = el.firstElementChild instanceof HTMLElement ? el.firstElementChild : null;
    if (topChip) {
      topChip.style.transition = '';
      topChip.style.opacity = '1';
    }
  }

  function markTopInteracted() {
    const top = peekStackTop(stack);
    if (!top) return;
    top.interacted = true;
    stopFadeForTopChip();
  }

  function resetDismissTimer() {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (fadeTimer) clearTimeout(fadeTimer);
    if (stack.length === 0) return;
    const top = peekStackTop(stack);
    if (top?.interacted) {
      stopFadeForTopChip();
      return;
    }
    const topChip = el.firstElementChild instanceof HTMLElement ? el.firstElementChild : null;
    if (topChip) {
      topChip.style.opacity = '1';
      topChip.style.transition = `opacity ${AUTO_DISMISS_MS}ms linear`;
      fadeTimer = setTimeout(() => {
        topChip.style.opacity = '0';
      }, 16);
    }
    dismissTimer = setTimeout(() => {
      stack.pop();
      renderStack();
      resetDismissTimer();
    }, AUTO_DISMISS_MS);
  }

  function renderStack(opts) {
    el.innerHTML = '';
    const it = peekStackTop(stack);
    if (!it) return;
    const chip = renderQuickChip(it, {
      startExpanded: !!(opts && opts.startExpanded),
      onUse: () => dispatchAction(it),
      onThrow: Number(it?.id || 0) > 0 ? () => dispatchThrow(it) : null,
      onDrop: Number(it?.id || 0) > 0 ? () => dispatchDrop(it) : null,
      onPin: Number(it?.id || 0) > 0 && onPinItem ? () => dispatchPin(it) : null,
      onInteracted: () => markTopInteracted(),
      onDismiss: () => dismissTop()
    });
    el.appendChild(chip);
  }

  function dispatchAction(it) {
    const action = getQuickChipPrimaryAction(it);
    if (action === 'apply') {
      window.dispatchEvent(new CustomEvent('ui:openApplyForTool', { detail: { toolId: it.id } }));
    } else if (action === 'equip') {
      window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
    } else if (action === 'drink') {
      window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    } else {
      window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
    }
  }

  function dispatchThrow(it) {
    if (!(Number(it?.id || 0) > 0)) return;
    window.dispatchEvent(new CustomEvent('ui:requestThrow', { detail: { itemId: it.id } }));
    dismissTop();
  }

  function dispatchDrop(it) {
    if (!(Number(it?.id || 0) > 0)) return;
    window.dispatchEvent(new CustomEvent('ui:requestDrop', { detail: { itemId: it.id } }));
    dismissTop();
  }

  function dispatchPin(it) {
    if (!(Number(it?.id || 0) > 0) || !onPinItem) return;
    onPinItem(it);
    dismissTop();
  }

  function dismissTop() {
    stack.pop();
    renderStack();
    resetDismissTimer();
  }

  function presentItem(item) {
    const normalized = normalizeQuickItem(item);
    if (!(normalized.id > 0)) return;
    const idx = stack.findIndex((x) => x && x.id === normalized.id);
    if (idx >= 0) stack.splice(idx, 1);
    stack.push(normalized);
    renderStack({ startExpanded: true });
    resetDismissTimer();
  }

  window.addEventListener('ui:recentPickup', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    console.debug('[quickSlot] ui:recentPickup received:', item);
    if (!item) return;
    const idx = stack.findIndex((x) => x && x.id === item.id);
    if (idx >= 0) stack.splice(idx, 1);
    stack.push(normalizeQuickItem({ ...item, justPickedUp: true }));
    const top = peekStackTop(stack);
    console.debug('[quickSlot] stack after push:', JSON.stringify(stack), 'actionable[top]:', top ? actionable(top) : 'empty');
    renderStack();
    resetDismissTimer();
  });

  window.addEventListener('ui:itemEquipped', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = Number(e?.detail?.itemId || 0);
    if (!id) return;
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) { stack.splice(idx, 1); renderStack(); resetDismissTimer(); }
  });

  window.addEventListener('ui:itemUsed', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = Number(e?.detail?.itemId || 0);
    if (!id) return;
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) {
      stack.splice(idx, 1);
      renderStack();
      resetDismissTimer();
    }
  });

  window.addEventListener('ui:itemIdentified', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    if (!item) return;
    const id = Number(item.id || 0);
    if (!id) return;
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) {
      stack.splice(idx, 1);
      stack.push(normalizeQuickItem(item));
      renderStack();
      resetDismissTimer();
    }
  });

  function syncPosition(anchorEl, mobileLayout) {
    const isMobile = !!mobileLayout?.matches;
    if (!isMobile || !(anchorEl instanceof HTMLElement)) {
      el.style.bottom = BASE_BOTTOM;
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      el.style.bottom = BASE_BOTTOM;
      return;
    }
    const bottomPx = Math.max(0, Math.round(window.innerHeight - rect.top + MOBILE_DOCK_GAP_PX));
    el.style.bottom = `${bottomPx}px`;
  }

  return { el, presentItem, syncPosition };
}

function createPinnedItemSlots() {
  const SLOT_COUNT = 4;
  const HOLD_TOOLTIP_MS = 450;
  const el = document.createElement('div');
  el.id = 'hud-pinned-items';
  Object.assign(el.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 44px)',
    gridTemplateRows: 'repeat(2, 44px)',
    gap: '4px',
    alignItems: 'center',
  });

  /** @type {Array<{id:number,pinKey?:string,identity?:string,type?:string,slot?:string,name:string,count:number,rarityName?:string,glyph?:string,glyphColor?:string,hasScrollOfIdentify?:boolean,details?:any}>} */
  let pinned = [];
  /** @type {Array<any>} */
  let inventoryItems = [];
  let didSeedStarterPins = false;
  /** @type {((item:any) => void) | null} */
  let presenter = null;
  /** @type {HTMLButtonElement[]} */
  const buttons = [];
  /** @type {Array<{svg: SVGSVGElement, path: SVGPathElement, pathLength: number}>} */
  const holdRings = [];
  /** @type {Array<{timer:number, raf:number, startedAt:number, pointerId:number, lastX:number, longPress:boolean, suppressClickUntil:number}>} */
  const holdStates = [];
  const SLIDE_STEP_PX = 28;
  /** @type {{active:boolean, index:number, anchorSlot:number}} */
  const browseState = { active: false, index: -1, anchorSlot: -1 };

  let tooltipEl = null;
  /** @type {HTMLElement | null} */
  let tooltipAnchor = null;

  function ensurePinnedTooltip() {
    if (tooltipEl) return tooltipEl;
    const root = ensureRoot();
    const tip = document.createElement('div');
    tip.id = 'quick-slot-item-tooltip';
    Object.assign(tip.style, {
      position: 'fixed',
      display: 'none',
      maxWidth: 'min(92vw, 360px)',
      pointerEvents: 'none',
      background: 'rgba(14,18,26,0.96)',
      color: '#dbeaff',
      borderRadius: '10px',
      border: '1px solid #33435f',
      boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
      fontFamily: 'monospace',
      padding: '10px 12px',
      zIndex: '1402',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      fontSize: '13px',
    });
    root.appendChild(tip);
    tooltipEl = tip;
    return tip;
  }

  function emitPinnedQuickItems() {
    const pinKeys = pinned.map((entry) => getQuickPinKey(entry)).filter(Boolean);
    window.dispatchEvent(new CustomEvent('ui:pinnedQuickItems', {
      detail: {
        pinKeys,
        pinned: pinned.slice(),
      },
    }));
  }

  function hidePinnedTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
    tooltipAnchor = null;
  }

  /**
   * @param {HTMLElement} anchor
   */
  function positionPinnedTooltip(anchor) {
    if (!tooltipEl || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth;
    const th = tooltipEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MARGIN = 8;
    const GAP = 10;

    let x = rect.left + (rect.width / 2) - (tw / 2);
    let y = rect.top - th - GAP;
    if (y < MARGIN) y = rect.bottom + GAP;
    if (y + th > vh - MARGIN) y = Math.max(MARGIN, vh - th - MARGIN);
    x = Math.max(MARGIN, Math.min(vw - tw - MARGIN, x));

    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  /**
   * @param {any} item
   * @param {HTMLElement} anchor
   */
  function showPinnedTooltip(item, anchor) {
    if (!item || !anchor) return;
    const tip = ensurePinnedTooltip();
    const detailItem = item?.details && typeof item.details === 'object'
      ? item.details
      : {
          id: item.id,
          identity: item.identity,
          type: item.type,
          slot: item.slot,
          name: item.name,
          count: item.count,
          rarityName: item.rarityName,
          glyph: item.glyph,
          glyphColor: item.glyphColor,
        };
    renderItemDetails(tip, detailItem);
    tip.style.display = 'block';
    tooltipAnchor = anchor;
    positionPinnedTooltip(anchor);
  }

  /**
   * @param {any} item
   */
  function normalizeTooltipItem(item) {
    if (!item || typeof item !== 'object') return null;
    const id = Number(item?.id || 0) | 0;
    return {
      ...item,
      id,
      identity: String(item?.identity || item?.details?.identity || ''),
      name: String(item?.name || item?.details?.name || 'item'),
      type: String(item?.type || item?.details?.type || ''),
      slot: String(item?.slot || item?.details?.slot || ''),
      count: normalizePositiveCount(item?.count),
      rarityName: String(item?.rarityName || item?.details?.rarityName || 'common'),
      glyph: String(item?.glyph || item?.details?.glyph || ''),
      glyphColor: String(item?.glyphColor || item?.details?.glyphColor || ''),
      details: item?.details || item,
    };
  }

  function tooltipBrowsePool() {
    const pool = [];
    for (const raw of inventoryItems) {
      const normalized = normalizeTooltipItem(raw);
      if (!normalized) continue;
      if (!(Number(normalized.count || 0) > 0)) continue;
      pool.push(normalized);
    }
    return pool;
  }

  /**
   * @param {Array<any>} pool
   * @param {any} item
   * @returns {number}
   */
  function findTooltipItemIndex(pool, item) {
    if (!Array.isArray(pool) || pool.length <= 0) return -1;
    const id = Number(item?.id || 0) | 0;
    if (id > 0) {
      const byId = pool.findIndex((entry) => Number(entry?.id || 0) === id);
      if (byId >= 0) return byId;
    }
    const identity = String(item?.identity || item?.details?.identity || '');
    if (identity) {
      const byIdentity = pool.findIndex((entry) => String(entry?.identity || '') === identity);
      if (byIdentity >= 0) return byIdentity;
    }
    return 0;
  }

  /**
   * @param {number} dir
   */
  function browseTooltip(dir = 1) {
    if (!browseState.active) return;
    if (!(browseState.anchorSlot >= 0 && browseState.anchorSlot < buttons.length)) return;
    const anchorBtn = buttons[browseState.anchorSlot];
    if (!anchorBtn) return;
    const pool = tooltipBrowsePool();
    if (!pool.length) return;
    if (!(browseState.index >= 0 && browseState.index < pool.length)) {
      browseState.index = 0;
    } else {
      const step = dir >= 0 ? 1 : -1;
      browseState.index = (browseState.index + step + pool.length) % pool.length;
    }
    showPinnedTooltip(pool[browseState.index], anchorBtn);
  }

  /**
   * @param {number} slotIndex
   */
  function commitBrowsedTooltipToSlot(slotIndex) {
    if (!(slotIndex >= 0 && slotIndex < SLOT_COUNT)) return;
    const pool = tooltipBrowsePool();
    if (!pool.length) return;
    const idx = Math.max(0, Math.min(pool.length - 1, Number(browseState.index || 0)));
    const selected = normalizeTooltipItem(pool[idx]);
    if (!selected) return;
    const pinKey = getQuickPinKey(selected);
    if (!pinKey) return;
    pinned[slotIndex] = { ...selected, pinKey };
    render();
    emitPinnedQuickItems();
  }

  function resetHoldRing(index) {
    const ring = holdRings[index];
    if (!ring) return;
    ring.svg.style.opacity = '0';
    ring.path.style.strokeDashoffset = String(ring.pathLength);
  }

  /**
   * @param {number} index
   * @param {number} progress
   */
  function setHoldRingProgress(index, progress) {
    const ring = holdRings[index];
    if (!ring) return;
    const p = Math.max(0, Math.min(1, Number(progress || 0)));
    ring.svg.style.opacity = p > 0 ? '1' : '0';
    ring.path.style.strokeDashoffset = String(ring.pathLength * (1 - p));
  }

  function buildHoldRing() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    Object.assign(svg.style, {
      position: 'absolute',
      left: '-2px',
      top: '-2px',
      width: '48px',
      height: '48px',
      pointerEvents: 'none',
      zIndex: '4',
      opacity: '0',
      transition: 'opacity 120ms ease',
      filter: 'drop-shadow(0 0 2px rgba(95,179,255,0.35))',
    });
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M 9 2 H 39 A 7 7 0 0 1 46 9 V 39 A 7 7 0 0 1 39 46 H 9 A 7 7 0 0 1 2 39 V 9 A 7 7 0 0 1 9 2 Z');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#5fb3ff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    const pathLength = path.getTotalLength();
    path.style.strokeDasharray = String(pathLength);
    path.style.strokeDashoffset = String(pathLength);
    svg.appendChild(path);
    return { svg, path, pathLength };
  }

  /**
   * @param {number} index
   */
  function cancelHold(index) {
    const state = holdStates[index];
    if (!state) return;
    if (state.timer) { clearTimeout(state.timer); state.timer = 0; }
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    state.startedAt = 0;
    state.pointerId = -1;
    state.lastX = 0;
    const wasLongPress = state.longPress;
    state.longPress = false;
    resetHoldRing(index);
    if (!wasLongPress) hidePinnedTooltip();
  }

  /**
   * @param {number} index
   */
  function startHold(index) {
    const state = holdStates[index];
    if (!state) return;
    const startAt = state.startedAt;
    const tick = () => {
      const elapsed = Math.max(0, performance.now() - startAt);
      setHoldRingProgress(index, elapsed / HOLD_TOOLTIP_MS);
      if (holdStates[index]?.timer) {
        state.raf = requestAnimationFrame(tick);
      }
    };
    state.raf = requestAnimationFrame(tick);
  }

  function render() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const btn = buttons[i];
      const ring = holdRings[i];
      const item = pinned[i] || null;
      btn.textContent = '';
      if (!item) {
        cancelHold(i);
        btn.title = `Quick item slot ${i + 1} (empty)`;
        btn.setAttribute('aria-label', btn.title);
        btn.style.opacity = '0.35';
        btn.style.borderColor = '#2d3b52';
        btn.style.background = '#101626';
        btn.disabled = true;
        const key = document.createElement('span');
        key.textContent = String(i + 1);
        Object.assign(key.style, {
          fontSize: '11px',
          opacity: '0.55',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        });
        btn.appendChild(key);
        if (ring) btn.appendChild(ring.svg);
        continue;
      }
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.borderColor = '#4c647f';
      btn.style.background = '#101b2a';
      btn.title = `${item.name || 'Item'} x${normalizePositiveCount(item.count)}`;
      btn.setAttribute('aria-label', btn.title);
      const icon = document.createElement('span');
      icon.textContent = item.glyph || '⬢';
      Object.assign(icon.style, {
        lineHeight: '1',
        fontSize: '20px',
        color: item.glyphColor || '#cfe8ff',
        pointerEvents: 'none',
      });
      btn.appendChild(icon);
      const countBadge = document.createElement('span');
      countBadge.textContent = String(normalizePositiveCount(item.count));
      Object.assign(countBadge.style, {
        position: 'absolute',
        right: '3px',
        bottom: '2px',
        fontSize: '10px',
        lineHeight: '1',
        minWidth: '10px',
        textAlign: 'right',
        color: '#cfe8ff',
        background: 'rgba(16,22,38,0.8)',
        borderRadius: '3px',
        padding: '1px 2px',
        pointerEvents: 'none',
      });
      btn.appendChild(countBadge);
      if (ring) btn.appendChild(ring.svg);
    }
    if (tooltipEl && tooltipEl.style.display === 'block' && tooltipAnchor) {
      positionPinnedTooltip(tooltipAnchor);
    }
  }

  /**
   * Add or refresh a pinned quick-use item, evicting the oldest entry when full.
   * @param {{id:number,name?:string,count?:number,glyph?:string,glyphColor?:string}} item
   */
  function pinItem(item) {
    pinned = upsertPinnedQuickItemLifo(pinned, item, SLOT_COUNT);
    render();
    emitPinnedQuickItems();
  }

  function removeByPinKeyOrId(pinKeyOrId) {
    const key = String(pinKeyOrId || '');
    const id = Number(pinKeyOrId || 0) | 0;
    if (!key && !(id > 0)) return;
    const before = pinned.length;
    pinned = pinned.filter((entry) => {
      const entryKey = getQuickPinKey(entry);
      if (entryKey && key && entryKey === key) return false;
      return Number(entry?.id || 0) !== id;
    });
    if (pinned.length !== before) {
      render();
      emitPinnedQuickItems();
    }
  }

  for (let i = 0; i < SLOT_COUNT; i++) {
    const btn = document.createElement('button');
    const ring = buildHoldRing();
    holdRings.push(ring);
    holdStates.push({
      timer: 0,
      raf: 0,
      startedAt: 0,
      pointerId: -1,
      lastX: 0,
      longPress: false,
      suppressClickUntil: 0,
    });
    btn.dataset.quickItemSlot = String(i);
    Object.assign(btn.style, {
      position: 'relative',
      minHeight: '44px',
      minWidth: '44px',
      width: '44px',
      padding: '8px 4px',
      borderRadius: '6px',
      border: '1px solid #2d3b52',
      background: '#101626',
      color: '#cfe8ff',
      cursor: 'pointer',
      fontSize: '22px',
      lineHeight: '1',
      display: 'grid',
      placeItems: 'center',
      touchAction: 'manipulation',
    });
    btn.addEventListener('pointerdown', (e) => {
      if ((e.pointerType === 'mouse' && e.button !== 0) || btn.disabled) return;
      const item = pinned[i];
      if (!item) return;
      const state = holdStates[i];
      cancelHold(i);
      hidePinnedTooltip();
      state.pointerId = Number(e.pointerId);
      state.startedAt = performance.now();
      state.lastX = Number(e.clientX || 0);
      state.longPress = false;
      browseState.active = false;
      browseState.anchorSlot = i;
      browseState.index = -1;
      try { btn.setPointerCapture(e.pointerId); } catch {}
      state.timer = setTimeout(() => {
        state.timer = 0;
        state.longPress = true;
        state.suppressClickUntil = performance.now() + 650;
        btn.style.borderColor = '#5fb3ff';
        btn.style.background = '#122138';
        browseState.active = true;
        browseState.anchorSlot = i;
        const pool = tooltipBrowsePool();
        const idx = findTooltipItemIndex(pool, item);
        browseState.index = idx;
        if (idx >= 0 && pool[idx]) {
          showPinnedTooltip(pool[idx], btn);
        } else {
          showPinnedTooltip(item, btn);
        }
      }, HOLD_TOOLTIP_MS);
      startHold(i);
    });
    btn.addEventListener('pointermove', (e) => {
      const state = holdStates[i];
      if (!state.longPress) return;
      if (state.pointerId !== -1 && Number(e.pointerId) !== state.pointerId) return;
      const x = Number(e.clientX || 0);
      const dx = x - state.lastX;
      if (Math.abs(dx) < SLIDE_STEP_PX) return;
      state.lastX = x;
      browseTooltip(dx > 0 ? 1 : -1);
      e.preventDefault();
    });
    btn.addEventListener('pointerup', (e) => {
      const state = holdStates[i];
      if (state.pointerId !== -1 && Number(e.pointerId) !== state.pointerId) return;
      const wasLongPress = !!state.longPress;
      cancelHold(i);
      try { btn.releasePointerCapture(e.pointerId); } catch {}
      if (wasLongPress) {
        commitBrowsedTooltipToSlot(i);
      }
      browseState.active = false;
      browseState.anchorSlot = -1;
      browseState.index = -1;
      hidePinnedTooltip();
      btn.style.borderColor = '#4c647f';
      btn.style.background = '#101b2a';
      if (wasLongPress) {
        e.preventDefault();
      }
    });
    btn.addEventListener('pointercancel', () => {
      cancelHold(i);
      browseState.active = false;
      browseState.anchorSlot = -1;
      browseState.index = -1;
      btn.style.borderColor = '#4c647f';
      btn.style.background = '#101b2a';
    });
    btn.addEventListener('pointerleave', () => {
      const state = holdStates[i];
      if (state.pointerId === -1) return;
      cancelHold(i);
      browseState.active = false;
      browseState.anchorSlot = -1;
      browseState.index = -1;
      btn.style.borderColor = '#4c647f';
      btn.style.background = '#101b2a';
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    btn.addEventListener('click', (e) => {
      const state = holdStates[i];
      if (performance.now() < state.suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const item = pinned[i];
      if (!item || !presenter) return;
      hidePinnedTooltip();
      presenter({ ...item });
    });
    buttons.push(btn);
    el.appendChild(btn);
  }

  window.addEventListener('resize', () => {
    if (tooltipEl && tooltipEl.style.display === 'block' && tooltipAnchor) {
      positionPinnedTooltip(tooltipAnchor);
    }
  });
  document.addEventListener('pointerdown', (ev) => {
    if (!tooltipEl || tooltipEl.style.display !== 'block') return;
    const target = /** @type {Node|null} */ (ev.target);
    const insideSlot = buttons.some((btn) => btn.contains(target));
    if (!insideSlot) {
      browseState.active = false;
      browseState.anchorSlot = -1;
      browseState.index = -1;
      hidePinnedTooltip();
    }
  }, { passive: true });

  window.addEventListener('ui:itemUsed', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    hidePinnedTooltip();
    const next = applyPinnedQuickItemUse(pinned, e?.detail);
    if (arePinnedArraysEqual(next, pinned)) return;
    pinned = next;
    render();
    emitPinnedQuickItems();
  });
  window.addEventListener('ui:itemThrown', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    hidePinnedTooltip();
    const next = applyPinnedQuickItemUse(pinned, e?.detail);
    if (arePinnedArraysEqual(next, pinned)) return;
    pinned = next;
    render();
    emitPinnedQuickItems();
  });
  window.addEventListener('ui:itemEquipped', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    hidePinnedTooltip();
    removeByPinKeyOrId(e?.detail?.pinKey || e?.detail?.identity || e?.detail?.itemId);
  });
  window.addEventListener('ui:itemIdentified', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    const id = Number(item?.id || 0) | 0;
    if (!(id > 0)) return;
    const idx = pinned.findIndex((entry) => Number(entry?.id || 0) === id);
    if (idx < 0) return;
    pinned[idx] = {
      ...pinned[idx],
      ...item,
      id,
      count: normalizePositiveCount(item?.count || pinned[idx]?.count),
      details: item,
    };
    render();
    emitPinnedQuickItems();
  });
  window.addEventListener('ui:requestPinQuickItem', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    if (!item || !getQuickPinKey(item)) return;
    pinItem(item);
  });
  window.addEventListener('ui:inventoryData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    inventoryItems = Array.isArray(e?.detail?.bagItems) ? e.detail.bagItems : [];
    const bagItems = Array.isArray(e?.detail?.bagItems) ? e.detail.bagItems : [];
    if (!didSeedStarterPins && pinned.length === 0 && bagItems.length > 0) {
      didSeedStarterPins = true;
      const seeds = buildStartingPinnedQuickItems(bagItems, SLOT_COUNT);
      for (const item of seeds) {
        pinned = upsertPinnedQuickItemLifo(pinned, item, SLOT_COUNT);
      }
      if (seeds.length > 0) {
        render();
        emitPinnedQuickItems();
      }
    }
    const next = reconcilePinnedQuickItemsWithInventory(pinned, bagItems);
    if (arePinnedArraysEqual(next, pinned)) return;
    pinned = next;
    render();
    emitPinnedQuickItems();
  });

  render();
  emitPinnedQuickItems();
  // Seed starter pins as soon as the game is running (player exists, inventory available).
  // ui:updateVitals fires on the first HUD feed tick after player creation.
  function _onFirstVitals() {
    window.removeEventListener('ui:updateVitals', _onFirstVitals);
    if (!didSeedStarterPins) {
      window.dispatchEvent(new CustomEvent('ui:requestInventoryData', { detail: {} }));
    }
  }
  window.addEventListener('ui:updateVitals', _onFirstVitals);
  return {
    el,
    pinItem,
    setPresenter(fn) {
      presenter = typeof fn === 'function' ? fn : null;
    },
  };
}

// --- Channeling Overlay (progress bar + cancel button) ---------------------
function createChannelingOverlay() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 12px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    display: 'none',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 16px',
    borderRadius: '8px',
    background: 'rgba(10,14,22,0.88)',
    border: '1px solid #3b2d52',
    boxShadow: '0 0 16px rgba(120,60,200,0.2)',
    color: '#cfe8ff',
    zIndex: 950,
    pointerEvents: 'auto',
    minWidth: '280px',
    textAlign: 'center',
  });

  const label = document.createElement('div');
  Object.assign(label.style, { fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', whiteSpace: 'nowrap' });
  label.textContent = 'Channeling...';

  const barOuter = document.createElement('div');
  Object.assign(barOuter.style, {
    flex: '1', minWidth: '80px', height: '8px', borderRadius: '4px',
    background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  });
  const barInner = document.createElement('div');
  Object.assign(barInner.style, {
    width: '0%', height: '100%', borderRadius: '4px',
    background: 'linear-gradient(90deg, #7b3fbe, #b070ff)',
    transition: 'width 0.35s ease',
  });
  barOuter.appendChild(barInner);

  const progressText = document.createElement('div');
  Object.assign(progressText.style, { fontSize: '11px', opacity: '0.7', whiteSpace: 'nowrap' });
  progressText.textContent = '';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '\u00D7';
  cancelBtn.title = 'Cancel (ESC)';
  Object.assign(cancelBtn.style, {
    padding: '2px 8px',
    minHeight: '28px', minWidth: '28px',
    borderRadius: '4px',
    border: '1px solid #5a3a7a',
    background: '#2a1a3a',
    color: '#e6d6ff',
    fontSize: '14px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    lineHeight: '1',
  });
  cancelBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:cancelChanneling')); } catch {}
  });

  el.appendChild(label);
  el.appendChild(barOuter);
  el.appendChild(progressText);
  el.appendChild(cancelBtn);

  let castTime = 0;
  let channelMode = 'cast';
  let sustainManaPerTick = 0;

  window.addEventListener('ui:channeling:start', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const name = String(e?.detail?.spellName || 'Spell');
    channelMode = String(e?.detail?.mode || 'cast');
    castTime = Math.max(1, Number(e?.detail?.castTime || 1));
    sustainManaPerTick = Math.max(0, Number(e?.detail?.manaPerTick || 0));
    label.textContent = `Channeling ${name}...`;
    if (channelMode === 'sustain') {
      const manaRemaining = Math.max(0, Number(e?.detail?.manaRemaining || 0));
      const manaMax = Math.max(1, Number(e?.detail?.manaMax || manaRemaining || 1));
      const pct = Math.min(100, Math.max(0, (manaRemaining / manaMax) * 100));
      barInner.style.width = pct + '%';
      progressText.textContent = `${manaRemaining.toFixed(1)} mana, -${sustainManaPerTick}/tick`;
    } else {
      barInner.style.width = '0%';
      progressText.textContent = `0 / ${castTime}`;
    }
    el.style.display = 'flex';
  });

  window.addEventListener('ui:channeling:tick', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const mode = String(e?.detail?.mode || channelMode || 'cast');
    if (mode === 'sustain') {
      const manaRemaining = Math.max(0, Number(e?.detail?.manaRemaining || 0));
      const manaMax = Math.max(1, Number(e?.detail?.manaMax || manaRemaining || 1));
      const manaPerTick = Math.max(0, Number(e?.detail?.manaPerTick || sustainManaPerTick || 0));
      const pct = Math.min(100, Math.max(0, (manaRemaining / manaMax) * 100));
      barInner.style.width = pct + '%';
      progressText.textContent = `${manaRemaining.toFixed(1)} mana, -${manaPerTick}/tick`;
      return;
    }
    const remaining = Number(e?.detail?.turnsRemaining || 0);
    const total = Math.max(1, Number(e?.detail?.turnsTotal || castTime || 1));
    const elapsed = total - remaining;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    barInner.style.width = pct + '%';
    progressText.textContent = `${elapsed} / ${total}`;
  });

  window.addEventListener('ui:channeling:end', () => {
    el.style.display = 'none';
  });

  return { el };
}

// --- Mobile radial spell selector (bottom-right floating button) ----------
function createMobileSpellRadial(mobileLayoutMq) {
  const MICRO_UX_STYLE_ID = 'jshack-mobile-spell-radial-micro-ux';
  function ensureMicroUxStyles() {
    if (document.getElementById(MICRO_UX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MICRO_UX_STYLE_ID;
    style.textContent = `
      @keyframes jshackSpellRadialBump {
        0% { transform: scale(1.02); }
        45% { transform: scale(1.16); }
        100% { transform: scale(1.1); }
      }
      @keyframes jshackSpellRadialPulse {
        0% { box-shadow: 0 0 0 0 rgba(114, 176, 255, 0.36), 0 2px 6px rgba(0,0,0,0.42); }
        100% { box-shadow: 0 0 0 10px rgba(114, 176, 255, 0), 0 2px 6px rgba(0,0,0,0.42); }
      }
    `;
    document.head.appendChild(style);
  }
  ensureMicroUxStyles();

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    right: 'calc(12px + env(safe-area-inset-right, 0px))',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 28px + env(safe-area-inset-bottom, 0px))',
    display: 'none',
    pointerEvents: 'auto',
    zIndex: '920',
  });

  // --- Trigger button (always-visible circle) ---
  const trigger = document.createElement('button');
  Object.assign(trigger.style, {
    width: '56px', height: '56px', borderRadius: '50%',
    border: '2px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    fontSize: '26px', lineHeight: '1',
    display: 'grid', placeItems: 'center',
    cursor: 'pointer', touchAction: 'manipulation',
    position: 'relative',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    transition: 'transform 0.15s ease, border-color 0.15s ease',
  });

  const glyphSpan = document.createElement('span');
  glyphSpan.textContent = '\u2726'; // default ✦
  glyphSpan.style.lineHeight = '1';
  trigger.appendChild(glyphSpan);

  // Mana cost badge (top-right corner of trigger)
  const manaBadge = document.createElement('span');
  Object.assign(manaBadge.style, {
    position: 'absolute', top: '-4px', right: '-4px',
    fontSize: '10px', fontWeight: 'bold',
    background: '#1a2a4a', border: '1px solid #2d3b52',
    borderRadius: '8px', padding: '1px 4px',
    color: '#88bbff', pointerEvents: 'none', display: 'none',
  });
  trigger.appendChild(manaBadge);

  el.appendChild(trigger);

  // --- State ---
  let _activeSpellId = null;
  let _canCast = false;
  let _fanOpen = false;
  let _holdTimer = null;
  let _isHold = false;
  let _hoverSpellId = null;
  let _fanItems = [];
  const HOLD_THRESHOLD_MS = 350;

  // --- Fan-out container ---
  const fan = document.createElement('div');
  Object.assign(fan.style, {
    position: 'absolute',
    bottom: '0', right: '0',
    display: 'none',
    pointerEvents: 'none',
  });
  el.appendChild(fan);

  // --- Gesture handling (tap vs hold) ---
  function onPressStart() {
    _isHold = false;
    _holdTimer = setTimeout(() => {
      _isHold = true;
      openFan();
    }, HOLD_THRESHOLD_MS);
  }

  function onPressEnd(e) {
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    if (_isHold) {
      // Hold release — choose currently hovered spell (with fallback hit-test)
      let selectedSpellId = _hoverSpellId;
      if (!selectedSpellId && e && e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const item = pickClosestSpellAtPoint(touch.clientX, touch.clientY);
        selectedSpellId = item?.dataset?.spellId || null;
      }
      if (selectedSpellId) {
        window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', {
          detail: { spellId: selectedSpellId }
        }));
      }
      closeFan();
    } else {
      // Short tap — cast active spell
      window.dispatchEvent(new CustomEvent('ui:castActiveSpell'));
    }
    _isHold = false;
  }

  function onPressCancel() {
    if (_holdTimer) { clearTimeout(_holdTimer); _holdTimer = null; }
    _isHold = false;
    closeFan();
  }

  trigger.addEventListener('touchstart', (e) => {
    e.preventDefault();
    onPressStart();
  }, { passive: false });
  trigger.addEventListener('touchend', (e) => {
    e.preventDefault();
    onPressEnd(e);
  }, { passive: false });
  trigger.addEventListener('touchcancel', () => onPressCancel(), { passive: true });

  // Mouse fallback for desktop mobile emulation
  trigger.addEventListener('mousedown', (e) => { if (e.button === 0) onPressStart(); });
  trigger.addEventListener('mouseup', (e) => { if (e.button === 0) onPressEnd(e); });
  trigger.addEventListener('mouseleave', () => onPressCancel());

  // --- Fan open/close ---
  function openFan() {
    _fanOpen = true;
    _hoverSpellId = _activeSpellId;
    trigger.style.transform = 'scale(1.1)';
    trigger.style.borderColor = '#6b8fbf';
    fan.style.display = 'block';
    window.dispatchEvent(new CustomEvent('ui:requestSpellData'));
  }

  function closeFan() {
    _fanOpen = false;
    _hoverSpellId = null;
    _fanItems = [];
    trigger.style.transform = '';
    trigger.style.borderColor = '#2d3b52';
    fan.style.display = 'none';
    fan.innerHTML = '';
  }

  function setFanItemVisual(item, selected, bump = false) {
    if (!item) return;
    if (selected) {
      item.style.transform = 'scale(1.1)';
      item.style.border = '2px solid #8fc2ff';
      item.style.background = '#1b2a44';
      item.style.zIndex = '5';
      item.style.boxShadow = '0 0 0 1px rgba(155,210,255,0.45), 0 4px 12px rgba(0,0,0,0.45)';
      if (bump) {
        item.style.animation = 'none';
        // Force restart of the bump animation.
        void item.offsetWidth;
        item.style.animation = 'jshackSpellRadialBump 220ms cubic-bezier(0.2, 0.9, 0.2, 1), jshackSpellRadialPulse 360ms ease-out';
      }
    } else {
      item.style.animation = 'none';
      item.style.transform = 'scale(0.98)';
      item.style.zIndex = '1';
      item.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      item.style.border = item.dataset.baseBorder || '1px solid #2d3b52';
      item.style.background = item.dataset.baseBg || '#101626';
    }
  }

  function pickClosestSpellAtPoint(clientX, clientY) {
    if (!_fanItems.length) return null;
    let closest = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const item of _fanItems) {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        closest = item;
      }
    }
    return closest;
  }

  function updateHoverFromPoint(clientX, clientY) {
    if (!_fanOpen || !_isHold) return;
    const item = pickClosestSpellAtPoint(clientX, clientY);
    const nextId = item?.dataset?.spellId || null;
    if (!nextId || nextId === _hoverSpellId) return;
    _hoverSpellId = nextId;
    for (const fanItem of _fanItems) {
      setFanItemVisual(fanItem, fanItem.dataset.spellId === _hoverSpellId, fanItem.dataset.spellId === _hoverSpellId);
    }
  }

  // --- Fan item rendering ---
  function renderFanItems(spells, activeId) {
    fan.innerHTML = '';
    _fanItems = [];
    const count = spells.length;
    if (count === 0) return;

    // Quarter-circle arc from 90° (up) to 180° (left), facing into the game field
    const RADIUS = 90;
    const ARC_START = 90;
    const ARC_END = 180;
    const ARC_SPAN = ARC_END - ARC_START;
    const HALF_ITEM = 22; // half of 44px item

    for (let i = 0; i < count; i++) {
      const spell = spells[i];
      const angle = count === 1
        ? (ARC_START + ARC_END) / 2
        : ARC_START + (ARC_SPAN * i / (count - 1));
      const rad = angle * Math.PI / 180;
      // Position from bottom-right of trigger: right increases leftward, bottom increases upward
      const r = 28 - Math.cos(rad) * RADIUS - HALF_ITEM;
      const b = 28 + Math.sin(rad) * RADIUS - HALF_ITEM;

      const isActive = spell.id === activeId;
      const item = document.createElement('div');
      item.dataset.spellId = spell.id;
      Object.assign(item.style, {
        position: 'absolute',
        width: '44px', height: '44px', borderRadius: '50%',
        border: isActive ? '2px solid #6b8fbf' : '1px solid #2d3b52',
        background: isActive ? '#152035' : '#101626',
        color: '#cfe8ff', fontSize: '20px',
        display: 'grid', placeItems: 'center',
        right: r + 'px',
        bottom: b + 'px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        transition: 'opacity 0.14s ease, transform 0.18s cubic-bezier(0.2, 0.9, 0.2, 1), border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease',
        opacity: '0',
        transform: 'scale(0.86)',
      });
      item.dataset.baseBorder = isActive ? '2px solid #6b8fbf' : '1px solid #2d3b52';
      item.dataset.baseBg = isActive ? '#152035' : '#101626';

      const sym = document.createElement('span');
      sym.textContent = spell.symbol || '\u2726';
      sym.style.lineHeight = '1';
      sym.style.pointerEvents = 'none';
      item.appendChild(sym);

      // Spell name label
      const label = document.createElement('span');
      const name = spell.name || spell.id;
      label.textContent = name.length > 6 ? name.slice(0, 5) + '\u2026' : name;
      Object.assign(label.style, {
        position: 'absolute', bottom: '-13px', left: '-8px', right: '-8px',
        textAlign: 'center', fontSize: '9px', opacity: '0.8',
        pointerEvents: 'none', whiteSpace: 'nowrap',
        textShadow: '0 0 4px #000, 0 0 2px #000',
      });
      item.appendChild(label);

      // Cooldown overlay
      const cdRemaining = Number(spell.cdRemaining || 0);
      const cdMax = Number(spell.cdMax || 0);
      if (cdRemaining > 0 && cdMax > 0) {
        const pct = (1 - cdRemaining / cdMax) * 100;
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position: 'absolute', inset: '0', borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent ${pct}%, rgba(0,0,0,0.65) ${pct}%)`,
          pointerEvents: 'none', zIndex: '1',
        });
        item.appendChild(overlay);

        const cdLabel = document.createElement('span');
        cdLabel.textContent = String(cdRemaining);
        Object.assign(cdLabel.style, {
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '13px', fontWeight: 'bold', color: '#ff9999',
          textShadow: '0 0 4px #000', pointerEvents: 'none', zIndex: '2',
        });
        item.appendChild(cdLabel);
        item.style.opacity = '0.5';
      }

      fan.appendChild(item);
      _fanItems.push(item);

      // Stagger fade-in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (fan.contains(item)) {
            const selected = (_hoverSpellId || activeId) === spell.id;
            setFanItemVisual(item, selected, false);
            item.style.opacity = (cdRemaining > 0 && cdMax > 0) ? '0.5' : '1';
          }
        });
      });

      // Click selection (for non-hold taps on fan items when fan is already open)
      item.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', {
          detail: { spellId: spell.id }
        }));
        closeFan();
      });
    }
  }

  // --- Event listeners ---
  window.addEventListener('ui:updateActiveSpellLabel', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const symbol = String(e?.detail?.symbol || '').trim();
    const name = String(e?.detail?.name || '').trim();
    const canCast = Boolean(e?.detail?.canCast ?? true);
    const cost = Number(e?.detail?.cost || 0);
    _activeSpellId = e?.detail?.id || null;
    _canCast = canCast;

    glyphSpan.textContent = symbol || '\u2726';
    trigger.title = name || 'Cast';
    trigger.style.opacity = _activeSpellId ? (canCast ? '1' : '0.6') : '0.4';

    manaBadge.textContent = cost > 0 ? String(cost) : '';
    manaBadge.style.display = cost > 0 ? 'block' : 'none';
  });

  window.addEventListener('ui:spellData', (ev) => {
    if (!_fanOpen) return;
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const spells = e?.detail?.spells || [];
    const activeId = e?.detail?.activeSpellId || null;
    _hoverSpellId = activeId;
    renderFanItems(spells, activeId);
  });

  // Close fan when a spell overlay opens or a spell is cast
  window.addEventListener('ui:castActiveSpell', () => { if (_fanOpen) closeFan(); });

  // Close fan on outside touch
  document.addEventListener('touchstart', (e) => {
    if (_fanOpen && !el.contains(/** @type {Node} */ (e.target))) closeFan();
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!_fanOpen || !_isHold) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    e.preventDefault();
    updateHoverFromPoint(touch.clientX, touch.clientY);
  }, { passive: false });
  document.addEventListener('mousemove', (e) => {
    if (!_fanOpen || !_isHold) return;
    updateHoverFromPoint(e.clientX, e.clientY);
  }, { passive: true });

  return { el };
}

// --- Pinned spell dock (row of mini-radials above action bar, left of main radial) ---
function createPinnedSpellDock(mobileLayoutMq) {
  const SLOT_COUNT = 4;
  const HOLD_THRESHOLD_MS = 350;
  const MICRO_UX_STYLE_ID = 'jshack-pinned-spell-dock-micro-ux';
  function ensureMicroUxStyles() {
    if (document.getElementById(MICRO_UX_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MICRO_UX_STYLE_ID;
    style.textContent = `
      @keyframes jshackPinnedSpellBump {
        0% { transform: scale(1.02); }
        45% { transform: scale(1.18); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  ensureMicroUxStyles();

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    left: '8px',
    right: '8px',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 10px + env(safe-area-inset-bottom, 0px))',
    display: 'none',
    flexDirection: 'row',
    gap: '6px',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    zIndex: '919',
  });

  /** @type {{ spellId: string|null, btn: HTMLButtonElement, glyphSpan: HTMLSpanElement, manaBadge: HTMLSpanElement, cdOverlay: HTMLDivElement, cdLabel: HTMLSpanElement, holdTimer: number|null, isHold: boolean }[]} */
  const slots = [];

  /** @type {any[]|null} cached spell data from last ui:spellData response */
  let _cachedSpells = null;
  /** @type {string|null} */
  let _cachedActiveId = null;
  /** @type {number} */
  let _cachedMana = 0;

  // --- Fan overlay (shared by all slots, only one open at a time) ---
  let _fanOpenForSlot = -1;
  const fan = document.createElement('div');
  Object.assign(fan.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'none',
    zIndex: '921',
  });
  /** @type {HTMLElement[]} */
  let _fanItems = [];
  let _hoverSpellId = null;

  function closeFan() {
    _fanOpenForSlot = -1;
    _hoverSpellId = null;
    _fanItems = [];
    fan.style.display = 'none';
    fan.innerHTML = '';
    for (const s of slots) {
      s.btn.style.transform = '';
      s.btn.style.borderColor = s.spellId ? '#2d3b52' : '#1a2030';
    }
  }

  function setFanItemVisual(item, selected, bump) {
    if (!item) return;
    if (selected) {
      item.style.transform = 'scale(1.1)';
      item.style.border = '2px solid #8fc2ff';
      item.style.background = '#1b2a44';
      item.style.zIndex = '5';
      item.style.boxShadow = '0 0 0 1px rgba(155,210,255,0.45), 0 4px 12px rgba(0,0,0,0.45)';
      if (bump) {
        item.style.animation = 'none';
        void item.offsetWidth;
        item.style.animation = 'jshackPinnedSpellBump 220ms cubic-bezier(0.2, 0.9, 0.2, 1)';
      }
    } else {
      item.style.animation = 'none';
      item.style.transform = 'scale(0.96)';
      item.style.zIndex = '1';
      item.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
      item.style.border = '1px solid #2d3b52';
      item.style.background = '#101626';
    }
  }

  function pickClosestAtPoint(clientX, clientY) {
    let closest = null;
    let bestDist = Infinity;
    for (const item of _fanItems) {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; closest = item; }
    }
    return closest;
  }

  function updateHoverFromPoint(clientX, clientY) {
    if (_fanOpenForSlot < 0) return;
    const item = pickClosestAtPoint(clientX, clientY);
    const nextId = item?.dataset?.spellId || null;
    if (!nextId || nextId === _hoverSpellId) return;
    _hoverSpellId = nextId;
    for (const fi of _fanItems) {
      setFanItemVisual(fi, fi.dataset.spellId === _hoverSpellId, fi.dataset.spellId === _hoverSpellId);
    }
  }

  function openFanForSlot(slotIndex) {
    _fanOpenForSlot = slotIndex;
    const btn = slots[slotIndex].btn;
    btn.style.transform = 'scale(1.1)';
    btn.style.borderColor = '#6b8fbf';
    _hoverSpellId = slots[slotIndex].spellId;

    // Request fresh spell data; render when ui:spellData arrives
    fan.style.display = 'block';
    window.dispatchEvent(new CustomEvent('ui:requestSpellData'));
  }

  function renderFanItems(spells, activeId, slotIndex) {
    fan.innerHTML = '';
    _fanItems = [];
    const count = spells.length;
    if (count === 0) return;

    // Position fan above the slot button
    const btn = slots[slotIndex].btn;
    const rect = btn.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;

    // Vertical list above the button
    const ITEM_SIZE = 42;
    const GAP = 6;
    const totalH = count * ITEM_SIZE + (count - 1) * GAP;

    for (let i = 0; i < count; i++) {
      const spell = spells[i];
      const isSelected = spell.id === (slots[slotIndex].spellId || activeId);
      const item = document.createElement('div');
      item.dataset.spellId = spell.id;
      const yOff = totalH - (i * (ITEM_SIZE + GAP)) - ITEM_SIZE;
      Object.assign(item.style, {
        position: 'absolute',
        width: ITEM_SIZE + 'px', height: ITEM_SIZE + 'px', borderRadius: '50%',
        border: isSelected ? '2px solid #6b8fbf' : '1px solid #2d3b52',
        background: isSelected ? '#152035' : '#101626',
        color: '#cfe8ff', fontSize: '18px',
        display: 'grid', placeItems: 'center',
        left: (anchorX - ITEM_SIZE / 2) + 'px',
        top: (anchorY - yOff - ITEM_SIZE - 10) + 'px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        transition: 'opacity 0.14s ease, transform 0.18s cubic-bezier(0.2, 0.9, 0.2, 1), border-color 0.16s ease, background-color 0.16s ease',
        opacity: '0',
        transform: 'scale(0.86)',
      });

      const sym = document.createElement('span');
      sym.textContent = spell.symbol || '\u2726';
      sym.style.lineHeight = '1';
      sym.style.pointerEvents = 'none';
      item.appendChild(sym);

      // Spell name label
      const label = document.createElement('span');
      const name = spell.name || spell.id;
      label.textContent = name.length > 7 ? name.slice(0, 6) + '\u2026' : name;
      Object.assign(label.style, {
        position: 'absolute', bottom: '-13px', left: '-10px', right: '-10px',
        textAlign: 'center', fontSize: '9px', opacity: '0.8',
        pointerEvents: 'none', whiteSpace: 'nowrap',
        textShadow: '0 0 4px #000, 0 0 2px #000',
      });
      item.appendChild(label);

      // Cooldown overlay
      const cdRemaining = Number(spell.cdRemaining || 0);
      const cdMax = Number(spell.cdMax || 0);
      if (cdRemaining > 0 && cdMax > 0) {
        const pct = (1 - cdRemaining / cdMax) * 100;
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position: 'absolute', inset: '0', borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent ${pct}%, rgba(0,0,0,0.65) ${pct}%)`,
          pointerEvents: 'none', zIndex: '1',
        });
        item.appendChild(overlay);
        const cdLbl = document.createElement('span');
        cdLbl.textContent = String(cdRemaining);
        Object.assign(cdLbl.style, {
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '12px', fontWeight: 'bold', color: '#ff9999',
          textShadow: '0 0 4px #000', pointerEvents: 'none', zIndex: '2',
        });
        item.appendChild(cdLbl);
        item.style.opacity = '0.5';
      }

      fan.appendChild(item);
      _fanItems.push(item);

      // Stagger fade-in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (fan.contains(item)) {
            const selected = (_hoverSpellId || slots[slotIndex].spellId) === spell.id;
            setFanItemVisual(item, selected, false);
            if (!(cdRemaining > 0 && cdMax > 0)) item.style.opacity = '1';
          }
        });
      });

      // Click to select
      item.addEventListener('click', () => {
        applyLocalSelection(slotIndex, spell);
        window.dispatchEvent(new CustomEvent('ui:setPinnedSpell', {
          detail: { slot: slotIndex, spellId: spell.id }
        }));
        closeFan();
      });
    }
  }

  /** Immediately apply a spell selection to a slot (before the hudFeeds round-trip). */
  function applyLocalSelection(slotIndex, spell) {
    const s = slots[slotIndex];
    if (!spell) return;
    s.spellId = spell.id;
    s.glyphSpan.textContent = spell.symbol || '\u2726';
    s.glyphSpan.style.opacity = '1';
    s.btn.style.opacity = '1';
    s.btn.style.borderColor = '#2d3b52';
    s.btn.title = spell.name || spell.id;
    const cost = Number(spell.cost || spell.manaCost || 0);
    s.manaBadge.textContent = cost > 0 ? String(cost) : '';
    s.manaBadge.style.display = cost > 0 ? 'block' : 'none';
    s.cdOverlay.style.display = 'none';
    s.cdLabel.style.display = 'none';
  }

  /** Find spell data from cached spells by id. */
  function findCachedSpell(spellId) {
    if (!_cachedSpells) return null;
    for (const sp of _cachedSpells) {
      if (sp.id === spellId) return sp;
    }
    return null;
  }

  // Build slot buttons
  for (let i = 0; i < SLOT_COUNT; i++) {
    const btn = document.createElement('button');
    Object.assign(btn.style, {
      width: '40px', height: '40px', borderRadius: '50%',
      border: '1px solid #1a2030', background: 'rgba(16,22,38,0.85)',
      color: '#cfe8ff', fontSize: '18px', lineHeight: '1',
      display: 'grid', placeItems: 'center',
      cursor: 'pointer', touchAction: 'manipulation',
      position: 'relative',
      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      transition: 'transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
      opacity: '0.35',
    });

    const glyphSpan = document.createElement('span');
    glyphSpan.textContent = '+';
    glyphSpan.style.lineHeight = '1';
    glyphSpan.style.opacity = '0.4';
    btn.appendChild(glyphSpan);

    const manaBadge = document.createElement('span');
    Object.assign(manaBadge.style, {
      position: 'absolute', top: '-4px', right: '-4px',
      fontSize: '9px', fontWeight: 'bold',
      background: '#1a2a4a', border: '1px solid #2d3b52',
      borderRadius: '7px', padding: '1px 3px',
      color: '#88bbff', pointerEvents: 'none', display: 'none',
    });
    btn.appendChild(manaBadge);

    const cdOverlay = document.createElement('div');
    Object.assign(cdOverlay.style, {
      position: 'absolute', inset: '0', borderRadius: '50%',
      pointerEvents: 'none', zIndex: '1', display: 'none',
    });
    btn.appendChild(cdOverlay);

    const cdLabel = document.createElement('span');
    Object.assign(cdLabel.style, {
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      fontSize: '11px', fontWeight: 'bold', color: '#ff9999',
      textShadow: '0 0 4px #000', pointerEvents: 'none', zIndex: '2',
      display: 'none',
    });
    btn.appendChild(cdLabel);

    const slot = { spellId: null, btn, glyphSpan, manaBadge, cdOverlay, cdLabel, holdTimer: null, isHold: false };
    slots.push(slot);
    el.appendChild(btn);

    // Gesture: tap = cast, hold = open fan picker
    function onPressStart() {
      slot.isHold = false;
      slot.holdTimer = setTimeout(() => {
        slot.isHold = true;
        openFanForSlot(i);
      }, HOLD_THRESHOLD_MS);
    }

    function onPressEnd(e) {
      if (slot.holdTimer) { clearTimeout(slot.holdTimer); slot.holdTimer = null; }
      if (slot.isHold) {
        // Hold release — pick hovered spell
        let selectedId = _hoverSpellId;
        if (!selectedId && e && e.changedTouches && e.changedTouches.length > 0) {
          const touch = e.changedTouches[0];
          const item = pickClosestAtPoint(touch.clientX, touch.clientY);
          selectedId = item?.dataset?.spellId || null;
        }
        if (selectedId) {
          const sp = findCachedSpell(selectedId);
          if (sp) applyLocalSelection(i, sp);
          window.dispatchEvent(new CustomEvent('ui:setPinnedSpell', {
            detail: { slot: i, spellId: selectedId }
          }));
        }
        closeFan();
      } else if (slot.spellId) {
        // Short tap — cast this pinned spell
        window.dispatchEvent(new CustomEvent('ui:castPinnedSpell', { detail: { slot: i } }));
        // Bump animation
        btn.style.animation = 'none';
        void btn.offsetWidth;
        btn.style.animation = 'jshackPinnedSpellBump 200ms cubic-bezier(0.2, 0.9, 0.2, 1)';
      } else {
        // Empty slot tap — open fan to pick
        openFanForSlot(i);
      }
      slot.isHold = false;
    }

    function onPressCancel() {
      if (slot.holdTimer) { clearTimeout(slot.holdTimer); slot.holdTimer = null; }
      slot.isHold = false;
      if (_fanOpenForSlot === i) closeFan();
    }

    btn.addEventListener('touchstart', (e) => { e.preventDefault(); onPressStart(); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onPressEnd(e); }, { passive: false });
    btn.addEventListener('touchcancel', () => onPressCancel(), { passive: true });
    btn.addEventListener('mousedown', (e) => { if (e.button === 0) onPressStart(); });
    btn.addEventListener('mouseup', (e) => { if (e.button === 0) onPressEnd(e); });
    btn.addEventListener('mouseleave', () => onPressCancel());
  }

  // --- Refresh slot visuals from data ---
  function refreshSlots(detail) {
    const pinnedSlots = Array.isArray(detail?.pinnedSlots) ? detail.pinnedSlots : [];
    const mana = Number(detail?.mana || 0);
    const stamina = Number(detail?.stamina || 0);
    _cachedMana = mana;

    let anyAssigned = false;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const spell = (i < pinnedSlots.length) ? pinnedSlots[i] : null;
      const s = slots[i];
      s.spellId = spell?.id || null;

      if (spell && spell.id) {
        anyAssigned = true;
        s.glyphSpan.textContent = spell.symbol || '\u2726';
        s.glyphSpan.style.opacity = '1';
        const cost = Number(spell.cost || 0);
        const resource = String(spell.costKind || 'mana');
        const canAfford = (resource === 'stamina' ? stamina : mana) >= cost;
        const cdRemaining = Number(spell.cdRemaining || 0);
        const cdMax = Number(spell.cdMax || 0);
        const onCooldown = cdRemaining > 0 && cdMax > 0;

        s.btn.style.opacity = (canAfford && !onCooldown) ? '1' : '0.5';
        s.btn.style.borderColor = '#2d3b52';
        const label = resource === 'stamina' ? 'stamina' : resource === 'life' ? 'life' : 'mana';
        s.btn.title = `${spell.name || spell.id} (${cost} ${label})${onCooldown ? ` [${cdRemaining}]` : ''}`;

        s.manaBadge.textContent = cost > 0 ? String(cost) : '';
        s.manaBadge.style.display = cost > 0 ? 'block' : 'none';

        if (onCooldown) {
          const pct = (1 - cdRemaining / cdMax) * 100;
          s.cdOverlay.style.background = `conic-gradient(from 0deg, transparent ${pct}%, rgba(0,0,0,0.55) ${pct}%)`;
          s.cdOverlay.style.display = 'block';
          s.cdLabel.textContent = String(cdRemaining);
          s.cdLabel.style.display = 'block';
        } else {
          s.cdOverlay.style.display = 'none';
          s.cdLabel.style.display = 'none';
        }
      } else {
        s.glyphSpan.textContent = '+';
        s.glyphSpan.style.opacity = '0.4';
        s.btn.style.opacity = '0.35';
        s.btn.style.borderColor = '#1a2030';
        s.btn.title = 'Pin a spell (hold to choose)';
        s.manaBadge.style.display = 'none';
        s.cdOverlay.style.display = 'none';
        s.cdLabel.style.display = 'none';
      }
    }
    // Always show dock on mobile — it hosts spells + pinned quick items
    el.style.display = mobileLayoutMq.matches ? 'flex' : 'none';
  }

  // Listen for spell data responses (for fan rendering)
  window.addEventListener('ui:spellData', (ev) => {
    if (_fanOpenForSlot < 0) return;
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    _cachedSpells = e?.detail?.spells || [];
    _cachedActiveId = e?.detail?.activeSpellId || null;
    renderFanItems(_cachedSpells, _cachedActiveId, _fanOpenForSlot);
  });

  // Listen for pinned spell bar updates
  window.addEventListener('ui:updatePinnedSpellBar', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    refreshSlots(e?.detail);
  });

  // Close fan on outside touch
  document.addEventListener('touchstart', (e) => {
    if (_fanOpenForSlot >= 0 && !el.contains(/** @type {Node} */ (e.target)) && !fan.contains(/** @type {Node} */ (e.target))) closeFan();
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (_fanOpenForSlot < 0) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    e.preventDefault();
    updateHoverFromPoint(touch.clientX, touch.clientY);
  }, { passive: false });
  document.addEventListener('mousemove', (e) => {
    if (_fanOpenForSlot < 0) return;
    updateHoverFromPoint(e.clientX, e.clientY);
  }, { passive: true });

  // Close fan when a spell is cast
  window.addEventListener('ui:castActiveSpell', () => { if (_fanOpenForSlot >= 0) closeFan(); });

  // Update visibility on layout changes
  mobileLayoutMq.addEventListener('change', () => {
    if (!mobileLayoutMq.matches) {
      el.style.display = 'none';
      if (_fanOpenForSlot >= 0) closeFan();
    }
  });

  return { el, fan };
}

/** @param {{id:number,identity?:string,name:string,type:string,count:number}} it @param {{onUse:Function,onDismiss:Function,onThrow?:Function|null,onDrop?:Function|null,onPin?:Function|null,onInteracted?:Function|null}} h */
function renderQuickChip(it, h) {
  const actionable = isQuickChipActionable(it);
  const markInteracted = () => { if (typeof h.onInteracted === 'function') h.onInteracted(); };
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    display: 'flex',
    flexDirection: 'column',
    position: QUICK_CHIP_DISMISS_LAYOUT.chipPosition,
    alignItems: 'stretch',
    gap: '8px',
    padding: '6px 8px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff'
  });
  const header = document.createElement('button');
  header.type = 'button';
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '220px',
    maxWidth: '320px',
    padding: '6px 8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    color: '#cfe8ff',
    textAlign: 'left',
    cursor: 'pointer',
    paddingRight: QUICK_CHIP_DISMISS_LAYOUT.contentPaddingRight,
  });

  const glyph = document.createElement('span');
  glyph.textContent = String(it.glyph || '⬢');
  Object.assign(glyph.style, {
    fontSize: '18px',
    lineHeight: '1',
    color: String(it.glyphColor || '#cfe8ff'),
    minWidth: '18px',
    textAlign: 'center',
    pointerEvents: 'none',
  });
  header.appendChild(glyph);

  const textWrap = document.createElement('span');
  Object.assign(textWrap.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: '0',
    pointerEvents: 'none',
    flex: '1 1 auto',
  });
  const line1 = document.createElement('span');
  line1.textContent = bracketizeLabel(String(it.name || 'item'));
  Object.assign(line1.style, {
    ...rarityStyle(String(it?.rarityName || it?.details?.rarityName || 'common')),
    fontSize: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  const line2 = document.createElement('span');
  line2.textContent = getQuickChipDetailLine(it, { expanded: false });
  Object.assign(line2.style, {
    fontSize: '10px',
    opacity: '0.8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  textWrap.appendChild(line1);
  textWrap.appendChild(line2);
  header.appendChild(textWrap);

  const chevron = document.createElement('span');
  chevron.textContent = '▾';
  Object.assign(chevron.style, {
    fontSize: '12px',
    opacity: '0.85',
    pointerEvents: 'none',
  });
  header.appendChild(chevron);

  const expandedWrap = document.createElement('div');
  Object.assign(expandedWrap.style, {
    display: 'none',
    flexDirection: 'column',
    gap: '8px',
  });

  const detailPanel = document.createElement('div');
  Object.assign(detailPanel.style, {
    minWidth: '180px',
    maxWidth: '260px',
    maxHeight: '30vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '6px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
  });
  const detailItem = it.details && typeof it.details === 'object'
    ? it.details
    : {
        id: it.id,
        identity: it.identity,
        type: it.type,
        slot: it.slot,
        name: it.name,
        count: it.count,
        rarityName: it.rarityName,
        glyph: it.glyph,
        glyphColor: it.glyphColor,
      };
  renderItemDetails(detailPanel, detailItem);
  // Quick-chip header already shows item identity; hide duplicated title row in expanded details.
  if (detailPanel.firstElementChild) detailPanel.firstElementChild.remove();
  expandedWrap.appendChild(detailPanel);

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
  btn.textContent = getQuickChipPrimaryActionLabel(it);
  btn.addEventListener('click', () => {
    markInteracted();
    h.onUse && h.onUse();
  });

  let identifyBtn = null;
  if (canQuickChipIdentify(it)) {
    const hasScroll = hasScrollForIdentify(it);
    identifyBtn = document.createElement('button');
    Object.assign(identifyBtn.style, {
      padding: '6px 10px', background: '#101626',
      color: hasScroll ? '#cfe8ff' : '#556',
      border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: hasScroll ? 'pointer' : 'default',
      opacity: hasScroll ? '1' : '0.45',
    });
    identifyBtn.textContent = hasScroll ? 'Identify' : 'Identify (no scroll)';
    if (hasScroll) {
      identifyBtn.addEventListener('click', () => {
        markInteracted();
        window.dispatchEvent(new CustomEvent('ui:requestQuickChipIdentify', { detail: { targetItemId: it.id } }));
      });
    }
  }

  let throwBtn = null;
  if (typeof h.onThrow === 'function') {
    throwBtn = document.createElement('button');
    Object.assign(throwBtn.style, {
      padding: '6px 10px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
    });
    throwBtn.textContent = 'Throw';
    throwBtn.addEventListener('click', () => {
      markInteracted();
      h.onThrow && h.onThrow();
    });
  }

  let dropBtn = null;
  if (typeof h.onDrop === 'function') {
    dropBtn = document.createElement('button');
    Object.assign(dropBtn.style, {
      padding: '6px 10px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
    });
    dropBtn.textContent = 'Drop';
    dropBtn.addEventListener('click', () => {
      markInteracted();
      h.onDrop && h.onDrop();
    });
  }

  const x = document.createElement('button');
  Object.assign(x.style, {
    padding: '6px 8px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    cursor: 'pointer',
    minWidth: '28px',
    position: 'absolute',
    top: QUICK_CHIP_DISMISS_LAYOUT.top,
    right: QUICK_CHIP_DISMISS_LAYOUT.right,
  });
  x.textContent = '\u00D7';
  x.title = 'Dismiss';
  x.addEventListener('click', () => {
    markInteracted();
    h.onDismiss && h.onDismiss();
  });
  let pinBtn = null;
  if (typeof h.onPin === 'function') {
    pinBtn = document.createElement('button');
    Object.assign(pinBtn.style, {
      padding: '6px 8px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52',
      borderRadius: '6px',
      cursor: 'pointer',
      minWidth: '28px',
      position: 'absolute',
      top: QUICK_CHIP_DISMISS_LAYOUT.top,
      right: '38px',
    });
    pinBtn.textContent = '\uD83D\uDCCC';
    pinBtn.title = 'Pin to quick slot';
    pinBtn.addEventListener('click', () => {
      markInteracted();
      h.onPin && h.onPin();
    });
  }

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6px',
  });
  if (actionable) actions.appendChild(btn);
  if (identifyBtn) actions.appendChild(identifyBtn);
  if (throwBtn) actions.appendChild(throwBtn);
  if (dropBtn) actions.appendChild(dropBtn);
  if (actions.childElementCount > 0) expandedWrap.appendChild(actions);

  let expanded = false;
  const setExpanded = (next) => {
    expanded = !!next;
    expandedWrap.style.display = expanded ? 'flex' : 'none';
    chevron.textContent = expanded ? '▴' : '▾';
    line2.textContent = getQuickChipDetailLine(it, { expanded });
  };
  if (h.startExpanded) setExpanded(true);
  header.addEventListener('click', () => {
    markInteracted();
    setExpanded(!expanded);
  });
  expandedWrap.addEventListener('pointerdown', markInteracted);

  chip.appendChild(x);
  if (pinBtn) chip.appendChild(pinBtn);
  chip.appendChild(header);
  chip.appendChild(expandedWrap);
  return chip;
}
