// display/ui/overlay.js
// Minimal UI overlays for inventory and message log; display-only.

import { ensureMemoryGraph } from './memoryGraph.js';
import { createDebugGraph } from './debugGraph.js';
import { renderAlchemyBench } from './alchemyBenchOverlay.js';
import { renderCookingFire } from './cookingFireOverlay.js';
import { versionLoaded } from '../../shared/version.js';

const PANEL_Z_BASE = 1200;
let _panelZCounter = PANEL_Z_BASE;
const CHARACTER_SLOT_ORDER = Object.freeze([
  'brain',
  'weapon',
  'armor',
  'head',
  'neck',
  'belt',
  'gloves',
  'shield',
  'ring1',
  'ring2',
  'legs',
  'feet',
  'ammo',
  'ranged',
]);
const CHARACTER_MENU_TABS = Object.freeze([
  { key: 'character', icon: '@', label: 'Character', eventName: 'ui:openCharacter' },
  { key: 'inventory', icon: '\u{1F392}', label: 'Inventory', eventName: 'ui:openInventory' },
  { key: 'equipment', icon: '\u{1F6E1}\uFE0F', label: 'Equipment', eventName: 'ui:openEquipment' },
  { key: 'settings', icon: '\u2699\uFE0F', label: 'Settings', eventName: 'ui:openSettings' },
]);

/**
 * @param {HTMLDivElement} host
 * @param {'character'|'inventory'|'equipment'|'settings'} activeKey
 */
function appendCharacterMenuTabs(host, activeKey) {
  const tabs = document.createElement('div');
  Object.assign(tabs.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '6px',
    marginBottom: '10px',
  });

  for (const tab of CHARACTER_MENU_TABS) {
    const btn = document.createElement('button');
    decorateButton(btn);
    Object.assign(btn.style, {
      minHeight: '46px',
      padding: '6px 4px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      borderRadius: '8px',
    });
    const isActive = tab.key === activeKey;
    if (isActive) {
      btn.style.background = '#173458';
      btn.style.borderColor = '#5fb3ff';
      btn.style.color = '#e9f5ff';
      btn.style.boxShadow = '0 0 0 1px rgba(95,179,255,0.2)';
    }

    const icon = document.createElement('span');
    icon.textContent = tab.icon;
    icon.style.lineHeight = '1';
    icon.style.fontSize = '16px';
    const label = document.createElement('span');
    label.textContent = tab.label;
    label.style.fontSize = '11px';
    label.style.lineHeight = '1';
    btn.title = tab.label;
    btn.setAttribute('aria-label', tab.label);
    if (isActive) btn.setAttribute('aria-current', 'page');
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent(tab.eventName));
    });
    tabs.appendChild(btn);
  }

  host.appendChild(tabs);
}

/**
 * Mark an element as intentionally scrollable under global input lockdown.
 * @param {HTMLElement} el
 */
function markScrollable(el) {
  if (!(el instanceof HTMLElement)) return;
  el.dataset.allowScroll = 'true';
  el.style.touchAction = 'pan-y';
  el.style.overscrollBehavior = 'contain';
  el.style.webkitOverflowScrolling = 'touch';
}

import { getInventoryDefaultAction, isInventoryItemEquippable, isInventoryItemUsable } from './inventoryUtils.js';
export { getInventoryDefaultAction };

export function initOverlays() {
  const root = ensureRoot();
  const inv = ensurePanel('inventory');
  const char = ensurePanel('character');
  const equip = ensurePanel('equipment');
  const settingsPanel = ensurePanel('settings');
  const log = ensurePanel('messageLog');
  const pick = ensurePanel('pickup');
  const usePanel = ensurePanel('use');
  const throwPanel = ensurePanel('throw');
  const spells = ensurePanel('spells');
  const alchemy = ensurePanel('alchemy');
  const cooking = ensurePanel('cooking');
  const shop = ensurePanel('shop');
  const chest = ensurePanel('chest');
  const rack = ensurePanel('rack');
  const altar = ensurePanel('altar');
  const groundTip = ensureGroundTooltip(root);
  _itemTooltip = ensureItemTooltip(root);
  const stairTip = ensureStairTooltip(root);
  const trapTip = ensureTrapTooltip(root);
  const tombstoneTip = ensureTombstoneTooltip(root);
  const devNoticeTip = ensureDevNoticeTooltip(root);
  const spellGestureHint = ensureSpellGestureHint(root);
  const gestureDebug = ensureGestureDebugLayer(root);
  const memoryGraph = ensureMemoryGraph(root);
  const deityGraph = createDebugGraph({
    id: 'deity-mood-graph-layer',
    title: 'Deity Mood',
    width: 240,
    height: 160,
    position: { left: '8px', bottom: '204px' },
    zIndex: 910,
    series: [
      { key: 'wrath',     color: '#ff4444', label: 'Wrath' },
      { key: 'serenity',  color: '#4488ff', label: 'Serenity' },
      { key: 'hunger',    color: '#ff8800', label: 'Hunger' },
      { key: 'amusement', color: '#44cc44', label: 'Amusement' },
      { key: 'sorrow',    color: '#aa44ff', label: 'Sorrow' },
      { key: 'chaos',     color: '#ff44ff', label: 'Chaos' },
    ],
    maxPoints: 60,
    sampleInterval: 1000,
    normalizedY: true,
    unavailableMessage: 'No deity data',
  });
  root.appendChild(deityGraph.canvas);
  const deathLog = ensurePanel('deathLog');
  const bookReader = ensurePanel('bookReader');
  const deathScreen = ensureDeathScreen(root);
  const WRATH_DEATH_SCREEN_DELAY_MS = 320;
  let deathScreenShowTimer = 0;

  // Always-on, semi-transparent message ticker (non-modal)
  const ticker = ensureMessageTicker(root);
  let spellGestureTimer = 0;

  window.addEventListener('ui:openInventory', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const slotFilter = String(e?.detail?.slotFilter || '').trim().toLowerCase();
    (/** @type {any} */ (inv))._inventorySlotFilter = slotFilter || '';
    hide(char);
    hide(equip);
    hide(settingsPanel);
    show(inv);
    // Request data from app; app will respond with ui:inventoryData
    window.dispatchEvent(new CustomEvent('ui:requestInventoryData', { detail: { slotFilter } }));
  });
  window.addEventListener('ui:openCharacter', () => {
    hide(inv);
    hide(equip);
    hide(settingsPanel);
    show(char);
    window.dispatchEvent(new CustomEvent('ui:requestCharacterData'));
  });
  window.addEventListener('ui:openEquipment', () => {
    hide(inv);
    hide(char);
    hide(settingsPanel);
    show(equip);
    window.dispatchEvent(new CustomEvent('ui:requestEquipmentData'));
  });
  window.addEventListener('ui:openSettings', () => {
    hide(inv);
    hide(char);
    hide(equip);
    show(settingsPanel);
    window.dispatchEvent(new CustomEvent('ui:requestSettingsData'));
  });
  // Toggle inventory panel open/close
  window.addEventListener('ui:toggleInventory', () => {
    if (inv.style.display === 'block') {
      hide(inv);
    } else {
      hide(char);
      hide(equip);
      hide(settingsPanel);
      show(inv);
      (/** @type {any} */ (inv))._inventorySlotFilter = '';
      window.dispatchEvent(new CustomEvent('ui:requestInventoryData'));
    }
  });
  window.addEventListener('ui:toggleCharacter', () => {
    if (char.style.display === 'block') {
      hide(char);
    } else {
      hide(inv);
      hide(equip);
      hide(settingsPanel);
      show(char);
      window.dispatchEvent(new CustomEvent('ui:requestCharacterData'));
    }
  });
  window.addEventListener('ui:toggleEquipment', () => {
    if (equip.style.display === 'block') {
      hide(equip);
    } else {
      hide(inv);
      hide(char);
      hide(settingsPanel);
      show(equip);
      window.dispatchEvent(new CustomEvent('ui:requestEquipmentData'));
    }
  });
  window.addEventListener('ui:toggleSettings', () => {
    if (settingsPanel.style.display === 'block') {
      hide(settingsPanel);
    } else {
      hide(inv);
      hide(char);
      hide(equip);
      show(settingsPanel);
      window.dispatchEvent(new CustomEvent('ui:requestSettingsData'));
    }
  });
  window.addEventListener('ui:settingsData', (ev) => {
    const data = /** @type {CustomEvent} */ (ev).detail || {};
    renderSettings(settingsPanel, data, memoryGraph, deityGraph);
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
  // Toggle deity mood graph
  window.addEventListener('ui:toggleDeityMoodGraph', () => {
    if (deityGraph.canvas.style.display === 'block') {
      deityGraph.hide();
      deityGraph.stopSampling();
    } else {
      deityGraph.show();
      deityGraph.startSampling();
    }
  });
  // Late-bind deity mood sampler from main.js
  window.addEventListener('debug:registerDeityMoodSampler', (ev) => {
    const fn = /** @type {CustomEvent} */ (ev).detail?.sampler;
    if (typeof fn === 'function') deityGraph.setSampler(fn);
  });
  window.addEventListener('ui:openMessageLog', () => {
    show(log);
    // Request messages; app may respond with ui:messageLogData
    window.dispatchEvent(new CustomEvent('ui:requestMessageLogData'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const tabPanels = [char, inv, equip, settingsPanel];
      const curIdx = tabPanels.findIndex(p => p.style.display === 'block');
      if (curIdx !== -1) {
        e.preventDefault();
        const next = CHARACTER_MENU_TABS[(curIdx + (e.shiftKey ? CHARACTER_MENU_TABS.length - 1 : 1)) % CHARACTER_MENU_TABS.length];
        window.dispatchEvent(new CustomEvent(next.eventName));
      }
    }
    if (e.key === 'Escape') {
      // Close every ui-panel that is currently visible
      for (const p of document.querySelectorAll('.ui-panel')) {
        if (p.style.display === 'block') p.style.display = 'none';
      }
      hideItemTooltip();
      // Close debug graphs
      if (memoryGraph.canvas.style.display === 'block') {
        memoryGraph.hide();
        memoryGraph.stopSampling();
      }
      if (deityGraph.canvas.style.display === 'block') {
        deityGraph.hide();
        deityGraph.stopSampling();
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
    const items = (e?.detail?.bagItems) || (e?.detail?.items) || [];
    const equippedBySlot = e?.detail?.equippedBySlot || null;
    const ground = e?.detail?.ground || null;
    const slotFilter = String(e?.detail?.slotFilter || '').trim().toLowerCase();
    const scrollOfIdentifyId = Number(e?.detail?.scrollOfIdentifyId || 0) | 0;
    if (inv.style.display === 'block') renderInventory(inv, items, ground, slotFilter, scrollOfIdentifyId);
    if (equip.style.display === 'block') {
      const cachedPlayerName = String((/** @type {any} */ (equip))._equipmentPlayerName || 'Hero');
      renderEquipment(equip, equippedBySlot, cachedPlayerName, scrollOfIdentifyId);
    }
  });
  window.addEventListener('ui:characterData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const playerName = String(e?.detail?.playerName || 'Hero');
    const stats = e?.detail?.stats || {};
    const activeEffects = Array.isArray(e?.detail?.activeEffects) ? e.detail.activeEffects : [];
    if (char.style.display === 'block') renderCharacterSheet(char, { playerName, stats, activeEffects });
  });
  window.addEventListener('ui:equipmentData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const equippedBySlot = e?.detail?.equippedBySlot || null;
    const playerName = String(e?.detail?.playerName || 'Hero');
    const scrollOfIdentifyId = Number(e?.detail?.scrollOfIdentifyId || 0) | 0;
    (/** @type {any} */ (equip))._equipmentPlayerName = playerName;
    if (equip.style.display === 'block') renderEquipment(equip, equippedBySlot, playerName, scrollOfIdentifyId);
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

  // Altar offering chooser
  window.addEventListener('ui:altarOfferPrompt', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.items) || [];
    const altarId = Number(e?.detail?.altarId || 0) | 0;
    renderAltarOfferChooser(altar, items, altarId);
    show(altar);
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
    hide(char);
    hide(equip);
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
    hide(equip);
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
  let _shopState = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5, mode: 'browse', activeTab: 'buy' };
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
    _shopState.activeTab = 'buy';
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

  // Cooking fire overlay
  let _cookingState = {
    fireId: 0,
    corpses: [],
    herbs: { count: 0 },
  };
  window.addEventListener('ui:openCookingFire', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _cookingState.fireId = Number(d.fireId || 0) | 0;
    show(cooking);
    renderCookingFire(cooking, _cookingState);
  });
  window.addEventListener('ui:closeCookingFire', () => {
    _cookingState.fireId = 0;
    hide(cooking);
  });
  window.addEventListener('ui:cookingFireData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _cookingState = {
      fireId: Number(d.fireId || _cookingState.fireId || 0) | 0,
      corpses: Array.isArray(d.corpses) ? d.corpses : [],
      herbs: d.herbs && typeof d.herbs === 'object' ? d.herbs : { count: 0 },
    };
    renderCookingFire(cooking, _cookingState);
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

  // Rack overlay
  let _rackState = { rackId: 0 };
  window.addEventListener('ui:openRack', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _rackState.rackId = d.rackId || 0;
    show(rack);
  });
  window.addEventListener('ui:rackData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderRack(rack, d, _rackState);
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

  // Trap tooltip lifecycle
  window.addEventListener('ui:showTrapTooltip', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderTrapTooltip(trapTip, d);
    trapTip.style.display = 'block';
  });
  window.addEventListener('ui:hideTrapTooltip', () => {
    trapTip.style.display = 'none';
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

  // Project development notice tooltip lifecycle
  window.addEventListener('ui:showDevNoticeTooltip', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderDevNoticeTooltip(devNoticeTip, d);
    devNoticeTip.style.display = 'block';
  });
  window.addEventListener('ui:hideDevNoticeTooltip', () => {
    devNoticeTip.style.display = 'none';
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
    spellGestureHint.wrap.style.filter = 'drop-shadow(0 0 22px rgba(120,200,255,0.45))';
    spellGestureHint.caption.textContent = mode === 'learn'
      ? 'Draw a Z to cast your active spell!'
      : '';
    spellGestureHint.caption.style.display = mode === 'learn' ? 'block' : 'none';
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

// --- Floating item tooltip (WoW/Diablo style, shared across all panels) -----
let _itemTooltip = null;

/** @param {HTMLElement} root */
function ensureItemTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'item-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    display: 'none',
    maxWidth: '280px',
    pointerEvents: 'none',
    background: 'rgba(14,18,26,0.96)',
    color: '#dbeaff',
    borderRadius: '10px',
    border: '1px solid #33435f',
    boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace',
    padding: '10px 12px',
    zIndex: '1400',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    fontSize: '13px',
  });
  root.appendChild(tip);
  return tip;
}

/**
 * Mobile-first tooltip pinning target.
 * Coarse pointer + smaller viewport keeps desktop behavior unchanged.
 */
function isMobileTooltipViewport() {
  const coarse = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return coarse && window.innerWidth <= 900;
}

/** @param {HTMLElement} tip */
function resetTooltipPlacement(tip) {
  tip.style.left = '';
  tip.style.right = '';
  tip.style.top = '';
  tip.style.bottom = '';
  tip.style.transform = '';
}

/**
 * Position the tooltip near the anchor element.
 * @param {HTMLElement} tip
 * @param {HTMLElement} anchorEl
 */
function positionTooltip(tip, anchorEl) {
  if (!anchorEl) return;
  resetTooltipPlacement(tip);
  const GAP = 8;
  const MARGIN = 8;
  const ar = anchorEl.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const th = tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 500 || ar.width > vw * 0.6;

  let x, y;
  let placed = false;

  if (!narrow) {
    // Try right of anchor
    x = ar.right + GAP;
    y = ar.top + (ar.height / 2) - (th / 2);
    if (x + tw + MARGIN <= vw && y >= MARGIN && y + th + MARGIN <= vh) {
      placed = true;
    }
    // Try left of anchor
    if (!placed) {
      x = ar.left - GAP - tw;
      y = ar.top + (ar.height / 2) - (th / 2);
      if (x >= MARGIN && y >= MARGIN && y + th + MARGIN <= vh) {
        placed = true;
      }
    }
  }

  // Try above anchor
  if (!placed) {
    x = ar.left + (ar.width / 2) - (tw / 2);
    y = ar.top - GAP - th;
    if (y >= MARGIN) {
      placed = true;
    }
  }

  // Fallback: below anchor
  if (!placed) {
    x = ar.left + (ar.width / 2) - (tw / 2);
    y = ar.bottom + GAP;
  }

  // Clamp to viewport
  x = Math.max(MARGIN, Math.min(vw - tw - MARGIN, x));
  y = Math.max(MARGIN, Math.min(vh - th - MARGIN, y));

  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

/**
 * @param {HTMLElement | null | undefined} anchorEl
 * @returns {HTMLElement | null}
 */
function resolveTooltipPanelInner(anchorEl) {
  if (!anchorEl || typeof anchorEl.closest !== 'function') return null;
  const panel = anchorEl.closest('.ui-panel');
  if (!(panel instanceof HTMLElement)) return null;
  if (panel.style.display === 'none') return null;

  const inner = /** @type {any} */ (panel)._inner;
  if (inner instanceof HTMLElement) return inner;

  const first = panel.firstElementChild;
  return first instanceof HTMLElement ? first : null;
}

/**
 * Position a pinned mobile tooltip under the open panel window.
 * @param {HTMLElement} tip
 * @param {HTMLElement} anchorEl
 * @returns {boolean}
 */
function positionTooltipBelowPanel(tip, anchorEl) {
  const inner = resolveTooltipPanelInner(anchorEl);
  if (!inner) return false;

  resetTooltipPlacement(tip);
  const MARGIN = 8;
  const GAP = 8;
  const rect = inner.getBoundingClientRect();
  const tw = tip.offsetWidth;
  const vw = window.innerWidth;
  let x = rect.left + (rect.width * 0.5) - (tw * 0.5);
  x = Math.max(MARGIN, Math.min(vw - tw - MARGIN, x));

  tip.style.left = `${x}px`;
  tip.style.top = `${Math.max(MARGIN, rect.bottom + GAP)}px`;
  return true;
}

/**
 * @param {HTMLElement} tip
 * @param {HTMLElement} anchorEl
 */
function positionTooltipBottomCenter(tip, anchorEl) {
  if (positionTooltipBelowPanel(tip, anchorEl)) return;
  resetTooltipPlacement(tip);
  tip.style.left = '50%';
  tip.style.bottom = 'max(12px, env(safe-area-inset-bottom, 0px))';
  tip.style.transform = 'translateX(-50%)';
}

/**
 * Show the floating item tooltip near the given anchor element.
 * @param {any} item
 * @param {HTMLElement} anchorEl
 * @param {{ pinBottomOnMobile?: boolean }} [opts]
 */
function showItemTooltip(item, anchorEl, opts) {
  const tip = _itemTooltip;
  if (!tip) return;
  if (!item) { hideItemTooltip(); return; }
  // Anchor inside a hidden panel has no offsetParent — skip showing the
  // tooltip so it doesn't end up at 0,0 (top-left corner).
  if (anchorEl && !anchorEl.offsetParent) { hideItemTooltip(); return; }
  renderItemDetails(tip, item);
  tip.style.display = 'block';
  const pinBottom = !!opts?.pinBottomOnMobile && isMobileTooltipViewport();
  tip.style.maxWidth = pinBottom ? 'min(92vw, 460px)' : '280px';
  tip.style.maxHeight = '';
  if (pinBottom) {
    positionTooltipBottomCenter(tip, anchorEl);
  } else {
    positionTooltip(tip, anchorEl);
  }
}

function hideItemTooltip() {
  if (_itemTooltip) _itemTooltip.style.display = 'none';
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

// --- Trap tooltip (tap to disarm) ------------------------------------------
/** @param {HTMLElement} root */
function ensureTrapTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'trap-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 96px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '180px', pointerEvents: 'auto', display: 'none',
    background: 'rgba(30,14,14,0.96)', color: '#ffd6cf', borderRadius: '10px',
    border: '1px solid #5f3333', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '10px 16px', zIndex: 850,
    textAlign: 'center', cursor: 'pointer'
  });
  root.appendChild(tip);
  return tip;
}

/** @param {HTMLDivElement} tip @param {{trapId?:number, trapType?:string, difficulty?:number}} detail */
function renderTrapTooltip(tip, detail) {
  tip.innerHTML = '';
  const trapType = detail?.trapType || 'Trap';

  const title = document.createElement('div');
  title.textContent = trapType;
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' });
  tip.appendChild(title);

  const hint = document.createElement('div');
  hint.style.opacity = '0.8';
  hint.style.fontSize = '12px';
  hint.textContent = 'Tap to disarm';
  tip.appendChild(hint);

  tip.onclick = () => {
    window.dispatchEvent(new CustomEvent('ui:requestDisarmTrap', {
      detail: { trapId: detail?.trapId }
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

// --- Dev notice tooltip (first-run project notice) -------------------------
/** @param {HTMLElement} root */
function ensureDevNoticeTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'dev-notice-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
    transform: 'translateX(-50%)',
    width: 'min(92vw, 420px)',
    pointerEvents: 'auto',
    display: 'none',
    background: 'rgba(12,18,28,0.97)',
    color: '#dbeaff',
    borderRadius: '12px',
    border: '1px solid #426084',
    boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace',
    padding: '12px 14px',
    zIndex: 920,
  });
  root.appendChild(tip);
  return tip;
}

/** @param {HTMLDivElement} tip @param {{title?:string, body?:string, closeText?:string}} detail */
function renderDevNoticeTooltip(tip, detail) {
  tip.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = detail?.title || 'Active Development Notice';
  Object.assign(title.style, {
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#9ed2ff',
    marginBottom: '8px',
    letterSpacing: '0.03em',
  });
  tip.appendChild(title);

  const body = document.createElement('div');
  body.textContent = detail?.body
    || 'JSHack is under very active development. Use the Bug button in the action bar to request features or report bugs!';
  Object.assign(body.style, {
    fontSize: '12px',
    lineHeight: '1.45',
    color: '#dbeaff',
    marginBottom: '10px',
  });
  tip.appendChild(body);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = detail?.closeText || 'Got it';
  Object.assign(closeBtn.style, {
    minHeight: '44px',
    minWidth: '88px',
    borderRadius: '10px',
    border: '1px solid #6aa7da',
    background: '#234463',
    color: '#e9f7ff',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 14px',
  });
  closeBtn.onclick = () => { tip.style.display = 'none'; };
  tip.appendChild(closeBtn);
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
    const fromChest = !!detail?.fromChest;
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
    const lbl = document.createElement('div');
    lbl.textContent = fromChest ? 'Open Chest' : `${detail?.count || (detail?.items?.length || 0)} items nearby`;
    lbl.style.fontWeight = 'bold';
    const hint = document.createElement('div');
    hint.textContent = fromChest ? 'Tap to open' : 'Tap to choose'; hint.style.marginLeft = 'auto'; hint.style.opacity = '0.8';
    row.appendChild(lbl); row.appendChild(hint);
    tip.appendChild(row);

    const items = Array.isArray(detail?.items) ? detail.items : [];
    // Only show item preview for ground items, not chests
    if (!fromChest && items.length) {
      const itemList = document.createElement('div');
      itemList.style.marginTop = '6px';
      itemList.style.display = 'flex';
      itemList.style.flexDirection = 'column';
      itemList.style.gap = '2px';
      const maxPreview = 5;
      const shown = items.slice(0, maxPreview);
      for (const it of shown) {
        const line = document.createElement('div');
        const rarity = String(it.rarityName || 'common').toLowerCase();
        const nameSpan = document.createElement('span');
        nameSpan.textContent = bracketize(sanitize(it.name || it.type || 'item'));
        Object.assign(nameSpan.style, rarityStyle(rarity));
        line.appendChild(nameSpan);
        if (Number(it.count || 1) > 1) {
          const qty = document.createElement('span');
          qty.textContent = ` x${Number(it.count || 1) | 0}`;
          qty.style.opacity = '0.7';
          line.appendChild(qty);
        }
        const aff = Array.isArray(it.affixes) ? it.affixes : [];
        if (aff.length) {
          const affSpan = document.createElement('span');
          affSpan.textContent = ' \u2014 ' + aff.map(a => typeof a === 'object' ? a.name : humanize(String(a))).join(', ');
          affSpan.style.color = '#8ab8d8';
          affSpan.style.fontStyle = 'italic';
          affSpan.style.fontSize = '12px';
          line.appendChild(affSpan);
        }
        itemList.appendChild(line);
      }
      if (items.length > maxPreview) {
        const more = document.createElement('div');
        more.textContent = `...and ${items.length - maxPreview} more`;
        more.style.opacity = '0.6';
        more.style.fontSize = '12px';
        itemList.appendChild(more);
      }
      tip.appendChild(itemList);
    }

    tip.onclick = () => {
      if (fromChest) {
        const chestId = Number(detail?.chestId || 0) | 0;
        if (chestId > 0) {
          window.dispatchEvent(new CustomEvent('ui:tapOpenChest', { detail: { chestId } }));
        }
      } else {
        window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items } }));
      }
      tip.style.display = 'none';
    };
    return;
  }

  const it = detail?.item || {};
  renderItemDetails(tip, it);

  // Footer hint
  const foot = document.createElement('div');
  foot.style.marginTop = '6px'; foot.style.opacity = '0.8'; foot.style.fontSize = '12px';
  foot.textContent = 'Tap to pick up';
  tip.appendChild(foot);

  // Click behavior: attempt pickup via shared flow
  tip.onclick = () => {
    const ids = getUiItemEntityIds(it);
    if (ids.length > 0) {
      window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    }
    tip.style.display = 'none';
  };
}

/** @param {string} k */
function humanize(k) {
  const s = String(k || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase().trim();
  return s;
}

/** @param {any} it */
function getUiItemEntityIds(it) {
  const raw = Array.isArray(it?.entityIds) ? it.entityIds : [it?.id];
  const ids = [];
  for (const id of raw) {
    const n = Number(id || 0) | 0;
    if (n > 0 && !ids.includes(n)) ids.push(n);
  }
  return ids;
}

/**
 * Render a structured WoW-style item detail panel into the given container.
 * @param {HTMLElement} container
 * @param {any} it  item data from inventoryDataProvider
 */
function renderItemDetails(container, it) {
  container.innerHTML = '';
  if (!it) {
    container.textContent = '(no description)';
    return;
  }

  // --- Item name + slot on one line: [Oak Staff] weapon ---
  const title = document.createElement('div');
  const nameSpan = document.createElement('span');
  nameSpan.textContent = bracketize(sanitize(it.name || 'item'));
  Object.assign(nameSpan.style, rarityStyle(it.rarityName));
  title.appendChild(nameSpan);
  if (it.slot) {
    const slotSpan = document.createElement('span');
    const slotLabel = humanize(it.slot);
    slotSpan.textContent = ' ' + slotLabel.charAt(0).toUpperCase() + slotLabel.slice(1);
    slotSpan.style.opacity = '0.6';
    slotSpan.style.fontSize = '12px';
    title.appendChild(slotSpan);
  }
  title.style.marginBottom = '4px';
  container.appendChild(title);

  // --- Consumable effect description (potions, scrolls, food, wands) ---
  const isConsumable = it.type === 'potion' || it.type === 'scroll' || it.type === 'food' || it.type === 'wand' || it.type === 'learn' || it.type === 'book';
  const consumableDesc = isConsumable ? String(it.description || '').trim() : '';
  if (consumableDesc) {
    const effectLine = document.createElement('div');
    effectLine.textContent = consumableDesc;
    effectLine.style.color = '#c8e0ff';
    effectLine.style.fontSize = '13px';
    effectLine.style.marginBottom = '2px';
    container.appendChild(effectLine);
  }

  // --- Spell details (cost/range/requirements + target effects) ---
  const detailLines = Array.isArray(it.detailLines)
    ? it.detailLines.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const targetEffects = Array.isArray(it.targetEffects)
    ? it.targetEffects.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const hasSpellDetails = it.type === 'spell' || detailLines.length > 0 || targetEffects.length > 0 || !!it.spellId;
  if (hasSpellDetails) {
    if (detailLines.length) {
      const detailRow = document.createElement('div');
      detailRow.textContent = detailLines.join(' · ');
      detailRow.style.color = '#c8e0ff';
      detailRow.style.fontSize = '13px';
      detailRow.style.marginBottom = '2px';
      container.appendChild(detailRow);
    }

    if (targetEffects.length) {
      const effectsTitle = document.createElement('div');
      effectsTitle.textContent = 'Target Effects';
      effectsTitle.style.color = '#9fd6ff';
      effectsTitle.style.fontSize = '11px';
      effectsTitle.style.textTransform = 'uppercase';
      effectsTitle.style.letterSpacing = '0.06em';
      effectsTitle.style.opacity = '0.85';
      effectsTitle.style.marginTop = '2px';
      container.appendChild(effectsTitle);
    }
    for (const effect of targetEffects) {
      const line = document.createElement('div');
      line.textContent = `\u2022 ${effect}`;
      line.style.color = '#9fd6ff';
      line.style.fontSize = '12px';
      container.appendChild(line);
    }
  }

  // --- Weapon stats (damage dice, stamina cost, two-handed) ---
  const isWeapon = it.slot === 'weapon' || it.slot === 'ranged';
  if (isWeapon && (it.damageDice || it.staminaCost != null)) {
    if (it.damageDice) {
      const line = document.createElement('div');
      line.textContent = `Damage: ${String(it.damageDice)}`;
      line.style.color = '#ffd7a0';
      container.appendChild(line);
    }
    if (it.staminaCost != null) {
      const line = document.createElement('div');
      line.textContent = `Stamina: ${it.staminaCost}`;
      line.style.color = '#ffd7a0';
      container.appendChild(line);
    }
    if (it.twoHanded) {
      const line = document.createElement('div');
      line.textContent = 'Two-Handed';
      line.style.color = '#ffd7a0';
      line.style.fontStyle = 'italic';
      container.appendChild(line);
    }
  }

  // --- Coating (poison, etc.) ---
  const coat = it.coating;
  if (coat && coat.kind) {
    const line = document.createElement('div');
    line.style.display = 'flex'; line.style.alignItems = 'center'; line.style.gap = '6px';
    line.style.marginTop = '2px';
    const dot = document.createElement('span');
    const coatColor = coat.color || '#66dd66';
    dot.textContent = '\u2022';
    dot.style.color = coatColor;
    line.appendChild(dot);
    const label = document.createElement('span');
    const charges = Number(coat.charges || 0);
    label.textContent = `${humanize(coat.kind)} coated` + (charges > 0 ? ` (${charges} charges)` : '');
    label.style.color = coatColor;
    label.style.fontWeight = 'bold';
    line.appendChild(label);
    container.appendChild(line);
  }

  // --- Bonuses ---
  const bonuses = it.bonuses && typeof it.bonuses === 'object' ? it.bonuses : {};
  const bonusKeys = Object.keys(bonuses).filter(k => {
    const v = Number(bonuses[k]);
    return Number.isFinite(v) && v !== 0;
  });

  if (bonusKeys.length) {
    for (const k of bonusKeys) {
      const v = Number(bonuses[k]);
      const sign = v > 0 ? '+' : '';
      const line = document.createElement('div');
      line.textContent = `${sign}${v} ${humanize(k)}`;
      line.style.color = '#aaffaa';
      container.appendChild(line);
    }
  }

  // --- Affixes (name + description) ---
  const affixes = Array.isArray(it.affixes) ? it.affixes : [];
  if (affixes.length) {
    for (const a of affixes) {
      const affixName = typeof a === 'object' ? a.name : humanize(String(a));
      const affixDesc = typeof a === 'object' ? a.description : '';

      const line = document.createElement('div');
      const affixNameSpan = document.createElement('span');
      affixNameSpan.textContent = affixName;
      affixNameSpan.style.color = '#a8d8ff';
      affixNameSpan.style.fontWeight = 'bold';
      line.appendChild(affixNameSpan);

      if (affixDesc) {
        const descSpan = document.createElement('span');
        descSpan.textContent = ` \u2014 ${affixDesc}`;
        descSpan.style.color = '#8ab8d8';
        descSpan.style.fontStyle = 'italic';
        line.appendChild(descSpan);
      }
      container.appendChild(line);
    }
  }

  // --- Comparison deltas vs equipped item ---
  const cmp = it.equippedComparison;
  if (cmp) {
    const sep = document.createElement('div');
    sep.textContent = '────────────'; sep.style.opacity = '0.4'; sep.style.margin = '4px 0';
    container.appendChild(sep);

    const cmpTitle = document.createElement('div');
    cmpTitle.textContent = `vs ${sanitize(cmp.name || 'equipped')}`;
    cmpTitle.style.opacity = '0.7';
    cmpTitle.style.fontSize = '11px';
    cmpTitle.style.marginBottom = '2px';
    container.appendChild(cmpTitle);

    const cmpBonuses = cmp.bonuses && typeof cmp.bonuses === 'object' ? cmp.bonuses : {};
    const allKeys = new Set([...Object.keys(bonuses), ...Object.keys(cmpBonuses)]);

    for (const k of allKeys) {
      const mine = Number(bonuses[k]) || 0;
      const theirs = Number(cmpBonuses[k]) || 0;
      const delta = mine - theirs;
      if (delta === 0) continue;

      const line = document.createElement('div');
      const sign = delta > 0 ? '+' : '';
      line.textContent = `${sign}${delta} ${humanize(k)}`;
      line.style.color = delta > 0 ? '#55ff55' : '#ff5555';
      line.style.fontWeight = 'bold';
      container.appendChild(line);
    }

    if ((it.damageDice || cmp.damageDice) && it.damageDice !== cmp.damageDice) {
      const line = document.createElement('div');
      line.textContent = `Damage: ${it.damageDice || 'none'} vs ${cmp.damageDice || 'none'}`;
      line.style.color = '#cccccc';
      line.style.fontSize = '11px';
      container.appendChild(line);
    }

    if (it.staminaCost != null && cmp.staminaCost != null && it.staminaCost !== cmp.staminaCost) {
      const delta = it.staminaCost - cmp.staminaCost;
      const line = document.createElement('div');
      const sign = delta > 0 ? '+' : '';
      line.textContent = `${sign}${delta} stamina cost`;
      line.style.color = delta < 0 ? '#55ff55' : '#ff5555';
      line.style.fontWeight = 'bold';
      container.appendChild(line);
    }
  }

  // --- Flavor text at bottom (skip for consumables already shown above) ---
  const desc = String(it.description || '').trim();
  if (desc && !consumableDesc) {
    const flavor = document.createElement('div');
    flavor.textContent = desc;
    flavor.style.fontStyle = 'italic';
    flavor.style.opacity = '0.7';
    flavor.style.fontSize = '12px';
    flavor.style.marginTop = '3px';
    container.appendChild(flavor);
  }
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
  markScrollable(inner);
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
function hide(panel) { panel.style.display = 'none'; hideItemTooltip(); }

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} items @param {any} [ground] @param {string} [slotFilter] */
function renderInventory(panel, items, ground, slotFilter = '', scrollOfIdentifyId = 0) {
  const existingDetach = /** @type {any} */ (panel)._inventoryDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] inventory detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';
  el.style.overflowX = 'hidden';
  appendCharacterMenuTabs(el, 'inventory');
  const title = document.createElement('div');
  const filterText = humanize(slotFilter || '');
  title.textContent = filterText ? `Inventory · ${filterText}` : 'Inventory';
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
    if (it.identified === false && hasItemId) {
      const hasScroll = scrollOfIdentifyId > 0;
      available.push({
        key: 'identify',
        label: 'Identify',
        enabled: hasScroll,
        disabledReason: hasScroll ? '' : 'No Scroll of Identify',
      });
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
      identify: 4,
      'set-spell': 5,
      throw: 6,
      drop: 7,
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
   * @param {"apply"|"identify"|"equip"|"use"|"set-spell"|"throw"|"drop"} actionKey
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
    const fromChest = ground.fromChest === true;
    const groundChestId = Number(ground.chestId || 0) | 0;
    if (fromChest && groundChestId > 0) {
      return {
        label: 'Open Chest',
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
 * @param {{ identificationEnabled?: boolean, allItemIds?: string[], hasPet?: boolean, petAlive?: boolean }} data
 * @param {{ canvas: HTMLCanvasElement }} memGraph
 * @param {{ canvas: HTMLCanvasElement }} dtyGraph
 */
function renderSettings(panel, data, memGraph, dtyGraph) {
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

  // --- Debugging section ---
  const dbHead = document.createElement('div');
  dbHead.textContent = 'Debugging';
  Object.assign(dbHead.style, {
    fontWeight: 'bold', fontSize: '13px', color: '#7fb8e8',
    borderBottom: '1px solid #2d3b52', paddingBottom: '4px', marginTop: '4px',
  });
  content.appendChild(dbHead);

  content.appendChild(makeCheckbox('Deity debugging', dtyGraph.canvas.style.display === 'block', () => {
    window.dispatchEvent(new CustomEvent('ui:toggleDeityMoodGraph'));
  }));

  content.appendChild(makeCheckbox('Memory visualizer', memGraph.canvas.style.display === 'block', () => {
    window.dispatchEvent(new CustomEvent('ui:toggleMemoryGraph'));
  }));

  // --- Give item row ---
  const giveRow = document.createElement('div');
  Object.assign(giveRow.style, {
    display: 'flex', gap: '6px', alignItems: 'flex-start', position: 'relative',
  });

  const inputWrap = document.createElement('div');
  Object.assign(inputWrap.style, { position: 'relative', flex: '1' });

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'item id\u2026';
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

  const allIds = Array.isArray(data.allItemIds) ? data.allItemIds : [];

  function updateDropdown() {
    const q = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!q) { dropdown.style.display = 'none'; return; }
    const matches = allIds.filter(id => id.includes(q)).slice(0, 30);
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
  input.addEventListener('input', updateDropdown);
  input.addEventListener('focus', updateDropdown);
  input.addEventListener('blur', () => {
    // Delay hide so click on dropdown option can fire first
    setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  });

  inputWrap.appendChild(input);
  inputWrap.appendChild(dropdown);
  giveRow.appendChild(inputWrap);

  const giveBtn = document.createElement('button');
  giveBtn.textContent = 'Give';
  decorateButton(giveBtn);
  giveBtn.style.minHeight = '34px';
  giveBtn.addEventListener('click', () => {
    const itemId = input.value.trim();
    if (!itemId) return;
    window.dispatchEvent(new CustomEvent('ui:debugGiveItem', { detail: { itemId } }));
    input.value = '';
    dropdown.style.display = 'none';
  });
  giveRow.appendChild(giveBtn);
  content.appendChild(giveRow);

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
  subscribeLink.href = 'https://pjensen.substack.com/s/js-hack';
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

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {{ playerName?: string, stats?: Record<string, any>, activeEffects?: Array<any> }} data
 */
function renderCharacterSheet(panel, data) {
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

  const title = document.createElement('div');
  title.textContent = `${playerName} · Character Sheet`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

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
    ['HP', `${Number(stats.hp || 0)}/${Number(stats.maxHp || 0)}`],
    ['Mana', `${Number(stats.mana || 0)}/${Number(stats.maxMana || 0)}`],
    ['Stamina', `${Number(stats.stamina || 0)}/${Number(stats.maxStamina || 0)}`],
    ['Attack', `${Number(stats.attack || 0)}`, deltaColor(stats.attack)],
    ['Defense', `${Number(stats.defense || 0)}`, deltaColor(stats.defense)],
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
      row.textContent = `${key} · ${turns}t${stacks > 1 ? ` · x${stacks}` : ''}`;
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
  el.appendChild(actions);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px';
  hint.style.opacity = '0.85';
  hint.textContent = 'Tab=Next tab · I=Inventory · E=Equipment · Esc=Close';
  el.appendChild(hint);

  function onKey(e) {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'i' || k === 'I') {
      window.dispatchEvent(new CustomEvent('ui:openInventory'));
      e.preventDefault();
    }
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
function renderEquipment(panel, equippedBySlot, playerName, scrollOfIdentifyId = 0) {
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
  title.textContent = `${pn} · Equipment`;
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

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
  hint.textContent = '↑/↓ select slot · Enter=Equip/Unequip · I=Open Inventory · C=Character Sheet · Esc=Close';
  el.appendChild(hint);

  function openInventoryForSlot(slotName) {
    const slotFilter = String(slotName || '').trim().toLowerCase();
    window.dispatchEvent(new CustomEvent('ui:openInventory', { detail: { slotFilter } }));
  }

  function openSpellPicker() {
    window.dispatchEvent(new CustomEvent('ui:openSpellPicker'));
  }

  function rarityStyle(rarityName) {
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
      const rs = rarityStyle(rowData.item.rarityName);
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

  let sel = 0;
  const savedSlot = String((/** @type {any} */ (panel))._equipmentSelectionSlot || '');
  const savedIdx = rowsData.findIndex((row) => row.slot === savedSlot);
  if (savedIdx >= 0) sel = savedIdx;

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
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(rowsData.length - 1); e.preventDefault(); }
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

/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {Array<any>} items
 * @param {number} altarId
 */
function renderAltarOfferChooser(panel, items, altarId) {
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
  hint.textContent = '↑/↓ select · Enter=Offer · Esc=Close';
  el.appendChild(hint);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '10px';

  const offerBtn = document.createElement('button');
  offerBtn.textContent = 'Offer';
  decorateButton(offerBtn);
  offerBtn.addEventListener('click', () => offerSelected());

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  decorateButton(cancelBtn);
  cancelBtn.addEventListener('click', () => hide(panel));

  actions.appendChild(offerBtn);
  actions.appendChild(cancelBtn);
  el.appendChild(actions);

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

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{shopkeeperId:number, buyMarkup:number, sellDiscount:number, mode:string, activeTab?:string}} state */
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
      showItemTooltip(unpaidItems[sel], rows[sel]);
    }

    function payBill() {
      window.dispatchEvent(new CustomEvent('ui:payBill', {
        detail: { shopkeeperId: state.shopkeeperId }
      }));
    }

    function returnSelected() {
      const it = unpaidItems[sel];
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
  let activeTab = state.activeTab || 'buy';
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
      showItemTooltip(currentItems[sel], rows[sel]);
    }

    setSel(0);
    hint.textContent = activeTab === 'buy'
      ? '↑/↓ select · Enter=Buy · Tab=Sell tab · Esc=Close'
      : '↑/↓ select · Enter=Sell · Tab=Buy tab · Esc=Close';

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
      } else {
        for (const itemId of ids) {
          window.dispatchEvent(new CustomEvent('ui:requestSell', {
            detail: { shopkeeperId: state.shopkeeperId, itemId }
          }));
        }
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
  }

  buyTab.addEventListener('click', () => { activeTab = 'buy'; state.activeTab = activeTab; updateTabStyle(); renderList(); });
  sellTab.addEventListener('click', () => { activeTab = 'sell'; state.activeTab = activeTab; updateTabStyle(); renderList(); });

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

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{rackId:number}} state */
function renderRack(panel, data, state) {
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
  hint.textContent = '↑/↓ select · Enter=Take · Esc=Close';

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
