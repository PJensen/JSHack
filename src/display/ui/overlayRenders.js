// display/ui/overlayRenders.js
// All panel render functions extracted from overlay.js.

import {
  appendCharacterMenuTabs, markScrollable, quickPinKeyForItem,
  decorateButton, humanize, sanitize, bracketize, getUiItemEntityIds,
  show, hide, showItemTooltip, hideItemTooltip,
  rarityStyle, formatMessageLine, getMessageColor,
  CHARACTER_SLOT_ORDER, renderItemDetails,
} from './overlayUtils.js';
import { getInventoryDefaultAction, isInventoryItemEquippable, isInventoryItemUsable } from './inventoryUtils.js';
import {
  readInputMode, readWalkInterval, writeInputMode, writeWalkInterval,
  WALK_INTERVAL_MIN, WALK_INTERVAL_MAX,
} from '../input/inputSettings.js';
import { versionLoaded } from '../../shared/version.js';

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items @param {any} [ground] @param {string} [slotFilter] */
export function renderInventory(panel, items, ground, slotFilter = '', scrollOfIdentifyId = 0, encumbrance = null, pinnedKeys = []) {
  const existingDetach = /** @type {any} */ (panel)._inventoryDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] inventory detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  appendCharacterMenuTabs(el, 'inventory');
  const pinnedSet = new Set((Array.isArray(pinnedKeys) ? pinnedKeys : []).map((key) => String(key || '')));
  const title = document.createElement('div');
  const filterText = humanize(slotFilter || '');
  title.textContent = filterText ? `Inventory \u00b7 ${filterText}` : 'Inventory';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  // Carry weight bar
  if (encumbrance && encumbrance.limit != null && encumbrance.limit > 0) {
    const cur = Number(encumbrance.current || 0);
    const lim = Number(encumbrance.limit);
    const ratio = Math.min(cur / lim, 1.0);
    const barColor = encumbrance.overloaded ? '#e06a6a' : encumbrance.heavilyLoaded ? '#d9963b' : '#4a8a5a';

    const row = document.createElement('div');
    Object.assign(row.style, {
      marginBottom: '8px', fontSize: '12px', color: '#cfe8ff',
    });

    const label = document.createElement('span');
    label.textContent = `Weight: ${cur.toFixed(1)} / ${lim} kg`;
    if (encumbrance.overloaded) label.style.color = '#e06a6a';
    else if (encumbrance.heavilyLoaded) label.style.color = '#d9963b';
    row.appendChild(label);

    const track = document.createElement('div');
    Object.assign(track.style, {
      marginTop: '3px', height: '6px', background: '#1a2233',
      borderRadius: '3px', overflow: 'hidden', border: '1px solid #2d3b52',
    });

    const fill = document.createElement('div');
    Object.assign(fill.style, {
      height: '100%', width: `${(ratio * 100).toFixed(1)}%`,
      background: barColor, borderRadius: '3px', transition: 'width 0.2s',
    });
    track.appendChild(fill);
    row.appendChild(track);
    el.appendChild(row);
  }

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
  markScrollable(list);
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
    const pinKey = quickPinKeyForItem(it);
    const isPinned = pinKey ? pinnedSet.has(pinKey) : false;

    const star = document.createElement('span');
    star.textContent = it.equipped ? '*' : ' ';
    star.style.width = '1ch';
    star.style.color = '#ffd27d';
    star.title = it.equipped ? 'Equipped' : '';

    const pin = document.createElement('span');
    pin.textContent = isPinned ? '\uD83D\uDCCC' : ' ';
    pin.style.width = '1ch';
    pin.style.color = '#5fb3ff';
    pin.title = isPinned ? 'Pinned to quick slot' : '';

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
    row.appendChild(pin);
    row.appendChild(name);
    if (it.coating && it.coating.kind) {
      const dot = document.createElement('span');
      dot.textContent = '\u2022';
      dot.style.color = it.coating.color || '#66dd66';
      dot.style.fontSize = '14px';
      row.appendChild(dot);
    }
    row.appendChild(slot);
    if (it.unpaid) row.appendChild(unpaidTag);
    const cdRemaining = Number(it.cooldownTurnsRemaining ?? 0);
    const cdMax = Number(it.cooldownTurnsMax ?? 0);
    if (cdRemaining > 0 && cdMax > 0) {
      const elapsed = 1 - (cdRemaining / cdMax);
      const cdSym = elapsed >= 0.75 ? '\u25d5' : elapsed >= 0.5 ? '\u25d1' : elapsed >= 0.25 ? '\u25d4' : '\u25cb';
      const cdSpan = document.createElement('span');
      cdSpan.textContent = cdSym;
      cdSpan.title = `Cooldown: ${cdRemaining} turns remaining`;
      cdSpan.style.color = '#ff9f3b';
      row.appendChild(cdSpan);
    }
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

  const detail = document.createElement('div');
  Object.assign(detail.style, {
    marginTop: '8px',
    padding: '8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    minHeight: '56px',
    maxHeight: '26vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  });
  markScrollable(detail);
  el.appendChild(detail);

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

  function triggerApplyForTool(it) {
    const toolId = Number(it?.id || 0);
    if (!Number.isInteger(toolId) || toolId <= 0) return;
    window.dispatchEvent(new CustomEvent('ui:openApplyForTool', { detail: { toolId } }));
  }

  /** @param {any} it */
  function enterActionLabel(it) {
    const action = getInventoryDefaultAction(it);
    if (action === 'apply') {
      const isSocketGem = String(it?.type || '') === 'gem' && !!it?.canApply;
      return isSocketGem ? 'Socket' : 'Apply';
    }
    if (action === 'equip') return it?.equipped ? 'Unequip' : 'Equip';
    if (action === 'use') return 'Use';
    if (action === 'set-spell') return 'Set Spell';
    return 'None';
  }

  function updateHint() {
    const it = items[sel];
    const groundAction = resolveGroundPickupAction();
    const canApplyTool = !!it?.canApply;
    const socketApply = String(it?.type || '') === 'gem' && canApplyTool;
    const applyVerb = socketApply ? 'Socket' : 'Apply';
    const hasApplyTargets = !!(canApplyTool && Number(it?.applyTargetCount || 0) > 0);
    const applyHint = canApplyTool
      ? (hasApplyTargets ? ` \u00b7 A=${applyVerb}` : ` \u00b7 A=${applyVerb} (no targets)`)
      : '';
    hint.textContent = `\u2191/\u2193 to select \u00b7 Enter=${enterActionLabel(it)} \u00b7 U=Use \u00b7 E=Equip/Unequip \u00b7 I=Pin \u00b7 ,=Drop \u00b7 T=Throw${applyHint}${groundAction ? ' \u00b7 P=Pickup' : ''} \u00b7 S=Set Spell \u00b7 Esc=Close \u00b7 UNPAID items are stolen`;
    detail.innerHTML = '';
    if (it) {
      renderItemDetails(detail, it);
    }
    // Inventory uses inline detail panel; avoid duplicate floating tooltip.
    hideItemTooltip();
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
    const socketApply = String(it?.type || '') === 'gem' && canApplyTool;
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
        label: socketApply ? 'Socket' : 'Apply',
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
    if (it.identified === false && hasItemId) {
      const hasScroll = scrollOfIdentifyId > 0;
      available.push({
        key: 'identify',
        label: 'Identify',
        enabled: hasScroll,
        disabledReason: hasScroll ? '' : 'No Scroll of Identify',
      });
    }
    if (hasItemId && Number(it.maxSockets || 0) > 0) {
      const filledSockets = Array.isArray(it.sockets) ? it.sockets.length : 0;
      const hasOpenSocket = filledSockets < Number(it.maxSockets || 0);
      available.push({
        key: 'add-gem',
        label: 'Add Gem',
        enabled: hasOpenSocket,
        disabledReason: hasOpenSocket ? '' : 'All sockets filled',
      });
    }
    if (hasItemId) {
      available.push({ key: 'throw', label: 'Throw', enabled: true });
    }
    if (hasItemId) {
      available.push({ key: 'drop', label: 'Drop', enabled: true });
    }
    if (hasItemId) {
      const pinKey = quickPinKeyForItem(it);
      const isPinned = pinKey ? pinnedSet.has(pinKey) : false;
      available.push({
        key: 'pin',
        label: isPinned ? 'Pinned' : 'Pin',
        enabled: !isPinned,
        disabledReason: isPinned ? 'Already pinned' : '',
      });
    }

    const defaultKey = getInventoryDefaultAction(it);
    const order = {
      equip: 1,
      use: 2,
      apply: 3,
      'add-gem': 4,
      identify: 5,
      'set-spell': 6,
      throw: 7,
      drop: 8,
      pin: 9,
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
   * @param {"apply"|"identify"|"equip"|"use"|"set-spell"|"throw"|"drop"|"pin"} actionKey
   */
  function dispatchInventoryAction(it, actionKey) {
    if (!it) return;
    if (actionKey === 'identify') {
      if (scrollOfIdentifyId > 0 && Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestApply', {
          detail: { toolId: scrollOfIdentifyId, targetItemId: it.id },
        }));
      }
      return;
    }
    if (actionKey === 'add-gem') {
      const weaponId = Number(it?.id || 0);
      if (weaponId > 0) {
        window.dispatchEvent(new CustomEvent('ui:openGemSelectorForWeapon', { detail: { weaponId } }));
      }
      return;
    }
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
        window.dispatchEvent(new CustomEvent('ui:toggleInventory'));
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
      return;
    }
    if (actionKey === 'pin') {
      if (Number.isInteger(it.id) && it.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestPinQuickItem', { detail: { item: it } }));
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
    if (mode === 'stack') {
      const stackItems = Array.isArray(ground.items) ? ground.items : [];
      const stackIndex = Math.max(0, Math.min(stackItems.length - 1, Number(ground.stackIndex || 0) | 0));
      const topItem = stackItems[stackIndex];
      const itemId = Number(topItem?.id || 0) | 0;
      if (!(itemId > 0)) return null;
      return {
        label: 'Pickup',
        run: () => {
          window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: [itemId] } }));
        },
      };
    }
    const fromChest = ground.fromChest === true;
    const groundChestId = Number(ground.chestId || 0) | 0;
    if (fromChest && groundChestId > 0) {
      const actionLabel = ground.chestName ? `Open ${ground.chestName}` : 'Open Chest';
      return {
        label: actionLabel,
        run: () => {
          window.dispatchEvent(new CustomEvent('ui:tapOpenChest', { detail: { chestId: groundChestId } }));
        },
      };
    }
    const items = Array.isArray(ground.items) ? ground.items.filter((it) => Number.isInteger(it?.id) && it.id > 0) : [];
    if (!items.length) return null;
    return {
      label: `Pickup (${items.length})`,
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
          window.dispatchEvent(new CustomEvent('ui:toggleInventory'));
          window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
        }
        e.preventDefault();
      }
    }
    else if (k === 'i' || k === 'I') {
      const it = items[sel];
      const pinKey = quickPinKeyForItem(it);
      if (it && pinKey && !pinnedSet.has(pinKey)) {
        window.dispatchEvent(new CustomEvent('ui:requestPinQuickItem', { detail: { item: it } }));
        e.preventDefault();
      }
    }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ identificationEnabled?: boolean, deityDebugPinned?: boolean, allItemIds?: string[], allMonsterIds?: string[], hasPet?: boolean, petAlive?: boolean }} data
 * @param {{ canvas: HTMLCanvasElement }} memGraph
 * @param {{ canvas: HTMLCanvasElement }} dtyGraph
 */
export function renderSettings(panel, data, memGraph, dtyGraph, econGraph, tileInsp, lightPerfGraph) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  appendCharacterMenuTabs(el, 'settings');

  const content = document.createElement('div');
  Object.assign(content.style, {
    display: 'flex', flexDirection: 'column', gap: '14px',
    maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden',
  });
  markScrollable(content);

  // --- Gameplay section ---
  const gpHead = document.createElement('div');
  gpHead.textContent = 'Gameplay';
  Object.assign(gpHead.style, {
    fontWeight: 'bold', fontSize: '13px', color: '#7fb8e8',
    borderBottom: '1px solid #2d3b52', paddingBottom: '4px',
  });
  content.appendChild(gpHead);

  content.appendChild(makeCheckbox('Identification', !!data.identificationEnabled, (on) => {
    window.dispatchEvent(new CustomEvent('ui:setIdentification', { detail: { enabled: on } }));
  }));

  content.appendChild(makeCheckbox('FOV cone', !data.fovConeDisabled, (on) => {
    window.dispatchEvent(new CustomEvent('ui:setFovConeDisabled', { detail: { disabled: !on } }));
  }));

  content.appendChild(makeCheckbox('Facing turn cost', !!data.facingTurnCostEnabled, (on) => {
    window.dispatchEvent(new CustomEvent('ui:setFacingTurnCost', { detail: { enabled: on } }));
  }));

  // --- Input section ---
  const inputHead = document.createElement('div');
  inputHead.textContent = 'Input';
  Object.assign(inputHead.style, {
    fontWeight: 'bold', fontSize: '13px', color: '#7fb8e8',
    borderBottom: '1px solid #2d3b52', paddingBottom: '4px', marginTop: '4px',
  });
  content.appendChild(inputHead);

  // Radio: input scheme selection
  const currentMode = readInputMode();
  const modeRow = document.createElement('div');
  Object.assign(modeRow.style, { display: 'flex', flexDirection: 'column', gap: '6px' });

  function makeRadio(labelText, value, checked) {
    const lbl = document.createElement('label');
    Object.assign(lbl.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      cursor: 'pointer', fontSize: '13px', minHeight: '32px',
    });
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'jshack-input-mode';
    radio.value = value;
    radio.checked = checked;
    Object.assign(radio.style, { width: '16px', height: '16px', accentColor: '#5fb3ff', cursor: 'pointer' });
    const txt = document.createElement('span');
    txt.textContent = labelText;
    lbl.appendChild(radio);
    lbl.appendChild(txt);
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      writeInputMode(/** @type {'walk'|'gesture'|'joystick'} */ (value));
      window.dispatchEvent(new CustomEvent('ui:inputSettingsChanged', {
        detail: { inputMode: value, walkInterval: readWalkInterval() },
      }));
      // Show/hide movement speed row.
      speedRow.style.display = (value === 'walk' || value === 'joystick') ? 'flex' : 'none';
    });
    return lbl;
  }

  modeRow.appendChild(makeRadio('Tap and Hold', 'walk', currentMode === 'walk'));
  modeRow.appendChild(makeRadio('Spell Gestures', 'gesture', currentMode === 'gesture'));
  modeRow.appendChild(makeRadio('Joystick & Spell Gestures', 'joystick', currentMode === 'joystick'));
  content.appendChild(modeRow);

  // Trackbar: movement repeat interval (ms)
  const speedRow = document.createElement('div');
  Object.assign(speedRow.style, {
    display: (currentMode === 'walk' || currentMode === 'joystick') ? 'flex' : 'none',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '6px',
  });
  const speedLabel = document.createElement('span');
  speedLabel.textContent = 'Movement Speed';
  Object.assign(speedLabel.style, { fontSize: '13px', color: '#aac8e8' });
  speedRow.appendChild(speedLabel);

  const sliderWrap = document.createElement('div');
  Object.assign(sliderWrap.style, {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '8px',
  });

  const minEl = document.createElement('span');
  minEl.textContent = 'Slow';
  Object.assign(minEl.style, { fontSize: '11px', color: '#6f8fb2', minWidth: '44px', textAlign: 'left' });

  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.min = '0';
  speedSlider.max = String(WALK_INTERVAL_MAX - WALK_INTERVAL_MIN);
  speedSlider.step = '1';
  speedSlider.value = String(WALK_INTERVAL_MAX - readWalkInterval());
  Object.assign(speedSlider.style, {
    width: '100%',
    minHeight: '34px',
    accentColor: '#5fb3ff',
  });

  const maxEl = document.createElement('span');
  maxEl.textContent = 'Fast';
  Object.assign(maxEl.style, { fontSize: '11px', color: '#6f8fb2', minWidth: '50px', textAlign: 'right' });

  sliderWrap.appendChild(minEl);
  sliderWrap.appendChild(speedSlider);
  sliderWrap.appendChild(maxEl);
  speedRow.appendChild(sliderWrap);

  function syncMovementSpeed(interval) {
    const ms = Math.max(WALK_INTERVAL_MIN, Math.min(WALK_INTERVAL_MAX, Number(interval) | 0));
    writeWalkInterval(ms);
    window.dispatchEvent(new CustomEvent('ui:inputSettingsChanged', {
      detail: { inputMode: readInputMode(), walkInterval: ms },
    }));
  }

  speedSlider.addEventListener('input', () => {
    const ms = WALK_INTERVAL_MAX - (Number(speedSlider.value) | 0);
    syncMovementSpeed(ms);
  });
  speedSlider.addEventListener('change', () => {
    const ms = WALK_INTERVAL_MAX - (Number(speedSlider.value) | 0);
    syncMovementSpeed(ms);
  });

  content.appendChild(speedRow);

  // --- Debugging section ---
  const dbHead = document.createElement('div');
  dbHead.textContent = 'Debugging';
  Object.assign(dbHead.style, {
    fontWeight: 'bold', fontSize: '13px', color: '#7fb8e8',
    borderBottom: '1px solid #2d3b52', paddingBottom: '4px', marginTop: '4px',
  });
  content.appendChild(dbHead);

  content.appendChild(makeCheckbox('Deity debugging', data.deityDebugPinned === true, (on) => {
    window.dispatchEvent(new CustomEvent('ui:setDeityDebugPinned', { detail: { enabled: on } }));
  }));

  content.appendChild(makeCheckbox('Economy graph', econGraph.canvas.style.display === 'block', () => {
    window.dispatchEvent(new CustomEvent('ui:toggleEconomyGraph'));
  }));

  content.appendChild(makeCheckbox('Memory visualizer', memGraph.canvas.style.display === 'block', () => {
    window.dispatchEvent(new CustomEvent('ui:toggleMemoryGraph'));
  }));

  content.appendChild(makeCheckbox('Tile inspector', tileInsp.el.style.display === 'block', () => {
    window.dispatchEvent(new CustomEvent('ui:toggleTileInspector'));
  }));

  if (lightPerfGraph) {
    content.appendChild(makeCheckbox('Lighting perf', lightPerfGraph.canvas.style.display === 'block', () => {
      window.dispatchEvent(new CustomEvent('ui:toggleLightingPerfGraph'));
    }));
  }

  function makeAutocompleteActionRow({ ids, placeholder, buttonText, eventName, detailKey }) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', gap: '6px', alignItems: 'flex-start', position: 'relative',
    });

    const inputWrap = document.createElement('div');
    Object.assign(inputWrap.style, { position: 'relative', flex: '1' });

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    Object.assign(input.style, {
      width: '100%', boxSizing: 'border-box',
      padding: '6px 8px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52', borderRadius: '6px',
      fontFamily: 'monospace', fontSize: '13px', outline: 'none',
    });

    const dropdown = document.createElement('div');
    Object.assign(dropdown.style, {
      position: 'absolute', left: '0', right: '0', top: '100%',
      maxHeight: '150px', overflowY: 'auto', overflowX: 'hidden',
      background: '#0b0e16', border: '1px solid #2d3b52', borderRadius: '0 0 6px 6px',
      zIndex: '10', display: 'none',
    });
    markScrollable(dropdown);

    const allIds = Array.isArray(ids) ? ids : [];

    function updateDropdown() {
      const q = input.value.trim().toLowerCase();
      dropdown.innerHTML = '';
      if (!q) { dropdown.style.display = 'none'; return; }
      const matches = allIds.filter((id) => id.includes(q)).slice(0, 30);
      if (!matches.length) { dropdown.style.display = 'none'; return; }
      for (const id of matches) {
        const opt = document.createElement('div');
        opt.textContent = id;
        Object.assign(opt.style, {
          padding: '4px 8px', cursor: 'pointer', fontSize: '12px',
          color: '#cfe8ff', fontFamily: 'monospace',
        });
        opt.addEventListener('pointerenter', () => { opt.style.background = '#173458'; });
        opt.addEventListener('pointerleave', () => { opt.style.background = ''; });
        opt.addEventListener('click', () => {
          input.value = id;
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(opt);
      }
      dropdown.style.display = 'block';
    }

    function submit() {
      const value = input.value.trim();
      if (!value) return;
      window.dispatchEvent(new CustomEvent(eventName, { detail: { [detailKey]: value } }));
      input.value = '';
      dropdown.style.display = 'none';
    }

    input.addEventListener('input', updateDropdown);
    input.addEventListener('focus', updateDropdown);
    input.addEventListener('blur', () => {
      // Delay hide so click on dropdown option can fire first
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      submit();
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(dropdown);
    row.appendChild(inputWrap);

    const button = document.createElement('button');
    button.textContent = buttonText;
    decorateButton(button);
    button.style.minHeight = '34px';
    button.addEventListener('click', submit);
    row.appendChild(button);

    return row;
  }

  content.appendChild(makeAutocompleteActionRow({
    ids: data.allItemIds,
    placeholder: 'item id\u2026',
    buttonText: 'Give',
    eventName: 'ui:debugGiveItem',
    detailKey: 'itemId',
  }));

  content.appendChild(makeAutocompleteActionRow({
    ids: data.allMonsterIds,
    placeholder: 'monster id\u2026',
    buttonText: 'Spawn',
    eventName: 'ui:debugSpawnMonster',
    detailKey: 'monsterId',
  }));

  // --- Resurrect pet button ---
  const petBtn = document.createElement('button');
  petBtn.textContent = 'Resurrect Pet';
  decorateButton(petBtn);
  petBtn.style.minHeight = '44px';
  if (!data.hasPet || data.petAlive) {
    petBtn.disabled = true;
    petBtn.style.opacity = '0.4';
    petBtn.style.cursor = 'default';
  }
  petBtn.addEventListener('click', () => {
    if (petBtn.disabled) return;
    window.dispatchEvent(new CustomEvent('ui:debugResurrectPet'));
    // Re-request settings to update button state
    window.dispatchEvent(new CustomEvent('ui:requestSettingsData'));
  });
  content.appendChild(petBtn);

  // --- Version + Subscribe row ---
  const versionRow = document.createElement('div');
  Object.assign(versionRow.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', marginTop: '8px',
  });

  const versionEl = document.createElement('div');
  Object.assign(versionEl.style, { fontSize: '12px', color: '#4a6080' });
  versionRow.appendChild(versionEl);

  const subscribeLink = document.createElement('a');
  subscribeLink.href = 'https://hackjs.substack.com/';
  subscribeLink.target = '_blank';
  subscribeLink.rel = 'noopener';
  subscribeLink.textContent = 'Subscribe to Updates';
  Object.assign(subscribeLink.style, {
    fontSize: '12px', color: '#7aacdf', textDecoration: 'none', opacity: '0.8',
  });
  subscribeLink.addEventListener('mouseenter', () => { subscribeLink.style.opacity = '1'; });
  subscribeLink.addEventListener('mouseleave', () => { subscribeLink.style.opacity = '0.8'; });
  versionRow.appendChild(subscribeLink);

  content.appendChild(versionRow);

  versionLoaded.then(() => {
    const ver = /** @type {any} */ (window).VERSION;
    if (ver) versionEl.textContent = `v${ver}`;
  });

  el.appendChild(content);
}

/**
 * @param {string} label
 * @param {boolean} checked
 * @param {(on: boolean) => void} onChange
 * @returns {HTMLLabelElement}
 */
function makeCheckbox(label, checked, onChange) {
  const row = document.createElement('label');
  Object.assign(row.style, {
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: 'pointer', fontSize: '13px', minHeight: '32px',
  });
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  Object.assign(cb.style, { width: '16px', height: '16px', accentColor: '#5fb3ff', cursor: 'pointer' });
  cb.addEventListener('change', () => onChange(cb.checked));
  const txt = document.createElement('span');
  txt.textContent = label;
  row.appendChild(cb);
  row.appendChild(txt);
  return row;
}

// --- Quest Journal tab -------------------------------------------------------

/**
 * Human-readable label for a quest node + status pair.
 * @param {string} node
 * @param {string} status
 * @returns {string}
 */
function questNodeLabel(node, status) {
  if (status === 'complete') return 'Complete';
  switch (node) {
    case 'offer':   return 'Offered';
    case 'survey':  return 'In Progress';
    case 'report':  return 'Ready to Report';
    default:        return node.charAt(0).toUpperCase() + node.slice(1);
  }
}

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {Array<{questId:string, title:string, status:string, node:string, t0:number}>} quests
 */
export function renderQuestJournal(panel, quests) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  appendCharacterMenuTabs(el, 'quests');

  const heading = document.createElement('div');
  heading.textContent = 'Quest Journal';
  heading.style.fontWeight = 'bold';
  heading.style.marginBottom = '10px';
  el.appendChild(heading);

  const active = quests.filter(q => q.status !== 'complete');
  const done   = quests.filter(q => q.status === 'complete');

  function appendSection(label, items) {
    const sectionLabel = document.createElement('div');
    Object.assign(sectionLabel.style, {
      fontSize: '11px',
      color: '#7ba7cc',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '4px',
      marginTop: label === 'Active' ? '0' : '14px',
    });
    sectionLabel.textContent = label;
    el.appendChild(sectionLabel);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.textContent = label === 'Active' ? 'No active quests.' : 'None completed yet.';
      Object.assign(empty.style, { opacity: '0.55', fontStyle: 'italic', fontSize: '12px', marginBottom: '4px' });
      el.appendChild(empty);
      return;
    }

    for (const q of items) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 10px',
        marginBottom: '4px',
        background: '#0a111f',
        border: '1px solid #1e2d45',
        borderRadius: '6px',
        fontSize: '13px',
      });

      const titleEl = document.createElement('span');
      titleEl.textContent = q.title || q.questId;
      row.appendChild(titleEl);

      const badge = document.createElement('span');
      const nodeLabel = questNodeLabel(q.node, q.status);
      badge.textContent = nodeLabel;
      const isComplete = q.status === 'complete';
      Object.assign(badge.style, {
        fontSize: '10px',
        fontWeight: 'bold',
        padding: '2px 7px',
        borderRadius: '10px',
        flexShrink: '0',
        marginLeft: '8px',
        background: isComplete ? '#163a20' : (q.node === 'report' ? '#2a1f05' : '#0e1e35'),
        color: isComplete ? '#5ecb72' : (q.node === 'report' ? '#f5c043' : '#5fb3ff'),
        border: isComplete ? '1px solid #2a6e38' : (q.node === 'report' ? '1px solid #7a5a10' : '1px solid #1e4a7e'),
      });
      row.appendChild(badge);
      el.appendChild(row);
    }
  }

  appendSection('Active', active);
  appendSection('Completed', done);
}

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{
 *   districts?: Array<{label?:string, opportunities?:string[], shortages?:string[]}>,
 *   questBoard?: {
 *     generatedAt?: number,
 *     active?: Array<{title?:string, status?:string, progress?:number, target?:number}>,
 *     offers?: Array<{title?:string, objective?:string, sourceLabel?:string, urgency?:string, accepted?:boolean}>,
 *     sectors?: string[],
 *   }
 * }} data
 */
export function renderTownBoard(panel, data) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';

  const heading = document.createElement('div');
  heading.textContent = 'Town Notice Board';
  heading.style.fontWeight = 'bold';
  heading.style.marginBottom = '10px';
  el.appendChild(heading);

  const questBoard = (data && typeof data.questBoard === 'object') ? data.questBoard : {};
  const active = Array.isArray(questBoard.active) ? questBoard.active : [];
  const offers = Array.isArray(questBoard.offers) ? questBoard.offers : [];
  const sectors = Array.isArray(questBoard.sectors) ? questBoard.sectors : [];

  const summary = document.createElement('div');
  Object.assign(summary.style, {
    fontSize: '12px',
    opacity: '0.85',
    marginBottom: '10px',
  });
  summary.textContent = `${active.length} active quest${active.length === 1 ? '' : 's'} \u00b7 ${offers.length} posted contract${offers.length === 1 ? '' : 's'}`;
  el.appendChild(summary);

  const activeLabel = document.createElement('div');
  activeLabel.textContent = 'Active Quests';
  Object.assign(activeLabel.style, {
    fontSize: '11px',
    color: '#7ba7cc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  });
  el.appendChild(activeLabel);

  if (!active.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No active quests yet.';
    Object.assign(empty.style, { opacity: '0.55', fontStyle: 'italic', fontSize: '12px', marginBottom: '8px' });
    el.appendChild(empty);
  } else {
    for (const quest of active) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        padding: '7px 10px',
        marginBottom: '4px',
        background: '#0a111f',
        border: '1px solid #1e2d45',
        borderRadius: '6px',
      });
      const title = document.createElement('div');
      title.textContent = String(quest?.title || 'Quest');
      title.style.fontSize = '13px';
      row.appendChild(title);
      if (Number(quest?.target || 0) > 0) {
        const progress = document.createElement('div');
        progress.textContent = `Progress: ${Number(quest?.progress || 0)}/${Number(quest?.target || 0)}`;
        Object.assign(progress.style, { fontSize: '11px', opacity: '0.8', marginTop: '2px' });
        row.appendChild(progress);
      }
      el.appendChild(row);
    }
  }

  const offerLabel = document.createElement('div');
  offerLabel.textContent = 'Posted Contracts';
  Object.assign(offerLabel.style, {
    fontSize: '11px',
    color: '#7ba7cc',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '10px',
    marginBottom: '4px',
  });
  el.appendChild(offerLabel);

  if (!offers.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No contracts are currently posted.';
    Object.assign(empty.style, { opacity: '0.55', fontStyle: 'italic', fontSize: '12px', marginBottom: '8px' });
    el.appendChild(empty);
  } else {
    for (const offer of offers) {
      const isAccepted = !!offer?.accepted;
      const row = document.createElement('div');
      Object.assign(row.style, {
        padding: '7px 10px',
        marginBottom: '5px',
        background: isAccepted ? '#0f1a12' : '#0a111f',
        border: isAccepted ? '1px solid #2a6e38' : '1px solid #1e2d45',
        borderRadius: '6px',
      });
      const title = document.createElement('div');
      title.textContent = String(offer?.title || 'Town Contract');
      Object.assign(title.style, { fontSize: '13px', marginBottom: '2px' });
      row.appendChild(title);

      const objective = document.createElement('div');
      objective.textContent = String(offer?.objective || 'Investigate local demand.');
      Object.assign(objective.style, { fontSize: '11px', opacity: '0.85' });
      row.appendChild(objective);

      const meta = document.createElement('div');
      const urgency = String(offer?.urgency || 'low').toUpperCase();
      const district = String(offer?.sourceLabel || 'Town');
      meta.textContent = `${district} \u00b7 ${urgency}${isAccepted ? ' \u00b7 CLAIMED' : ''}`;
      Object.assign(meta.style, { fontSize: '10px', opacity: '0.7', marginTop: '2px' });
      row.appendChild(meta);

      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '6px',
      });
      const acceptBtn = document.createElement('button');
      decorateButton(acceptBtn);
      acceptBtn.textContent = isAccepted ? 'Accepted' : 'Accept';
      Object.assign(acceptBtn.style, {
        minHeight: '32px',
        minWidth: '82px',
        padding: '0 10px',
        fontSize: '12px',
      });
      if (isAccepted) {
        acceptBtn.disabled = true;
        acceptBtn.style.opacity = '0.6';
      } else {
        acceptBtn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('ui:requestTownBoardAccept', {
            detail: { offer },
          }));
        });
      }
      actions.appendChild(acceptBtn);
      row.appendChild(actions);

      el.appendChild(row);
    }
  }

  if (sectors.length) {
    const sectorsEl = document.createElement('div');
    sectorsEl.textContent = `Profitable sectors: ${sectors.join(', ')}`;
    Object.assign(sectorsEl.style, {
      marginTop: '8px',
      fontSize: '11px',
      color: '#c0def8',
      opacity: '0.9',
    });
    el.appendChild(sectorsEl);
  }
}

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ playerName?: string, stats?: Record<string, any>, activeEffects?: Array<any> }} data
 */
export function renderCharacterSheet(panel, data) {
  const SEASON_COLORS = {
    spring: '#7ec87a',
    summer: '#f0c95a',
    autumn: '#d4834a',
    winter: '#8ab4d6',
  };
  const existingDetach = /** @type {any} */ (panel)._characterSheetDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] character sheet detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  appendCharacterMenuTabs(el, 'character');

  const playerName = String(data?.playerName || 'Hero').trim() || 'Hero';
  const stats = data?.stats && typeof data.stats === 'object' ? data.stats : {};
  const activeEffects = Array.isArray(data?.activeEffects) ? data.activeEffects : [];
  const traits = Array.isArray(data?.traits) ? data.traits : [];
  const calendar = data?.calendar && typeof data.calendar === 'object' ? data.calendar : null;

  const title = document.createElement('div');
  title.textContent = `${playerName} \u00b7 Character Sheet`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (calendar?.formatted) {
    const calendarCard = document.createElement('div');
    Object.assign(calendarCard.style, {
      marginBottom: '10px',
      padding: '8px 10px',
      border: '1px solid #2d3b52',
      borderRadius: '6px',
      background: '#0a111f',
      fontSize: '13px',
      lineHeight: '1.4',
      color: SEASON_COLORS[String(calendar?.season || '')] || '#cfe8ff',
      wordBreak: 'break-word',
    });
    const moonEmoji = String(calendar?.moonEmoji || '');
    const moonLabel = String(calendar?.moonLabel || '');
    calendarCard.textContent = `${moonEmoji ? `${moonEmoji} ` : ''}${String(calendar.formatted)}${moonLabel ? ` \u00b7 ${moonLabel}` : ''}`;
    el.appendChild(calendarCard);
  }

  const statCard = document.createElement('div');
  Object.assign(statCard.style, {
    padding: '8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px 12px',
    fontSize: '13px',
  });
  el.appendChild(statCard);

  function deltaColor(value, baseline = 0) {
    const n = Number(value || 0);
    if (n > baseline) return '#64c87a';
    if (n < baseline) return '#e06a6a';
    return null;
  }

  // [label, value, color|null]  — null = default text color
  const statRows = [
    ['Strength', `${Number(stats.strength || 0)}`, deltaColor(stats.strength)],
    ['Dexterity', `${Number(stats.dexterity || 0)}`, deltaColor(stats.dexterity)],
    ['Intelligence', `${Number(stats.intelligence || 0)}`, deltaColor(stats.intelligence)],
    ['Vitality', `${Number(stats.vitalityStat || 0)}`, deltaColor(stats.vitalityStat)],
    ['HP', `${Number(stats.hp || 0)}/${Number(stats.maxHp || 0)}`],
    ['Mana', `${Number(stats.mana || 0)}/${Number(stats.maxMana || 0)}`],
    ['Stamina', `${Number(stats.stamina || 0)}/${Number(stats.maxStamina || 0)}`],
    ['Attack', `${Number(stats.attack || 0)}`, deltaColor(stats.attack)],
    ['Defense', `${Number(stats.defense || 0)}`, deltaColor(stats.defense)],
    ['Accuracy', `${Number(stats.accuracy || 0)}`, deltaColor(stats.accuracy)],
    ['Damage Power', `${Number(stats.damagePower || 0)}`, deltaColor(stats.damagePower)],
    ['Evade', `${Number(stats.evade || 0)}`, deltaColor(stats.evade)],
    ['Mitigation', `${Number(stats.mitigation || 0)}`, deltaColor(stats.mitigation)],
    ['Spell Power', `${Number(stats.spellPower || 0)}`, deltaColor(stats.spellPower)],
    ['Armor Class', `${Number(stats.armorClass || 0)}`, deltaColor(stats.armorClass, 10)],
    ['Luck', `${Number(stats.luck || 0)}`, deltaColor(stats.luck)],
    ['Crit %', `${Number(stats.critChancePercent || 0).toFixed(1)}`, deltaColor(stats.critChancePercent)],
    ['Crit Mult', `\u00d7${Number(stats.critMult || 0).toFixed(1)}`, deltaColor(stats.critMult)],
    ['Dmg Bonus', `${Number(stats.damageFlatBonus || 0)}`, deltaColor(stats.damageFlatBonus)],
    ['Mana Regen', `${Number(stats.manaRegen || 0).toFixed(2)}/t`, deltaColor(stats.manaRegenDerived)],
    ['Stam Regen', `${Number(stats.staminaRegen || 0).toFixed(1)}/t`, deltaColor(stats.staminaRegenDerived)],
    ['Max HP Bonus', `${Number(stats.maxHpDerived || 0)}`, deltaColor(stats.maxHpDerived)],
    ['Speed', `${Number(stats.speed || 1)}`, deltaColor(stats.speed, 1) === '#64c87a' ? '#e06a6a' : deltaColor(stats.speed, 1) === '#e06a6a' ? '#64c87a' : null],
    ['Gold', `${Number(stats.gold || 0)}`],
    ['Hunger', `${humanize(String(stats.hungerLevel || 'normal'))} (${Number(stats.hunger || 0)})`],
    ['Depth', `${Number(stats.depth || 0)}`],
    ['Turn', `${Number(stats.turn || 0)}`],
  ];
  for (const [label, value, color] of statRows) {
    const row = document.createElement('div');
    const lbl = document.createElement('span');
    lbl.textContent = `${label}: `;
    const val = document.createElement('span');
    val.textContent = value;
    if (color) val.style.color = color;
    row.appendChild(lbl);
    row.appendChild(val);
    statCard.appendChild(row);
  }

  // Resistances — only show non-zero entries
  const resistRows = [
    ['Kinetic DR', Number(stats.kineticDR || 0)],
    ['Fire Resist', Number(stats.fireResist || 0)],
    ['Poison Resist', Number(stats.poisonResist || 0)],
    ['Acid Resist', Number(stats.acidResist || 0)],
    ['Rad Resist', Number(stats.radiationResist || 0)],
    ['Elec Resist', Number(stats.electricResist || 0)],
    ['Blunt Resist', Number(stats.bluntResist || 0)],
    ['Slash Resist', Number(stats.slashResist || 0)],
    ['Pierce Resist', Number(stats.pierceResist || 0)],
  ].filter(([, v]) => v !== 0);

  if (resistRows.length) {
    const resistHeader = document.createElement('div');
    resistHeader.textContent = 'Resistances';
    resistHeader.style.marginTop = '10px';
    resistHeader.style.fontWeight = 'bold';
    el.appendChild(resistHeader);

    const resistCard = document.createElement('div');
    Object.assign(resistCard.style, {
      marginTop: '6px',
      padding: '8px',
      border: '1px solid #2d3b52',
      borderRadius: '6px',
      background: '#0a111f',
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '6px 12px',
      fontSize: '13px',
    });
    for (const [label, v] of resistRows) {
      const row = document.createElement('div');
      const lbl = document.createElement('span');
      lbl.textContent = `${label}: `;
      const val = document.createElement('span');
      val.textContent = `${v}`;
      val.style.color = deltaColor(v) || '#cfe8ff';
      row.appendChild(lbl);
      row.appendChild(val);
      resistCard.appendChild(row);
    }
    el.appendChild(resistCard);
  }

  if (traits.length > 0) {
    const traitsTitle = document.createElement('div');
    traitsTitle.textContent = 'Traits';
    traitsTitle.style.marginTop = '10px';
    traitsTitle.style.fontWeight = 'bold';
    el.appendChild(traitsTitle);

    const traitsCard = document.createElement('div');
    Object.assign(traitsCard.style, {
      marginTop: '6px',
      padding: '8px',
      border: '1px solid #2d3b52',
      borderRadius: '6px',
      background: '#0a111f',
      fontSize: '13px',
    });
    for (const t of traits) {
      const row = document.createElement('div');
      row.style.marginBottom = '4px';
      const lbl = document.createElement('span');
      lbl.textContent = String(t.label || t.key || '');
      lbl.style.color = '#ffd966';
      lbl.style.fontWeight = 'bold';
      const desc = document.createElement('span');
      desc.textContent = ` \u2014 ${String(t.description || '')}`;
      desc.style.opacity = '0.85';
      row.appendChild(lbl);
      row.appendChild(desc);
      traitsCard.appendChild(row);
    }
    el.appendChild(traitsCard);
  }

  const effectsTitle = document.createElement('div');
  effectsTitle.textContent = 'Active Effects';
  effectsTitle.style.marginTop = '10px';
  effectsTitle.style.fontWeight = 'bold';
  el.appendChild(effectsTitle);

  const effects = document.createElement('div');
  Object.assign(effects.style, {
    marginTop: '6px',
    padding: '8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    maxHeight: '24vh',
    overflowY: 'auto',
    fontSize: '13px',
  });
  if (!activeEffects.length) {
    const empty = document.createElement('div');
    empty.textContent = '(none)';
    empty.style.opacity = '0.75';
    effects.appendChild(empty);
  } else {
    for (const status of activeEffects) {
      const row = document.createElement('div');
      const key = humanize(String(status?.key || '').trim());
      const turns = Math.max(0, Number(status?.turns || 0) | 0);
      const stacks = Math.max(1, Number(status?.stacks || 1) | 0);
      row.textContent = `${key} \u00b7 ${turns}t${stacks > 1 ? ` \u00b7 x${stacks}` : ''}`;
      row.style.marginBottom = '4px';
      effects.appendChild(row);
    }
  }
  el.appendChild(effects);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  });
  const engraveBtn = document.createElement('button');
  engraveBtn.textContent = '\u270E Engrave';
  decorateButton(engraveBtn);
  engraveBtn.style.minHeight = '44px';
  engraveBtn.style.padding = '8px 12px';
  engraveBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ui:engrave'));
  });
  actions.appendChild(engraveBtn);

  const spellBtn = document.createElement('button');
  spellBtn.textContent = '\u{1F9E0} Select Spell';
  decorateButton(spellBtn);
  spellBtn.style.minHeight = '44px';
  spellBtn.style.padding = '8px 12px';
  spellBtn.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('ui:openSpellPicker'));
  });
  actions.appendChild(spellBtn);

  const bugBtn = document.createElement('button');
  bugBtn.textContent = '\u{1F47E} Bug Report';
  decorateButton(bugBtn);
  bugBtn.style.minHeight = '44px';
  bugBtn.style.padding = '8px 12px';
  bugBtn.addEventListener('click', () => {
    const version = /** @type {any} */ (window).VERSION || 'unknown';
    const ua = navigator.userAgent;
    function openWithData(d) {
      const gearLines = (d?.gear || []).map(g => `  - ${g.slot}: ${g.name}`).join('\n') || '  (none)';
      const invLines = (d?.inv || []).map(i => `  - ${i}`).join('\n') || '  (none)';
      const effectsLine = (d?.effects || []).join(', ') || 'none';
      const s = d?.stats || {};
      const snapshot = d
        ? [
          `**Character:** ${d.playerName} (${d.playerClass})`,
          `**Seed:** ${d.seed ? (d.seed >>> 0).toString(16).toUpperCase() : '???'}`,
          `**Depth:** ${s.depth ?? '?'}  |  **Turn:** ${s.turn ?? '?'}`,
          `**HP:** ${s.hp}  |  **Mana:** ${s.mana}  |  **Stamina:** ${s.stamina}`,
          `**Attack:** ${s.attack}  |  **Defense:** ${s.defense}  |  **AC:** ${s.armorClass}  |  **Luck:** ${s.luck}`,
          `**Gold:** ${s.gold}  |  **Hunger:** ${s.hungerLevel}`,
          `**Active effects:** ${effectsLine}`,
          `**Gear:**\n${gearLines}`,
          `**Inventory:**\n${invLines}`,
        ].join('\n')
        : '(no game state available)';
      const body = encodeURIComponent(
        `**Steps to reproduce:**\n\n**Expected:**\n\n**Actual:**\n\n---\n\n<details>\n<summary>Game state snapshot</summary>\n\n**Version:** ${version}\n**Browser:** ${ua}\n\n${snapshot}\n</details>`
      );
      const title = encodeURIComponent('[Bug] ');
      window.open(
        `https://github.com/pjensen/JSHack/issues/new?title=${title}&body=${body}&labels=bug`,
        '_blank', 'noopener'
      );
    }
    const onData = (ev) => {
      window.removeEventListener('ui:bugReportData', onData);
      openWithData(ev?.detail);
    };
    window.addEventListener('ui:bugReportData', onData);
    try { window.dispatchEvent(new CustomEvent('ui:requestBugReportData')); } catch (e) {
      window.removeEventListener('ui:bugReportData', onData);
      openWithData(null);
    }
  });
  actions.appendChild(bugBtn);

  el.appendChild(actions);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.textContent = 'Tab=Next tab \u00b7 I=Inventory \u00b7 E=Equipment \u00b7 Esc=Close';
  el.appendChild(hint);

  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'i' || k === 'I') {
      window.dispatchEvent(new CustomEvent('ui:openInventory'));
      e.preventDefault();
    }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
    else if (k === 'e' || k === 'E') {
      window.dispatchEvent(new CustomEvent('ui:openEquipment'));
      e.preventDefault();
    }
  }

  const keyHandler = (/** @type {KeyboardEvent} */ e) => onKey(e);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      detach();
    }
  });

  const detach = () => {
    window.removeEventListener('keydown', keyHandler);
    obs.disconnect();
    if ((/** @type {any} */ (panel))._characterSheetDetach === detach) {
      (/** @type {any} */ (panel))._characterSheetDetach = null;
    }
  };

  window.addEventListener('keydown', keyHandler);
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  (/** @type {any} */ (panel))._characterSheetDetach = detach;
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Record<string, any>|null} equippedBySlot @param {string|null} playerName @param {number} [scrollOfIdentifyId] */
export function renderEquipment(panel, equippedBySlot, playerName, scrollOfIdentifyId = 0) {
  const existingDetach = /** @type {any} */ (panel)._equipmentDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] equipment detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  appendCharacterMenuTabs(el, 'equipment');

  const title = document.createElement('div');
  const pn = String(playerName || 'Hero').trim() || 'Hero';
  title.textContent = `${pn} \u00b7 Equipment`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  const _hideVal = (/** @type {any} */ (panel))._hideEmptySlots;
  let hideEmpty = _hideVal !== undefined ? _hideVal : true;
  const cbWrap = document.createElement('label');
  Object.assign(cbWrap.style, {
    display: 'flex', alignItems: 'center', gap: '6px',
    marginBottom: '8px', cursor: 'pointer', opacity: '0.85',
  });
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = hideEmpty;
  cb.style.cursor = 'pointer';
  cbWrap.appendChild(cb);
  cbWrap.appendChild(document.createTextNode('Hide Empty Slots'));
  el.appendChild(cbWrap);

  const rowsData = CHARACTER_SLOT_ORDER.map((slot) => {
    const state = (equippedBySlot && typeof equippedBySlot === 'object') ? (equippedBySlot[slot] || {}) : {};
    const item = state?.item && typeof state.item === 'object' ? state.item : null;
    return {
      slot,
      item,
      blocked: !!state?.blocked,
      reason: String(state?.reason || ''),
    };
  });

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '4px';
  list.style.maxHeight = '40vh';
  list.style.overflowY = 'auto';
  list.style.overflowX = 'hidden';
  markScrollable(list);
  el.appendChild(list);

  const detail = document.createElement('div');
  Object.assign(detail.style, {
    marginTop: '8px',
    padding: '8px',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    background: '#0a111f',
    minHeight: '52px',
  });
  el.appendChild(detail);

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    marginTop: '8px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    minHeight: '44px',
    alignItems: 'center',
  });
  el.appendChild(actions);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.textContent = '\u2191/\u2193 select slot \u00b7 Enter=Equip/Unequip \u00b7 I=Open Inventory \u00b7 C=Character Sheet \u00b7 Esc=Close';
  el.appendChild(hint);

  function openInventoryForSlot(slotName) {
    const slotFilter = String(slotName || '').trim().toLowerCase();
    window.dispatchEvent(new CustomEvent('ui:openInventory', { detail: { slotFilter } }));
  }

  function openSpellPicker() {
    window.dispatchEvent(new CustomEvent('ui:openSpellPicker'));
  }

  function localRarityStyle(rarityName) {
    const rn = String(rarityName || 'common').toLowerCase();
    if (rn === 'rare' || rn === 'magic') return { color: '#55aaff', weight: 'bold' };
    if (rn === 'epic') return { color: '#c47bff', weight: 'bold' };
    if (rn === 'legendary') return { color: '#ff9f3b', weight: 'bold' };
    return { color: '#ffffff', weight: 'bold' };
  }

  const rows = rowsData.map((rowData, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      padding: '6px 8px',
      boxSizing: 'border-box',
      background: '#0f1421',
      color: '#cfe8ff',
      border: '1px solid #2d3b52',
      borderRadius: '6px',
      cursor: 'pointer',
    });

    const slot = document.createElement('span');
    slot.style.opacity = '0.75';
    slot.style.minWidth = '84px';
    const slotText = humanize(rowData.slot);
    slot.textContent = slotText ? `${slotText.charAt(0).toUpperCase()}${slotText.slice(1)}:` : `${rowData.slot}:`;

    const name = document.createElement('span');
    name.style.flex = '1 1 auto';
    name.style.minWidth = '0';
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    name.style.whiteSpace = 'nowrap';
    if (rowData.item) {
      const rs = localRarityStyle(rowData.item.rarityName);
      name.textContent = bracketize(sanitize(rowData.item.name || rowData.item.description || rowData.item.type || 'item'));
      name.style.color = rs.color;
      name.style.fontWeight = rs.weight;
    } else {
      name.textContent = '(empty)';
      name.style.opacity = '0.65';
    }

    row.appendChild(slot);
    row.appendChild(name);
    if (rowData.blocked) {
      const blocked = document.createElement('span');
      blocked.textContent = rowData.reason ? `Blocked: ${rowData.reason}` : 'Blocked';
      blocked.style.fontSize = '11px';
      blocked.style.color = '#ffbf5a';
      row.appendChild(blocked);
    }

    row.addEventListener('click', () => setSel(idx));
    list.appendChild(row);
    return row;
  });

  function applyFilter() {
    rowsData.forEach((rd, i) => {
      const empty = !rd.item && !rd.blocked;
      rows[i].style.display = (hideEmpty && empty) ? 'none' : 'flex';
    });
  }

  function findNextVisible(from, dir) {
    let i = from + dir;
    while (i >= 0 && i < rows.length) {
      if (rows[i].style.display !== 'none') return i;
      i += dir;
    }
    return null;
  }

  applyFilter();

  cb.addEventListener('change', () => {
    hideEmpty = cb.checked;
    (/** @type {any} */ (panel))._hideEmptySlots = hideEmpty;
    applyFilter();
    if (rows[sel]?.style.display === 'none') {
      const next = findNextVisible(sel, 1) ?? findNextVisible(sel, -1);
      if (next !== null) setSel(next);
    }
  });

  let sel = 0;
  const savedSlot = String((/** @type {any} */ (panel))._equipmentSelectionSlot || '');
  const savedIdx = rowsData.findIndex((row) => row.slot === savedSlot);
  if (savedIdx >= 0) sel = savedIdx;
  if (rows[sel]?.style.display === 'none') {
    const vis = findNextVisible(sel, 1) ?? findNextVisible(sel, -1);
    if (vis !== null) sel = vis;
  }

  function createActionButton(label, onClick, disabled = false) {
    const btn = document.createElement('button');
    btn.textContent = label;
    decorateButton(btn);
    btn.style.minHeight = '44px';
    btn.style.padding = '8px 12px';
    if (disabled) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    }
    btn.addEventListener('click', onClick);
    return btn;
  }

  function updateDetail() {
    const row = rowsData[sel];
    detail.innerHTML = '';
    actions.innerHTML = '';
    if (!row) return;

    (/** @type {any} */ (panel))._equipmentSelectionSlot = row.slot;

    const slotTitle = document.createElement('div');
    slotTitle.style.fontWeight = 'bold';
    slotTitle.style.marginBottom = '4px';
    const slotText = humanize(row.slot);
    slotTitle.textContent = slotText ? `${slotText.charAt(0).toUpperCase()}${slotText.slice(1)}` : row.slot;
    detail.appendChild(slotTitle);

    if (row.blocked) {
      const blockedLine = document.createElement('div');
      blockedLine.style.color = '#ffbf5a';
      blockedLine.style.marginBottom = '4px';
      blockedLine.textContent = row.reason ? `Blocked: ${row.reason}` : 'Blocked';
      detail.appendChild(blockedLine);
    }

    if (row.item) {
      if (row.slot === 'brain') {
        const itemBody = document.createElement('div');
        detail.appendChild(itemBody);
        renderItemDetails(itemBody, row.item);
        actions.appendChild(createActionButton('Change Spell', () => {
          openSpellPicker();
        }));
      } else {
        const itemBody = document.createElement('div');
        detail.appendChild(itemBody);
        renderItemDetails(itemBody, row.item);
      }
      if (row.slot !== 'brain' && Number.isInteger(row.item.id) && row.item.id > 0) {
        actions.appendChild(createActionButton('Unequip', () => {
          window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: row.item.id } }));
        }));
        if (row.item.identified === false) {
          const hasScroll = scrollOfIdentifyId > 0;
          actions.appendChild(createActionButton('Identify', () => {
            if (hasScroll) {
              window.dispatchEvent(new CustomEvent('ui:requestApply', {
                detail: { toolId: scrollOfIdentifyId, targetItemId: row.item.id },
              }));
            }
          }, !hasScroll));
        }
      }
      hideItemTooltip();
    } else {
      const empty = document.createElement('div');
      empty.textContent = '(nothing equipped)';
      empty.style.opacity = '0.75';
      detail.appendChild(empty);
      const canEquip = !row.blocked;
      if (row.slot === 'brain') {
        actions.appendChild(createActionButton('Choose Spell', () => {
          openSpellPicker();
        }));
      } else {
        actions.appendChild(createActionButton('Equip', () => {
          openInventoryForSlot(row.slot);
        }, !canEquip));
      }
      hideItemTooltip();
    }

  }

  function setSel(next) {
    sel = Math.max(0, Math.min(rowsData.length - 1, next | 0));
    rows.forEach((row, i) => {
      row.style.outline = (i === sel) ? '2px solid #55aaff' : 'none';
      row.style.background = (i === sel) ? '#0b1323' : '#0f1421';
    });
    rows[sel]?.scrollIntoView({ block: 'nearest' });
    updateDetail();
  }

  function onKey(e) {
    if (panel.style.display !== 'block') return;
    if (e.target === cb) return;
    const k = e.key;
    if (k === 'ArrowUp') { const n = findNextVisible(sel, -1); if (n !== null) setSel(n); e.preventDefault(); }
    else if (k === 'ArrowDown') { const n = findNextVisible(sel, 1); if (n !== null) setSel(n); e.preventDefault(); }
    else if (k === 'Home') { const n = findNextVisible(-1, 1); if (n !== null) setSel(n); e.preventDefault(); }
    else if (k === 'End') { const n = findNextVisible(rowsData.length, -1); if (n !== null) setSel(n); e.preventDefault(); }
    else if (k === 'Enter' || k === 'e' || k === 'E') {
      const row = rowsData[sel];
      if (row?.slot === 'brain') {
        openSpellPicker();
        e.preventDefault();
      } else if (Number.isInteger(row?.item?.id) && row.item.id > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: row.item.id } }));
        e.preventDefault();
      } else if (row && !row.blocked) {
        openInventoryForSlot(row.slot);
        e.preventDefault();
      }
    }
    else if (k === 'i' || k === 'I') {
      window.dispatchEvent(new CustomEvent('ui:openInventory'));
      e.preventDefault();
    }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
    else if (k === 'c' || k === 'C') {
      window.dispatchEvent(new CustomEvent('ui:openCharacter'));
      e.preventDefault();
    }
  }

  setSel(sel);
  const keyHandler = (/** @type {KeyboardEvent} */ e) => onKey(e);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      detach();
    }
  });

  const detach = () => {
    window.removeEventListener('keydown', keyHandler);
    obs.disconnect();
    if ((/** @type {any} */ (panel))._equipmentDetach === detach) {
      (/** @type {any} */ (panel))._equipmentDetach = null;
    }
  };

  window.addEventListener('keydown', keyHandler);
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
  (/** @type {any} */ (panel))._equipmentDetach = detach;
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<{id:string,name:string,symbol?:string,cost?:number,description?:string,targetEffects?:string[]}>} spells @param {string|null} activeId */
export function renderSpellPicker(panel, spells, activeId, bindSlot) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = typeof bindSlot === 'number'
    ? `Bind Spell to Slot ${bindSlot + 1}`
    : 'Select Active Spell';
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
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      flexDirection: 'column',
      padding: '6px 8px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: sp.id === activeId ? '#0b1323' : '#0f1421', cursor: 'pointer'
    });
    const head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
    });
    if (sp.symbol) {
      const sym = document.createElement('span');
      sym.textContent = sp.symbol;
      sym.style.fontSize = '18px';
      head.appendChild(sym);
    }
    const name = document.createElement('span');
    name.textContent = sp.name ? `[${sp.name}]` : `[${sp.id}]`;
    const cost = document.createElement('span');
    cost.style.marginLeft = 'auto'; cost.style.opacity = '0.8'; cost.textContent = sp.cost ? `Mana ${sp.cost}` : '';
    head.appendChild(name);
    head.appendChild(cost);
    row.appendChild(head);

    const desc = String(sp.description || '').trim();
    if (desc) {
      const descLine = document.createElement('div');
      descLine.textContent = desc;
      descLine.style.opacity = '0.85';
      descLine.style.fontSize = '12px';
      descLine.style.fontStyle = 'italic';
      row.appendChild(descLine);
    }

    const targetEffects = Array.isArray(sp.targetEffects)
      ? sp.targetEffects.map((line) => String(line || '').trim()).filter(Boolean)
      : [];
    for (const effect of targetEffects.slice(0, 2)) {
      const effectLine = document.createElement('div');
      effectLine.textContent = `\u2022 ${effect}`;
      effectLine.style.opacity = '0.85';
      effectLine.style.fontSize = '11px';
      effectLine.style.color = '#9fd6ff';
      row.appendChild(effectLine);
    }

    row.addEventListener('click', () => {
      const detail = { spellId: sp.id };
      if (typeof bindSlot === 'number') detail.bindSlot = bindSlot;
      window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', { detail }));
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
export function renderMessageLog(panel, entries) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  el.style.fontSize = '15px';
  const title = document.createElement('div');
  title.textContent = 'Message Log';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  title.style.fontSize = '17px';
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

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {Array<any>} items
 * @param {number} altarId
 */
export function renderAltarOfferChooser(panel, items, altarId) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'Offer which item?';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.textContent = '(you have nothing to offer)';
    empty.style.marginBottom = '10px';
    el.appendChild(empty);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    decorateButton(closeBtn);
    closeBtn.addEventListener('click', () => hide(panel));
    el.appendChild(closeBtn);
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
    name.textContent = bracketize(sanitize(it.name || it.description || it.type || 'item'));
    Object.assign(name.style, rs);

    const qty = document.createElement('span');
    qty.style.opacity = '0.8';
    qty.textContent = `x${Math.max(1, Number(it.count || 1))}`;

    const value = document.createElement('span');
    value.style.marginLeft = 'auto';
    value.style.opacity = '0.75';
    value.style.fontSize = '12px';
    value.textContent = `value ${Math.max(0, Number(it.value || 0))}`;

    row.appendChild(name);
    row.appendChild(qty);
    row.appendChild(value);

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', () => offerSelected());
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.style.fontSize = '12px';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Offer \u00b7 Esc=Close';
  el.appendChild(hint);

  const actionsEl = document.createElement('div');
  actionsEl.style.display = 'flex';
  actionsEl.style.gap = '8px';
  actionsEl.style.marginTop = '10px';

  const offerBtn = document.createElement('button');
  offerBtn.textContent = 'Offer';
  decorateButton(offerBtn);
  offerBtn.addEventListener('click', () => offerSelected());

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  decorateButton(cancelBtn);
  cancelBtn.addEventListener('click', () => hide(panel));

  actionsEl.appendChild(offerBtn);
  actionsEl.appendChild(cancelBtn);
  el.appendChild(actionsEl);

  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
    showItemTooltip(items[sel], rows[sel]);
  }

  function offerSelected() {
    const it = items[sel];
    if (!it) return;
    window.dispatchEvent(new CustomEvent('ui:requestAltarOffer', {
      detail: { altarId, itemId: it.id }
    }));
    hide(panel);
  }

  setSel(0);

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(items.length - 1); e.preventDefault(); }
    else if (k === 'Enter') { offerSelected(); e.preventDefault(); }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
  }

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
export function renderPickupChooser(panel, items) {
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
      const ids = getUiItemEntityIds(it);
      for (const id of ids) {
        if (cb.checked) selections.add(id);
        else selections.delete(id);
      }
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
  hint.textContent = '\u2191/\u2193 select \u00b7 Space=Toggle \u00b7 Enter=Take All \u00b7 Esc=Close';
  el.appendChild(hint);

  const actionsEl = document.createElement('div');
  actionsEl.style.display = 'flex';
  actionsEl.style.gap = '8px';
  actionsEl.style.marginTop = '10px';

  function takeSelected() {
    const ids = Array.from(selections);
    if (!ids.length) return;
    window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    hide(panel);
  }

  function takeAll() {
    const ids = items.flatMap((i) => getUiItemEntityIds(i));
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

  actionsEl.appendChild(btnPickAll);
  actionsEl.appendChild(btnPickSel);
  actionsEl.appendChild(btnCancel);
  el.appendChild(actionsEl);

  /** @param {number} i */
  function setSel(i) {
    sel = Math.max(0, Math.min(items.length - 1, i|0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
    showItemTooltip(items[sel], rows[sel]);
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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
export function renderUseChooser(panel, items) {
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
    showItemTooltip(items[sel], rows[sel]);
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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
export function renderThrowChooser(panel, items) {
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
    showItemTooltip(items[sel], rows[sel]);
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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
export function renderApplyToolChooser(panel, tools, onSelect) {
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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
export function renderApplyTargetChooser(panel, targets, toolId, onSelect) {
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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

/**
 * renderSlotChooser — asks player to pick Main Hand or Off-Hand when equipping a 1H weapon
 * with an ambiguous target slot.
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{itemId:number, itemName:string, mainName:string, offName:string, offhandOccupied:boolean}} opts
 */
export function renderSlotChooser(panel, opts) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = `Wield ${bracketize(sanitize(opts.itemName))} where?`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  const mainLabel = opts.offhandOccupied
    ? `Main Hand  (replace ${bracketize(sanitize(opts.mainName))})`
    : `Main Hand  (replace ${bracketize(sanitize(opts.mainName))})`;
  const offLabel = opts.offhandOccupied
    ? `Off-Hand  (replace ${bracketize(sanitize(opts.offName))})`
    : `Off-Hand  (dual wield)`;

  const choices = [
    { label: mainLabel, slot: 'weapon' },
    { label: offLabel, slot: 'offhand' },
  ];

  let sel = 0;
  const rows = choices.map((ch, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 10px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421', cursor: 'pointer', marginBottom: '4px',
    });
    row.textContent = ch.label;
    row.addEventListener('mouseenter', () => { setSel(idx); });
    row.addEventListener('click', () => { pick(idx); });
    el.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Confirm \u00b7 Esc=Cancel';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(choices.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
  }

  function pick(i) {
    const slot = choices[i]?.slot;
    if (!slot) return;
    hide(panel);
    window.dispatchEvent(new CustomEvent('ui:requestEquip', {
      detail: { itemId: opts.itemId, targetSlot: slot }
    }));
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Enter') { pick(sel); e.preventDefault(); }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
  }

  setSel(0);
  window.addEventListener('keydown', onKey);
  const obs = new MutationObserver(() => {
    if (panel.style.display === 'none') {
      window.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{shopkeeperId:number, buyMarkup:number, sellDiscount:number, mode:string, activeTab?:string}} state */
export function renderShop(panel, data, state) {
  const prevDetach = /** @type {any} */ (panel)._shopDetach;
  if (typeof prevDetach === 'function') { try { prevDetach(); } catch (_) {} }
  /** @type {any} */ (panel)._shopDetach = null;

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const mode = data?.mode || state?.mode || 'browse';
  const vendorKind = String(data?.vendorKind || state?.vendorKind || '');
  const shopItems = data?.shopItems || [];
  const playerItems = data?.playerItems || [];
  const appraisableItems = data?.appraisableItems || [];
  const unpaidItems = data?.unpaidItems || [];
  const totalBill = data?.totalBill || 0;
  const gold = data?.gold || 0;

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' });
  const titleWrap = document.createElement('div');
  Object.assign(titleWrap.style, { display: 'flex', flexDirection: 'column', gap: '2px' });
  const title = document.createElement('div');
  title.textContent = mode === 'checkout'
    ? (vendorKind === 'gem' ? 'Gem Dealer Invoice' : vendorKind === 'book' ? 'Bookseller Invoice' : 'Shopkeeper Invoice')
    : (vendorKind === 'gem' ? 'Gem Dealer' : vendorKind === 'book' ? 'Bookseller' : 'Shopkeeper');
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  titleWrap.appendChild(title);
  if (mode !== 'checkout' && vendorKind === 'gem') {
    const subtitle = document.createElement('div');
    subtitle.textContent = 'All stones on display are identified. Socketable gems list their effects in the tooltip.';
    subtitle.style.fontSize = '12px';
    subtitle.style.opacity = '0.78';
    subtitle.style.maxWidth = '34ch';
    titleWrap.appendChild(subtitle);
  }
  const goldLabel = document.createElement('div');
  goldLabel.textContent = `Gold: ${gold}`;
  goldLabel.style.marginLeft = 'auto'; goldLabel.style.color = '#ffde5a'; goldLabel.style.fontWeight = 'bold';
  header.appendChild(titleWrap); header.appendChild(goldLabel);
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

    const actionsEl = document.createElement('div');
    Object.assign(actionsEl.style, { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' });
    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay Bill';
    decorateButton(payBtn);
    payBtn.style.fontWeight = 'bold';
    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Return Item';
    decorateButton(returnBtn);
    actionsEl.appendChild(payBtn);
    actionsEl.appendChild(returnBtn);
    el.appendChild(actionsEl);

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
      hint.textContent = 'P=Pay bill \u00b7 Esc=Close';
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
        const rowReturnBtn = document.createElement('button');
        rowReturnBtn.textContent = 'Return';
        decorateButton(rowReturnBtn);
        rowReturnBtn.style.marginLeft = '8px';
        rowReturnBtn.style.minHeight = '32px';
        rowReturnBtn.style.padding = '0 10px';
        row.appendChild(rowReturnBtn);
        row.addEventListener('mouseenter', () => setSel(idx));
        row.addEventListener('click', () => setSel(idx));
        rowReturnBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          returnByIndex(idx);
        });
        listContainer.appendChild(row);
        rows.push(row);
      });
      hint.textContent = 'Select item \u00b7 Return button/Enter=Return \u00b7 P=Pay \u00b7 Esc=Close';
      setSel(0);
    }

    function setSel(i) {
      sel = Math.max(0, Math.min(unpaidItems.length - 1, i | 0));
      rows.forEach((r, j) => {
        r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
        r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
      });
      showItemTooltip(unpaidItems[sel], rows[sel]);
    }

    function payBill() {
      window.dispatchEvent(new CustomEvent('ui:payBill', {
        detail: { shopkeeperId: state.shopkeeperId }
      }));
    }

    function returnSelected() {
      returnByIndex(sel);
    }

    /**
     * @param {number} idx
     */
    function returnByIndex(idx) {
      const it = unpaidItems[idx];
      if (!it) return;
      for (const itemId of getUiItemEntityIds(it)) {
        window.dispatchEvent(new CustomEvent('ui:removeFromInvoice', {
          detail: { shopkeeperId: state.shopkeeperId, itemId }
        }));
      }
    }

    payBtn.addEventListener('click', payBill);
    returnBtn.addEventListener('click', returnSelected);

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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
    /** @type {any} */ (panel)._shopDetach = () => { window.removeEventListener('keydown', onKey); obs.disconnect(); };
    return;
  }

  // Tabs
  let activeTab = state.activeTab || 'buy';
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '4px', marginBottom: '10px' });

  const buyTab = document.createElement('button');
  buyTab.textContent = 'Buy';
  decorateButton(buyTab);

  const sellTab = document.createElement('button');
  sellTab.textContent = 'Sell';
  decorateButton(sellTab);

  const appraiseTab = document.createElement('button');
  appraiseTab.textContent = 'Appraise';
  decorateButton(appraiseTab);

  tabBar.appendChild(buyTab); tabBar.appendChild(sellTab); tabBar.appendChild(appraiseTab);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  let sel = 0;
  let currentItems = [];
  let _listDetach = null;

  function updateTabStyle() {
    buyTab.style.background = activeTab === 'buy' ? '#1a2640' : '#101626';
    buyTab.style.borderColor = activeTab === 'buy' ? '#55aaff' : '#2d3b52';
    sellTab.style.background = activeTab === 'sell' ? '#1a2640' : '#101626';
    sellTab.style.borderColor = activeTab === 'sell' ? '#55aaff' : '#2d3b52';
    appraiseTab.style.background = activeTab === 'appraise' ? '#1a2640' : '#101626';
    appraiseTab.style.borderColor = activeTab === 'appraise' ? '#55aaff' : '#2d3b52';
  }

  function renderList() {
    if (typeof _listDetach === 'function') { try { _listDetach(); } catch (_) {} }
    _listDetach = null;
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'buy'
      ? shopItems
      : activeTab === 'sell'
        ? playerItems
        : appraisableItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'buy'
        ? '(nothing for sale)'
        : activeTab === 'sell'
          ? '(nothing to sell)'
          : '(nothing to appraise)';
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

      const price = document.createElement('span');
      price.style.marginLeft = 'auto';
      price.style.color = '#ffde5a';
      price.style.fontWeight = 'bold';
      const cost = activeTab === 'buy'
        ? (it.buyPrice || 0)
        : activeTab === 'sell'
          ? (it.sellPrice || 0)
          : (it.appraiseFee || 0);
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
      showItemTooltip(currentItems[sel], rows[sel]);
    }

    setSel(0);
    hint.textContent = activeTab === 'buy'
      ? '\u2191/\u2193 select \u00b7 Enter=Buy \u00b7 Tab=Sell tab \u00b7 Esc=Close'
      : activeTab === 'sell'
        ? '\u2191/\u2193 select \u00b7 Enter=Sell \u00b7 Tab=Appraise tab \u00b7 Esc=Close'
        : '\u2191/\u2193 select \u00b7 Enter=Appraise \u00b7 Tab=Buy tab \u00b7 Esc=Close';

    function doTransaction() {
      const it = currentItems[sel]; if (!it) return;
      const ids = getUiItemEntityIds(it);
      if (!ids.length) return;
      if (activeTab === 'buy') {
        for (const itemId of ids) {
          window.dispatchEvent(new CustomEvent('ui:requestBuy', {
            detail: { shopkeeperId: state.shopkeeperId, itemId }
          }));
        }
      } else if (activeTab === 'sell') {
        for (const itemId of ids) {
          window.dispatchEvent(new CustomEvent('ui:requestSell', {
            detail: { shopkeeperId: state.shopkeeperId, itemId }
          }));
        }
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestAppraise', {
          detail: { shopkeeperId: state.shopkeeperId, itemId: ids[0] }
        }));
      }
    }

    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'Tab') {
        e.preventDefault();
        if (activeTab === 'buy') activeTab = 'sell';
        else if (activeTab === 'sell') activeTab = 'appraise';
        else activeTab = 'buy';
        state.activeTab = activeTab;
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
    _listDetach = () => { window.removeEventListener('keydown', onKey); obs.disconnect(); };
  }

  /** @type {any} */ (panel)._shopDetach = () => { if (typeof _listDetach === 'function') _listDetach(); };

  buyTab.addEventListener('click', () => { activeTab = 'buy'; state.activeTab = activeTab; updateTabStyle(); renderList(); });
  sellTab.addEventListener('click', () => { activeTab = 'sell'; state.activeTab = activeTab; updateTabStyle(); renderList(); });
  appraiseTab.addEventListener('click', () => { activeTab = 'appraise'; state.activeTab = activeTab; updateTabStyle(); renderList(); });

  updateTabStyle();
  renderList();
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{chestId:number, label?:string}} state */
export function renderChest(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const chestItems = data?.chestItems || [];
  const playerItems = data?.playerItems || [];
  const containerLabel = state?.label || 'Chest';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = containerLabel;
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

  const takeAllBtn = document.createElement('button');
  takeAllBtn.textContent = 'Take All';
  decorateButton(takeAllBtn);

  tabBar.appendChild(takeTab); tabBar.appendChild(putTab); tabBar.appendChild(takeAllBtn);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '36vh'; listContainer.style.overflow = 'auto';
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
    takeAllBtn.style.display = activeTab === 'take' ? '' : 'none';
  }

  function doTakeAll() {
    if (activeTab !== 'take') return;
    const chestId = Number(state.chestId || 0) | 0;
    if (!(chestId > 0)) return;
    window.dispatchEvent(new CustomEvent('ui:requestChestTakeAll', { detail: { chestId } }));
  }
  takeAllBtn.addEventListener('click', doTakeAll);

  function renderList() {
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'take' ? chestItems : playerItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'take' ? `(${containerLabel.toLowerCase()} is empty)` : '(nothing to store)';
      listContainer.appendChild(empty);
      hint.textContent = 'Tab=Switch \u00b7 Esc=Close';
      hideItemTooltip();
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
      if (it.coating && it.coating.kind) {
        const dot = document.createElement('span');
        dot.textContent = '\u2022';
        dot.style.color = it.coating.color || '#66dd66';
        dot.style.fontSize = '14px';
        row.appendChild(dot);
      }
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
      showItemTooltip(currentItems[sel], rows[sel], { pinBottomOnMobile: true });
    }

    setSel(0);
    hint.textContent = activeTab === 'take'
      ? '\u2191/\u2193 select \u00b7 Enter=Take \u00b7 a=Take All \u00b7 Tab=Put tab \u00b7 Esc=Close'
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
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'a' && activeTab === 'take') { doTakeAll(); e.preventDefault(); }
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

// --- Book reader overlay (decorative dungeon books) ------------------------
/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {string} title
 * @param {string} text
 */
export function renderBookReader(panel, title, text) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' });
  const icon = document.createElement('span');
  icon.textContent = '\uD83D\uDCD6'; // book emoji
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
export function renderDeathLog(panel, records) {
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
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
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

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{rackId:number}} state */
export function renderRack(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';

  const rackItems = /** @type {any[]} */ ((/** @type {any} */ (data))?.rackItems || []);

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = 'Weapon Rack';
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  header.appendChild(title);
  el.appendChild(header);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  if (!rackItems.length) {
    const empty = document.createElement('div');
    empty.textContent = '(rack is empty)';
    listContainer.appendChild(empty);
    hint.textContent = 'Esc=Close';
    return;
  }

  let sel = 0;
  const rows = rackItems.map((it, idx) => {
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

    if ((it.count || 1) > 1) {
      const qty = document.createElement('span');
      qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
      row.appendChild(qty);
    }

    if (it.slot) {
      const slotBadge = document.createElement('span');
      slotBadge.textContent = it.slot;
      Object.assign(slotBadge.style, { marginLeft: 'auto', opacity: '0.5', fontSize: '11px' });
      row.appendChild(slotBadge);
    }

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', () => doTake());
    listContainer.appendChild(row);
    return row;
  });

  function setSel(/** @type {number} */ i) {
    sel = Math.max(0, Math.min(rackItems.length - 1, i | 0));
    rows.forEach((r, j) => {
      r.style.outline = (j === sel) ? '2px solid #55aaff' : 'none';
      r.style.background = (j === sel) ? '#0b1323' : '#0f1421';
    });
    showItemTooltip(rackItems[sel], rows[sel]);
  }

  setSel(0);
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Take \u00b7 Esc=Close';

  function doTake() {
    const it = rackItems[sel]; if (!it) return;
    const rackId = Number(state.rackId || 0) | 0;
    const itemId = Number(it.id || 0) | 0;
    if (!(rackId > 0) || !(itemId > 0)) return;
    window.dispatchEvent(new CustomEvent('ui:requestRackTake', { detail: { rackId, itemId } }));
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
    else if (k === 'Enter') { doTake(); e.preventDefault(); }
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
