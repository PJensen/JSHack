// display/ui/overlay.js
// Minimal UI overlays for inventory and message log; display-only.

import { ensureMemoryGraph } from './memoryGraph.js';
import { createDebugGraph } from './debugGraph.js';
import { createTileInspector } from './tileInspector.js';
import { renderAlchemyBench } from './alchemyBenchOverlay.js';
import { renderAnvil } from './anvilOverlay.js';
import { renderCookingFire } from './cookingFireOverlay.js';
import { renderDialog } from './dialogOverlay.js';
import { versionLoaded } from '../../shared/version.js';
import { getHighscoreVersionLabel, getHighscores } from '../../shared/tombstoneApi.js';
import { playDeathJingle } from '../fx/deathJingle.js';
import {
  readInputMode, readWalkInterval, writeInputMode, writeWalkInterval,
  WALK_INTERVAL_MIN, WALK_INTERVAL_MAX,
} from '../input/inputSettings.js';

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
  'offhand',
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
  { key: 'quests', icon: '\u{1F4DC}', label: 'Quests', eventName: 'ui:openQuests' },
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
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
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
}

import { getInventoryDefaultAction, isInventoryItemEquippable, isInventoryItemUsable } from './inventoryUtils.js';
export { getInventoryDefaultAction };

/**
 * @param {any} item
 * @returns {string}
 */
function quickPinKeyForItem(item) {
  const identity = String(item?.identity || item?.details?.identity || '');
  if (identity) return identity;
  const id = Number(item?.id || 0) | 0;
  return id > 0 ? `id:${id}` : '';
}

export function initOverlays() {
  const root = ensureRoot();
  const inv = ensurePanel('inventory');
  const char = ensurePanel('character');
  const equip = ensurePanel('equipment');
  const settingsPanel = ensurePanel('settings');
  const questJournal = ensurePanel('quests');
  const townBoard = ensurePanel('townBoard');
  const log = ensurePanel('messageLog');
  const pick = ensurePanel('pickup');
  const usePanel = ensurePanel('use');
  const throwPanel = ensurePanel('throw');
  const spells = ensurePanel('spells');
  const alchemy = ensurePanel('alchemy');
  const cooking = ensurePanel('cooking');
  const dialog = ensurePanel('dialog');
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
  const tileKeyTip = ensureTileKeyTooltip(root);
  const spellGestureHint = ensureSpellGestureHint(root);
  const virtualJoystick = ensureVirtualJoystick(root);
  const gestureDebug = ensureGestureDebugLayer(root);
  // Flex container for debug graph overlays — graphs stack bottom-up
  const debugGraphStack = document.createElement('div');
  Object.assign(debugGraphStack.style, {
    position: 'fixed',
    left: '8px',
    bottom: '56px',
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: '8px',
    zIndex: '910',
    pointerEvents: 'none',
  });
  root.appendChild(debugGraphStack);

  const memoryGraph = ensureMemoryGraph(root);
  debugGraphStack.appendChild(memoryGraph.canvas);
  const deityGraph = createDebugGraph({
    id: 'deity-mood-graph-layer',
    title: 'Deity Mood',
    width: 240,
    height: 160,
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
  debugGraphStack.appendChild(deityGraph.canvas);
  let deityDebugPinned = false;

  function showDeityGraph() {
    hideTileInspector();
    deityGraph.show();
    deityGraph.startSampling();
  }

  function hideDeityGraph() {
    deityGraph.hide();
    deityGraph.stopSampling();
  }

  function applyDeityDebugPinned(enabled) {
    deityDebugPinned = !!enabled;
    if (deityDebugPinned) showDeityGraph();
    else hideDeityGraph();
  }

  const economyGraph = createDebugGraph({
    id: 'economy-graph-layer',
    title: 'Town Economy',
    width: 240,
    height: 160,
    zIndex: 910,
    series: [
      { key: 'food',      color: '#44cc44', label: 'Food' },
      { key: 'materials', color: '#ff8800', label: 'Materials' },
      { key: 'medicine',  color: '#aa44ff', label: 'Medicine' },
      { key: 'morale',    color: '#ffcc00', label: 'Morale' },
    ],
    maxPoints: 60,
    sampleInterval: 1000,
    normalizedY: false,
    unavailableMessage: 'Not on overworld',
  });
  debugGraphStack.appendChild(economyGraph.canvas);
  const tileInspector = createTileInspector();
  debugGraphStack.appendChild(tileInspector.el);
  const deathLog = ensurePanel('deathLog');
  const bookReader = ensurePanel('bookReader');
  const deathScreen = ensureDeathScreen(root);
  const WRATH_DEATH_SCREEN_DELAY_MS = 320;
  let deathScreenShowTimer = 0;

  // Always-on, semi-transparent message ticker (non-modal)
  const ticker = ensureMessageTicker(root);
  let spellGestureTimer = 0;

  /** Hide all character-menu panels (mutual exclusivity). */
  function hideCharMenuPanels() {
    hide(inv); hide(char); hide(equip);
    hide(settingsPanel); hide(questJournal); hide(townBoard);
  }

  window.addEventListener('ui:openInventory', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const slotFilter = String(e?.detail?.slotFilter || '').trim().toLowerCase();
    (/** @type {any} */ (inv))._inventorySlotFilter = slotFilter || '';
    hideCharMenuPanels();
    show(inv);
    window.dispatchEvent(new CustomEvent('ui:requestInventoryData', { detail: { slotFilter } }));
  });
  window.addEventListener('ui:openCharacter', () => {
    hideCharMenuPanels();
    show(char);
    window.dispatchEvent(new CustomEvent('ui:requestCharacterData'));
  });
  window.addEventListener('ui:openEquipment', () => {
    hideCharMenuPanels();
    show(equip);
    window.dispatchEvent(new CustomEvent('ui:requestEquipmentData'));
  });
  window.addEventListener('ui:openSettings', () => {
    hideCharMenuPanels();
    show(settingsPanel);
    window.dispatchEvent(new CustomEvent('ui:requestSettingsData'));
  });
  window.addEventListener('ui:openQuests', () => {
    hideCharMenuPanels();
    show(questJournal);
    window.dispatchEvent(new CustomEvent('ui:requestQuestJournalData'));
  });
  window.addEventListener('ui:openTownBoard', () => {
    hideCharMenuPanels();
    show(townBoard);
  });
  // Toggle inventory panel open/close
  window.addEventListener('ui:toggleInventory', () => {
    if (inv.style.display === 'block') {
      hide(inv);
    } else {
      hideCharMenuPanels();
      show(inv);
      (/** @type {any} */ (inv))._inventorySlotFilter = '';
      window.dispatchEvent(new CustomEvent('ui:requestInventoryData'));
    }
  });
  window.addEventListener('ui:toggleCharacter', () => {
    if (char.style.display === 'block') {
      hide(char);
    } else {
      hideCharMenuPanels();
      show(char);
      window.dispatchEvent(new CustomEvent('ui:requestCharacterData'));
    }
  });
  window.addEventListener('ui:toggleEquipment', () => {
    if (equip.style.display === 'block') {
      hide(equip);
    } else {
      hideCharMenuPanels();
      show(equip);
      window.dispatchEvent(new CustomEvent('ui:requestEquipmentData'));
    }
  });
  window.addEventListener('ui:toggleSettings', () => {
    if (settingsPanel.style.display === 'block') {
      hide(settingsPanel);
    } else {
      hideCharMenuPanels();
      show(settingsPanel);
      window.dispatchEvent(new CustomEvent('ui:requestSettingsData'));
    }
  });
  window.addEventListener('ui:settingsData', (ev) => {
    const data = /** @type {CustomEvent} */ (ev).detail || {};
    applyDeityDebugPinned(data.deityDebugPinned === true);
    renderSettings(settingsPanel, data, memoryGraph, deityGraph, economyGraph, tileInspector);
  });
  // Helper: hide tile inspector (mutual exclusivity with debug graphs)
  function hideTileInspector() {
    tileInspector.hide();
    tileInspector.stopPolling();
  }
  // Toggle memory graph
  window.addEventListener('ui:toggleMemoryGraph', () => {
    if (memoryGraph.canvas.style.display === 'block') {
      memoryGraph.hide();
      memoryGraph.stopSampling();
    } else {
      hideTileInspector();
      memoryGraph.show();
      memoryGraph.startSampling();
    }
  });
  // Toggle deity mood graph
  window.addEventListener('ui:toggleDeityMoodGraph', () => {
    if (deityDebugPinned) {
      showDeityGraph();
      return;
    }
    if (deityGraph.canvas.style.display === 'block') hideDeityGraph();
    else showDeityGraph();
  });
  window.addEventListener('ui:showDeityMoodGraph', () => {
    showDeityGraph();
  });
  window.addEventListener('ui:setDeityDebugPinned', (ev) => {
    const enabled = !!(/** @type {CustomEvent} */ (ev)).detail?.enabled;
    applyDeityDebugPinned(enabled);
  });
  // Late-bind deity mood sampler from main.js
  window.addEventListener('debug:registerDeityMoodSampler', (ev) => {
    const fn = /** @type {CustomEvent} */ (ev).detail?.sampler;
    if (typeof fn === 'function') deityGraph.setSampler(fn);
  });
  // Toggle economy graph
  window.addEventListener('ui:toggleEconomyGraph', () => {
    if (economyGraph.canvas.style.display === 'block') {
      economyGraph.hide();
      economyGraph.stopSampling();
    } else {
      hideTileInspector();
      economyGraph.show();
      economyGraph.startSampling();
    }
  });
  // Late-bind economy sampler from main.js
  window.addEventListener('debug:registerEconomySampler', (ev) => {
    const fn = /** @type {CustomEvent} */ (ev).detail?.sampler;
    if (typeof fn === 'function') economyGraph.setSampler(fn);
  });
  // Toggle tile inspector (mutually exclusive with all debug graphs)
  window.addEventListener('ui:toggleTileInspector', () => {
    if (tileInspector.el.style.display === 'block') {
      hideTileInspector();
    } else {
      // Hide all debug graphs
      memoryGraph.hide(); memoryGraph.stopSampling();
      if (!deityDebugPinned) hideDeityGraph();
      economyGraph.hide(); economyGraph.stopSampling();
      tileInspector.show();
      tileInspector.startPolling();
    }
  });
  // Late-bind tile inspector sampler from main.js
  window.addEventListener('debug:registerTileInspectorSampler', (ev) => {
    const fn = /** @type {CustomEvent} */ (ev).detail?.sampler;
    if (typeof fn === 'function') tileInspector.setSampler(fn);
  });
  window.addEventListener('ui:openMessageLog', () => {
    show(log);
    // Request messages; app may respond with ui:messageLogData
    window.dispatchEvent(new CustomEvent('ui:requestMessageLogData'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      const tabPanels = [char, inv, equip, questJournal, settingsPanel];
      const curIdx = tabPanels.findIndex(p => p.style.display === 'block');
      if (curIdx !== -1) {
        e.preventDefault();
        const next = CHARACTER_MENU_TABS[(curIdx + (e.shiftKey ? CHARACTER_MENU_TABS.length - 1 : 1)) % CHARACTER_MENU_TABS.length];
        window.dispatchEvent(new CustomEvent(next.eventName));
      }
    }
    if (e.key === 'Escape') {
      // Close every ui-panel that is currently visible
      let closed = false;
      for (const p of document.querySelectorAll('.ui-panel')) {
        if (p.style.display === 'block') {
          hide(/** @type {HTMLDivElement} */ (p));
          closed = true;
        }
      }
      // Close debug graphs
      if (memoryGraph.canvas.style.display === 'block') {
        memoryGraph.hide();
        memoryGraph.stopSampling();
        closed = true;
      }
      if (deityGraph.canvas.style.display === 'block') {
        if (!deityDebugPinned) {
          hideDeityGraph();
          closed = true;
        }
      }
      if (economyGraph.canvas.style.display === 'block') {
        economyGraph.hide();
        economyGraph.stopSampling();
        closed = true;
      }
      if ((/** @type {any} */ (ticker))._expanded) {
        (/** @type {any} */ (ticker))._expanded = false;
        renderMessageTicker(ticker, (/** @type {any} */ (ticker))._entries || []);
        closed = true;
      }
      if (closed) e.preventDefault();
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
    const encumbrance = e?.detail?.encumbrance || null;
    (/** @type {any} */ (inv))._inventoryLastData = {
      items,
      ground,
      slotFilter,
      scrollOfIdentifyId,
      encumbrance,
    };
    const pinnedKeys = Array.isArray((/** @type {any} */ (inv))._inventoryPinnedKeys)
      ? (/** @type {any} */ (inv))._inventoryPinnedKeys
      : [];
    if (inv.style.display === 'block') renderInventory(inv, items, ground, slotFilter, scrollOfIdentifyId, encumbrance, pinnedKeys);
    if (equip.style.display === 'block') {
      const cachedPlayerName = String((/** @type {any} */ (equip))._equipmentPlayerName || 'Hero');
      renderEquipment(equip, equippedBySlot, cachedPlayerName, scrollOfIdentifyId);
    }
  });
  window.addEventListener('ui:pinnedQuickItems', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const pinKeys = Array.isArray(e?.detail?.pinKeys) ? e.detail.pinKeys.map((key) => String(key || '')) : [];
    (/** @type {any} */ (inv))._inventoryPinnedKeys = pinKeys;
    if (inv.style.display !== 'block') return;
    const last = (/** @type {any} */ (inv))._inventoryLastData;
    if (!last) return;
    renderInventory(
      inv,
      Array.isArray(last.items) ? last.items : [],
      last.ground || null,
      String(last.slotFilter || ''),
      Number(last.scrollOfIdentifyId || 0) | 0,
      last.encumbrance || null,
      pinKeys,
    );
  });
  window.addEventListener('ui:characterData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const playerName = String(e?.detail?.playerName || 'Hero');
    const stats = e?.detail?.stats || {};
    const activeEffects = Array.isArray(e?.detail?.activeEffects) ? e.detail.activeEffects : [];
    const traits = Array.isArray(e?.detail?.traits) ? e.detail.traits : [];
    if (char.style.display === 'block') renderCharacterSheet(char, { playerName, stats, activeEffects, traits });
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
  window.addEventListener('ui:questJournalData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const quests = Array.isArray(e?.detail?.quests) ? e.detail.quests : [];
    if (questJournal.style.display === 'block') renderQuestJournal(questJournal, quests);
  });
  window.addEventListener('ui:townBoardData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderTownBoard(townBoard, d);
  });
  window.addEventListener('ui:messageLogData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const entries = (e?.detail?.entries) || [];
    renderMessageLog(log, entries);
  });

  // Spell picker overlay
  /** @type {number|null} Track which action bar slot is being rebound, if any */
  let _spellPickerBindSlot = null;
  window.addEventListener('ui:openSpellPicker', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    _spellPickerBindSlot = (typeof e?.detail?.bindSlot === 'number') ? e.detail.bindSlot : null;
    show(spells);
    window.dispatchEvent(new CustomEvent('ui:requestSpellData'));
  });
  window.addEventListener('ui:spellData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const items = (e?.detail?.spells) || [];
    const activeId = e?.detail?.activeSpellId || null;
    renderSpellPicker(spells, items, activeId, _spellPickerBindSlot);
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

  window.addEventListener('ui:openDialog', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    hide(inv);
    hide(char);
    hide(equip);
    hide(settingsPanel);
    hide(pick);
    hide(usePanel);
    hide(throwPanel);
    hide(spells);
    hide(alchemy);
    hide(cooking);
    hide(shop);
    hide(chest);
    hide(rack);
    hide(altar);
    renderDialog(dialog, d);
    show(dialog);
    const escKey = (/** @type {KeyboardEvent} */ ke) => {
      if (dialog.style.display !== 'block') return;
      if (ke.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('ui:requestDialogClose', { detail: { sessionId: Number(d.sessionId || 0) | 0 } }));
        ke.preventDefault();
      }
    };
    window.addEventListener('keydown', escKey);
    // Backdrop click should close the dialog session, not just hide the panel
    const backdropClose = (/** @type {PointerEvent} */ pe) => {
      if (pe.target === dialog) {
        window.dispatchEvent(new CustomEvent('ui:requestDialogClose', { detail: { sessionId: Number(d.sessionId || 0) | 0 } }));
      }
    };
    dialog.addEventListener('pointerdown', backdropClose);
    const obs = new MutationObserver(() => {
      if (dialog.style.display === 'none') {
        window.removeEventListener('keydown', escKey);
        dialog.removeEventListener('pointerdown', backdropClose);
        obs.disconnect();
      }
    });
    obs.observe(dialog, { attributes: true, attributeFilter: ['style'] });
  });
  window.addEventListener('ui:closeDialog', () => {
    hide(dialog);
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

  // Gem selector for weapon sockets ("Add Gem" action)
  window.addEventListener('ui:openGemSelectorForWeapon', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const weaponId = Number(e?.detail?.weaponId || 0);
    if (!(weaponId > 0)) return;
    hide(inv);
    hide(equip);
    show(applyPanel);
    window.dispatchEvent(new CustomEvent('ui:requestSocketableGemsData', { detail: { weaponId } }));
  });
  window.addEventListener('ui:socketableGemsData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const gems = (e?.detail?.items) || [];
    const weaponId = Number(e?.detail?.weaponId || 0);
    renderApplyToolChooser(applyPanel, gems, (gemId) => {
      window.dispatchEvent(new CustomEvent('ui:requestApply', { detail: { toolId: gemId, targetItemId: weaponId } }));
      hide(applyPanel);
    });
  });

  // Shop overlay
  let _shopState = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5, mode: 'browse', activeTab: 'buy', vendorKind: '' };
  window.addEventListener('ui:openShop', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _shopState.shopkeeperId = d.shopkeeperId || 0;
    _shopState.buyMarkup = d.buyMarkup ?? 1.0;
    _shopState.sellDiscount = d.sellDiscount ?? 0.5;
    _shopState.mode = d.mode || 'browse';
    _shopState.vendorKind = String(d.vendorKind || '');
    show(shop);
  });
  window.addEventListener('ui:closeShop', () => {
    _shopState.shopkeeperId = 0;
    _shopState.mode = 'browse';
    _shopState.activeTab = 'buy';
    _shopState.vendorKind = '';
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
    ingredients: { berries: 0, herbs: 0, thornPods: 0, venomFronds: 0, moonleaf: 0, emberRoot: 0 },
    recipes: [],
  };
  window.addEventListener('ui:openAlchemyBench', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _alchemyState.benchId = Number(d.benchId || 0) | 0;
    show(alchemy);
    renderAlchemyBench(alchemy, _alchemyState);
    const escKey = (/** @type {KeyboardEvent} */ ke) => {
      if (alchemy.style.display !== 'block') return;
      if (ke.key === 'Escape') { hide(alchemy); ke.preventDefault(); }
    };
    window.addEventListener('keydown', escKey);
    const obs = new MutationObserver(() => {
      if (alchemy.style.display === 'none') {
        window.removeEventListener('keydown', escKey);
        obs.disconnect();
      }
    });
    obs.observe(alchemy, { attributes: true, attributeFilter: ['style'] });
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
        : { berries: 0, herbs: 0, thornPods: 0, venomFronds: 0, moonleaf: 0, emberRoot: 0 },
      recipes: Array.isArray(d.recipes) ? d.recipes : [],
    };
    renderAlchemyBench(alchemy, _alchemyState);
  });

  // Anvil overlay
  let _anvilState = {
    anvilId: 0,
    materials: { iron: 0, lumber: 0 },
    recipes: [],
  };
  window.addEventListener('ui:openAnvil', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _anvilState.anvilId = Number(d.anvilId || 0) | 0;
    show(alchemy);
    renderAnvil(alchemy, _anvilState);
    const escKey = (/** @type {KeyboardEvent} */ ke) => {
      if (alchemy.style.display !== 'block') return;
      if (ke.key === 'Escape') { hide(alchemy); ke.preventDefault(); }
    };
    window.addEventListener('keydown', escKey);
    const obs = new MutationObserver(() => {
      if (alchemy.style.display === 'none') {
        window.removeEventListener('keydown', escKey);
        obs.disconnect();
      }
    });
    obs.observe(alchemy, { attributes: true, attributeFilter: ['style'] });
  });
  window.addEventListener('ui:closeAnvil', () => {
    _anvilState.anvilId = 0;
    hide(alchemy);
  });
  window.addEventListener('ui:anvilData', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _anvilState = {
      anvilId: Number(d.anvilId || _anvilState.anvilId || 0) | 0,
      materials: d.materials && typeof d.materials === 'object'
        ? d.materials
        : { iron: 0, lumber: 0 },
      recipes: Array.isArray(d.recipes) ? d.recipes : [],
    };
    renderAnvil(alchemy, _anvilState);
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
    const escKey = (/** @type {KeyboardEvent} */ ke) => {
      if (cooking.style.display !== 'block') return;
      if (ke.key === 'Escape') { hide(cooking); ke.preventDefault(); }
    };
    window.addEventListener('keydown', escKey);
    const obs = new MutationObserver(() => {
      if (cooking.style.display === 'none') {
        window.removeEventListener('keydown', escKey);
        obs.disconnect();
      }
    });
    obs.observe(cooking, { attributes: true, attributeFilter: ['style'] });
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
  let _chestState = { chestId: 0, label: 'Chest' };
  window.addEventListener('ui:openChest', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    _chestState.chestId = d.chestId || 0;
    _chestState.label = d.label || 'Chest';
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

  const TOOLTIP_BASE_Z = 850;
  const TOOLTIP_FOCUS_Z = 860;
  /** @param {HTMLDivElement} active */
  function focusGameplayTooltip(active) {
    const tooltips = [groundTip, stairTip, trapTip];
    for (const tip of tooltips) {
      if (tip === active) {
        tip.style.display = 'block';
        tip.style.zIndex = String(TOOLTIP_FOCUS_Z);
      } else {
        tip.style.display = 'none';
        tip.style.zIndex = String(TOOLTIP_BASE_Z);
      }
    }
  }

  // Ground item tooltip lifecycle
  window.addEventListener('ui:showGroundItem', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    renderGroundTooltip(groundTip, d);
    focusGameplayTooltip(groundTip);
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
    focusGameplayTooltip(stairTip);
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
    focusGameplayTooltip(trapTip);
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

  // First-run tile key overlay
  window.addEventListener('ui:showTileKeyTooltip', () => {
    renderTileKeyTooltip(tileKeyTip);
    tileKeyTip.style.display = 'flex';
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

  // Virtual joystick overlay
  window.addEventListener('ui:joystickProgress', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const d = e?.detail || {};
    const active = !!d.active;
    if (!active) {
      virtualJoystick.wrap.style.display = 'none';
      return;
    }
    const baseX = Number(d?.base?.x);
    const baseY = Number(d?.base?.y);
    const knobX = Number(d?.knob?.x);
    const knobY = Number(d?.knob?.y);
    const radius = Number(d?.radius);
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY) || !Number.isFinite(knobX) || !Number.isFinite(knobY)) {
      virtualJoystick.wrap.style.display = 'none';
      return;
    }
    const outerPx = Number.isFinite(radius) ? Math.max(34, radius) : 46;
    const innerPx = Math.max(16, outerPx * 0.45);

    virtualJoystick.wrap.style.display = 'block';
    virtualJoystick.outer.style.width = `${outerPx * 2}px`;
    virtualJoystick.outer.style.height = `${outerPx * 2}px`;
    virtualJoystick.outer.style.left = `${baseX - outerPx}px`;
    virtualJoystick.outer.style.top = `${baseY - outerPx}px`;
    virtualJoystick.inner.style.width = `${innerPx * 2}px`;
    virtualJoystick.inner.style.height = `${innerPx * 2}px`;
    virtualJoystick.inner.style.left = `${knobX - innerPx}px`;
    virtualJoystick.inner.style.top = `${knobY - innerPx}px`;
  });

  window.addEventListener('ui:showSpellGestureHint', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const inputMode = readInputMode();
    if (inputMode === 'walk') {
      if (spellGestureTimer) {
        window.clearTimeout(spellGestureTimer);
        spellGestureTimer = 0;
      }
      spellGestureHint.wrap.style.display = 'none';
      return;
    }
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
      // LOL playDeathJingle();
    };

    if (deathScreenShowTimer) {
      window.clearTimeout(deathScreenShowTimer);
      deathScreenShowTimer = 0;
    }

    if (String(d?.cause || '').toLowerCase() === 'divine_wrath') {
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
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 46px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '132px', maxWidth: '54vw', pointerEvents: 'auto', display: 'none',
    background: 'rgba(14,18,26,0.96)', color: '#dbeaff', borderRadius: '10px',
    border: '1px solid #33435f', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '7px 8px', zIndex: 850
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
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 46px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '112px', maxWidth: '50vw', pointerEvents: 'none', display: 'none',
    background: 'rgba(14,18,26,0.96)', color: '#dbeaff', borderRadius: '7px',
    border: '1px solid #33435f', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '6px 8px', zIndex: 850,
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
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' });
  tip.appendChild(title);

  const hint = document.createElement('div');
  hint.style.opacity = '0.8';
  hint.style.fontSize = '10px';
  hint.textContent = isReturn
    ? 'Tap to return'
    : `Tap to ${dir === 'down' ? 'descend' : 'ascend'}`;
  tip.appendChild(hint);

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = isReturn
    ? 'Return'
    : (dir === 'down' ? 'Descend' : 'Ascend');
  Object.assign(action.style, {
    marginTop: '5px',
    minHeight: '34px',
    minWidth: '80px',
    borderRadius: '7px',
    border: '1px solid #6aa7da',
    background: '#234463',
    color: '#e9f7ff',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 10px',
    pointerEvents: 'auto',
  });
  action.onclick = () => {
    window.dispatchEvent(new CustomEvent('ui:requestStairTraverse', {
      detail: { stairId: detail?.stairId, direction: dir }
    }));
    tip.style.display = 'none';
  };
  tip.appendChild(action);
}

// --- Trap tooltip (tap to disarm) ------------------------------------------
/** @param {HTMLElement} root */
function ensureTrapTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'trap-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 46px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    minWidth: '112px', maxWidth: '50vw', pointerEvents: 'none', display: 'none',
    background: 'rgba(30,14,14,0.96)', color: '#ffd6cf', borderRadius: '7px',
    border: '1px solid #5f3333', boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    fontFamily: 'monospace', padding: '6px 8px', zIndex: 850,
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
  title.textContent = `${trapType} 🎲`;
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' });
  tip.appendChild(title);

  const hint = document.createElement('div');
  hint.style.opacity = '0.8';
  hint.style.fontSize = '10px';
  hint.textContent = 'Tap to disarm';
  tip.appendChild(hint);

  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Disarm';
  Object.assign(action.style, {
    marginTop: '5px',
    minHeight: '34px',
    minWidth: '80px',
    borderRadius: '7px',
    border: '1px solid #c78c8c',
    background: '#4b2323',
    color: '#ffe4df',
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 10px',
    pointerEvents: 'auto',
  });
  action.onclick = () => {
    window.dispatchEvent(new CustomEvent('ui:requestDisarmTrap', {
      detail: { trapId: detail?.trapId }
    }));
    tip.style.display = 'none';
  };
  tip.appendChild(action);
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
    || 'JSHack is under very active development. Use the Bug Report button in Settings to request features or report bugs!';
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

// ---- First-run tile key overlay ----

const TILE_KEY_ENTRIES = [
  // Terrain
  { glyph: '@', color: '#e8f7ff', label: 'You' },
  { glyph: '#', color: '#99a', label: 'Wall' },
  { glyph: '.', color: '#7788aa', label: 'Floor' },
  { glyph: '+', color: '#cc9', label: 'Door (closed)' },
  { glyph: '/', color: '#cc9', label: 'Door (open)' },
  { glyph: '>', color: '#ccc', label: 'Stairs down' },
  { glyph: '<', color: '#ccc', label: 'Stairs up' },
  { glyph: '~', color: '#5ea8d4', label: 'Water' },
  // Items
  { glyph: '!', color: '#66ff99', label: 'Potion' },
  { glyph: '?', color: '#eeddaa', label: 'Scroll' },
  { glyph: ')', color: '#e8e2b0', label: 'Weapon' },
  { glyph: '[', color: '#c49c66', label: 'Armor' },
  { glyph: ']', color: '#c8a050', label: 'Chest' },
  { glyph: '$', color: '#ffde5a', label: 'Gold' },
  { glyph: '%', color: '#b89070', label: 'Corpse / Food' },
  { glyph: '*', color: '#ffffff', label: 'Gem' },
  { glyph: '^', color: '#a84000', label: 'Trap' },
  // Monsters (colored letters)
  { glyph: 'g', color: '#7ecc5a', label: 'Goblin' },
  { glyph: 'r', color: '#b89070', label: 'Rat' },
  { glyph: 'b', color: '#9080b0', label: 'Bat' },
];

function ensureTileKeyTooltip(root) {
  const tip = document.createElement('div');
  tip.id = 'tile-key-tooltip';
  Object.assign(tip.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(94vw, 480px)',
    pointerEvents: 'auto',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(8,12,22,0.96)',
    color: '#dbeaff',
    borderRadius: '14px',
    border: '1px solid #3a5a80',
    boxShadow: '0 0 60px rgba(30,90,160,0.25), 0 12px 40px rgba(0,0,0,0.6)',
    fontFamily: 'monospace',
    padding: '18px 20px 14px',
    zIndex: 930,
  });
  root.appendChild(tip);
  return tip;
}

function renderTileKeyTooltip(tip) {
  tip.innerHTML = '';

  // Title
  const title = document.createElement('div');
  title.textContent = 'Map Key';
  Object.assign(title.style, {
    fontWeight: 'bold',
    fontSize: '15px',
    color: '#9ed2ff',
    marginBottom: '12px',
    letterSpacing: '0.06em',
    textAlign: 'center',
  });
  tip.appendChild(title);

  // Grid of glyph entries
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '6px 12px',
    width: '100%',
    marginBottom: '14px',
  });

  for (const entry of TILE_KEY_ENTRIES) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });

    const glyphEl = document.createElement('span');
    glyphEl.textContent = entry.glyph;
    Object.assign(glyphEl.style, {
      fontSize: '18px',
      fontWeight: 'bold',
      color: entry.color,
      textShadow: `0 0 6px ${entry.color}66`,
      width: '22px',
      textAlign: 'center',
      flexShrink: '0',
    });

    const labelEl = document.createElement('span');
    labelEl.textContent = entry.label;
    Object.assign(labelEl.style, {
      fontSize: '12px',
      color: '#bcd2e8',
    });

    row.appendChild(glyphEl);
    row.appendChild(labelEl);
    grid.appendChild(row);
  }
  tip.appendChild(grid);

  // Hint line
  const hint = document.createElement('div');
  hint.textContent = 'Bump doors to open \u00b7 Step on stairs to traverse';
  Object.assign(hint.style, {
    fontSize: '11px',
    color: '#7a9ab8',
    textAlign: 'center',
    marginBottom: '12px',
  });
  tip.appendChild(hint);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Got it';
  Object.assign(closeBtn.style, {
    minHeight: '44px',
    minWidth: '100px',
    borderRadius: '10px',
    border: '1px solid #6aa7da',
    background: '#234463',
    color: '#e9f7ff',
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: '0 18px',
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

function ensureVirtualJoystick(root) {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    pointerEvents: 'none',
    zIndex: 915,
  });

  const outer = document.createElement('div');
  Object.assign(outer.style, {
    position: 'fixed',
    width: '92px',
    height: '92px',
    borderRadius: '999px',
    border: '2px solid rgba(170,220,255,0.62)',
    background: 'rgba(46,88,132,0.46)',
    boxShadow: '0 0 18px rgba(80,150,220,0.32), inset 0 0 12px rgba(150,220,255,0.2)',
    backdropFilter: 'blur(1px)',
  });

  const inner = document.createElement('div');
  Object.assign(inner.style, {
    position: 'fixed',
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(195,235,255,0.76)',
    background: 'rgba(120,190,245,0.74)',
    boxShadow: '0 0 10px rgba(140,210,255,0.4), inset 0 0 6px rgba(255,255,255,0.3)',
  });

  wrap.appendChild(outer);
  wrap.appendChild(inner);
  root.appendChild(wrap);

  return { wrap, outer, inner };
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

/** @param {HTMLDivElement} tip @param {{mode?:'single'|'stack'|'multi', item?:any, items?:any[], count?:number, pickupRange?:number, stackIndex?:number}} detail */
function renderGroundTooltip(tip, detail) {
  tip.innerHTML = '';
  const mode = detail?.mode || 'single';
  const renderCompactPickup = (it, subtext, onDismiss) => {
    tip.innerHTML = '';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';

    const title = document.createElement('div');
    const rarity = String(it?.rarityName || 'common').toLowerCase();
    const nameSpan = document.createElement('span');
    nameSpan.textContent = bracketize(sanitize(it?.name || it?.type || 'item'));
    Object.assign(nameSpan.style, rarityStyle(rarity));
    title.appendChild(nameSpan);

    const raritySpan = document.createElement('span');
    raritySpan.textContent = ` ${rarity}`;
    raritySpan.style.opacity = '0.75';
    raritySpan.style.fontSize = '11px';
    title.appendChild(raritySpan);

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '×';
    decorateButton(dismissBtn);
    dismissBtn.title = 'Dismiss';
    dismissBtn.style.marginLeft = 'auto';
    dismissBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof onDismiss === 'function') onDismiss();
    });

    header.appendChild(title);
    header.appendChild(dismissBtn);
    tip.appendChild(header);

    if (subtext) {
      const hint = document.createElement('div');
      hint.textContent = String(subtext);
      hint.style.marginTop = '4px';
      hint.style.opacity = '0.75';
      hint.style.fontSize = '11px';
      tip.appendChild(hint);
    }
  };

  if (mode === 'stack') {
    const stackItems = Array.isArray(detail?.items) ? detail.items.slice() : [];
    if (!stackItems.length) {
      tip.style.display = 'none';
      return;
    }

    let stackIndex = Math.max(0, Math.min(stackItems.length - 1, Number(detail?.stackIndex || 0) | 0));

    const renderStackAt = () => {
      const it = stackItems[stackIndex];
      renderCompactPickup(it, `${stackIndex + 1}/${stackItems.length} • Tap to pick up`, () => {
        stackItems.splice(stackIndex, 1);
        if (!stackItems.length) {
          tip.style.display = 'none';
          return;
        }
        if (stackIndex >= stackItems.length) stackIndex = stackItems.length - 1;
        renderStackAt();
      });
    };

    renderStackAt();

    tip.onclick = () => {
      const ids = getUiItemEntityIds(stackItems[stackIndex]);
      const firstId = Number(ids[0] || 0) | 0;
      if (firstId > 0) {
        window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: [firstId] } }));
      }
    };
    return;
  }
  if (mode === 'multi') {
    const fromChest = !!detail?.fromChest;
    tip.innerHTML = '';
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '8px';
    const lbl = document.createElement('div');
    const chestLabel = (fromChest && detail?.chestName) ? `Open ${detail.chestName}` : 'Open Chest';
    lbl.textContent = fromChest ? chestLabel : `${detail?.count || (detail?.items?.length || 0)} items nearby`;
    lbl.style.fontWeight = 'bold';
    const hint = document.createElement('div');
    hint.textContent = fromChest ? 'Tap to open' : 'Tap to choose'; hint.style.marginLeft = 'auto'; hint.style.opacity = '0.8';
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '×';
    decorateButton(dismissBtn);
    dismissBtn.title = 'Dismiss';
    dismissBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      tip.style.display = 'none';
    });
    row.appendChild(lbl); row.appendChild(hint);
    row.appendChild(dismissBtn);
    tip.appendChild(row);

    const items = Array.isArray(detail?.items) ? detail.items : [];

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
  const openChestIfPresent = () => {
    const chestId = Number(detail?.chestId || 0) | 0;
    if (chestId > 0) {
      // Keep chest interaction in the same tap flow after top floor-item action.
      window.dispatchEvent(new CustomEvent('ui:tapOpenChest', { detail: { chestId } }));
    }
  };
  renderCompactPickup(it, 'Tap to pick up', () => {
    openChestIfPresent();
    tip.style.display = 'none';
  });

  // Click behavior: attempt pickup via shared flow
  tip.onclick = () => {
    const ids = getUiItemEntityIds(it);
    if (ids.length > 0) {
      window.dispatchEvent(new CustomEvent('ui:requestPickup', { detail: { itemIds: ids } }));
    }
    openChestIfPresent();
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
export function renderItemDetails(container, it) {
  container.innerHTML = '';
  if (!it) {
    container.textContent = '(no description)';
    return;
  }

  // --- Item name + slot on one line: [Oak Staff] weapon ---
  const title = document.createElement('div');
  Object.assign(title.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  });
  const glyphText = String(it.glyph || '').trim();
  if (glyphText) {
    const glyphSpan = document.createElement('span');
    glyphSpan.textContent = glyphText;
    Object.assign(glyphSpan.style, {
      color: String(it.glyphColor || '#cfe8ff'),
      fontSize: '14px',
      lineHeight: '1',
    });
    title.appendChild(glyphSpan);
  }
  const nameSpan = document.createElement('span');
  nameSpan.textContent = bracketize(sanitize(it.name || 'item'));
  Object.assign(nameSpan.style, rarityStyle(it.rarityName));
  title.appendChild(nameSpan);
  const rn = String(it?.rarityName || 'common').toLowerCase();
  if (rn !== 'common') {
    const raritySpan = document.createElement('span');
    raritySpan.textContent = ` ${rn}`;
    Object.assign(raritySpan.style, { opacity: '0.75', fontSize: '11px' });
    title.appendChild(raritySpan);
  }
  if (it.slot) {
    const slotSpan = document.createElement('span');
    const slotLabel = humanize(it.slot);
    slotSpan.textContent = ' ' + slotLabel.charAt(0).toUpperCase() + slotLabel.slice(1);
    slotSpan.style.opacity = '0.6';
    slotSpan.style.fontSize = '12px';
    title.appendChild(slotSpan);
  }
  container.appendChild(title);

  // --- Item weight ---
  const itemWeight = Number(it.weight || 0);
  if (itemWeight > 0) {
    const wLine = document.createElement('div');
    const count = Math.max(1, Number(it.count ?? 1) | 0);
    wLine.textContent = count > 1
      ? `Weight: ${itemWeight} kg \u00d7${count} = ${(itemWeight * count).toFixed(1)} kg`
      : `Weight: ${itemWeight} kg`;
    Object.assign(wLine.style, { color: '#8899aa', fontSize: '12px', marginBottom: '2px' });
    container.appendChild(wLine);
  }

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

  // --- Proc nodes (trigger/effect summaries from item topology) ---
  const procNodes = Array.isArray(it.procNodes) ? it.procNodes : [];
  if (procNodes.length) {
    const title = document.createElement('div');
    title.textContent = 'Proc Nodes';
    title.style.color = '#9fd6ff';
    title.style.fontSize = '11px';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '0.06em';
    title.style.opacity = '0.9';
    title.style.marginTop = '6px';
    container.appendChild(title);

    for (const node of procNodes) {
      const src = document.createElement('div');
      src.textContent = String(node?.source || 'Item');
      src.style.color = '#7fb3df';
      src.style.fontSize = '12px';
      src.style.marginTop = '2px';
      container.appendChild(src);

      const trigger = document.createElement('div');
      const qualifiers = Array.isArray(node?.qualifiers)
        ? node.qualifiers.map((q) => String(q || '').trim()).filter(Boolean)
        : [];
      trigger.textContent = qualifiers.length
        ? `${String(node?.trigger || 'On Trigger')} · ${qualifiers.join(' · ')}`
        : String(node?.trigger || 'On Trigger');
      trigger.style.color = '#d7e9ff';
      trigger.style.fontSize = '12px';
      container.appendChild(trigger);

      const effects = Array.isArray(node?.effects) ? node.effects : [];
      for (const effect of effects) {
        const line = document.createElement('div');
        line.textContent = `• ${String(effect || '').trim()}`;
        line.style.color = '#b6d6f2';
        line.style.fontSize = '12px';
        container.appendChild(line);
      }
    }
  }

  // --- Socket circles ---
  const maxSockets = Number(it.maxSockets || 0) | 0;
  if (maxSockets > 0) {
    const sockets = Array.isArray(it.sockets) ? it.sockets : [];
    const sockRow = document.createElement('div');
    sockRow.style.marginTop = '4px';
    sockRow.style.letterSpacing = '2px';
    sockRow.style.fontSize = '14px';
    let circles = '';
    for (let s = 0; s < maxSockets; s++) {
      circles += s < sockets.length ? '\u25C8' : '\u25CB'; // ◈ filled, ○ empty
    }
    sockRow.textContent = circles;
    sockRow.style.color = '#c8a860';
    container.appendChild(sockRow);
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
function renderInventory(panel, items, ground, slotFilter = '', scrollOfIdentifyId = 0, encumbrance = null, pinnedKeys = []) {
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
  title.textContent = filterText ? `Inventory · ${filterText}` : 'Inventory';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '8px';
  el.appendChild(title);

  // ── Carry weight bar ──────────────────────────────────────────────
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
      ? (hasApplyTargets ? ` · A=${applyVerb}` : ` · A=${applyVerb} (no targets)`)
      : '';
    hint.textContent = `↑/↓ to select · Enter=${enterActionLabel(it)} · U=Use · E=Equip/Unequip · I=Pin · ,=Drop · T=Throw${applyHint}${groundAction ? ' · P=Pickup' : ''} · S=Set Spell · Esc=Close · UNPAID items are stolen`;
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
function renderSettings(panel, data, memGraph, dtyGraph, econGraph, tileInsp) {
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
function renderQuestJournal(panel, quests) {
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
function renderTownBoard(panel, data) {
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
  summary.textContent = `${active.length} active quest${active.length === 1 ? '' : 's'} · ${offers.length} posted contract${offers.length === 1 ? '' : 's'}`;
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
      meta.textContent = `${district} · ${urgency}${isAccepted ? ' · CLAIMED' : ''}`;
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
function renderCharacterSheet(panel, data) {
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
  title.textContent = `${playerName} · Character Sheet`;
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
    calendarCard.textContent = `${moonEmoji ? `${moonEmoji} ` : ''}${String(calendar.formatted)}${moonLabel ? ` · ${moonLabel}` : ''}`;
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
  hint.textContent = 'Tab=Next tab · I=Inventory · E=Equipment · Esc=Close';
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
function renderSpellPicker(panel, spells, activeId, bindSlot) {
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
function renderMessageLog(panel, entries) {
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

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{shopkeeperId:number, buyMarkup:number, sellDiscount:number, mode:string, activeTab?:string}} state */
function renderShop(panel, data, state) {
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
      hint.textContent = 'Select item · Return button/Enter=Return · P=Pay · Esc=Close';
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
      ? '↑/↓ select · Enter=Buy · Tab=Sell tab · Esc=Close'
      : activeTab === 'sell'
        ? '↑/↓ select · Enter=Sell · Tab=Appraise tab · Esc=Close'
        : '↑/↓ select · Enter=Appraise · Tab=Buy tab · Esc=Close';

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
function renderChest(panel, data, state) {
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
    width: 'min(62vw, 580px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    pointerEvents: 'auto',
    zIndex: 850,
    color: '#cfe8ff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
    fontSize: 'min(14px, 3.2vw)',
    lineHeight: '1.3',
    background: 'rgba(10, 14, 22, 0.72)',
    borderRadius: '8px',
    padding: '7px 9px',
    border: '1px solid rgba(45,59,82,0.56)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
    overflow: 'hidden',
    cursor: 'pointer',
    userSelect: 'none',
    webkitTextSizeAdjust: 'none',
    textSizeAdjust: 'none',
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
      fontSize: 'min(13px, 3.1vw)',
      lineHeight: '1.45',
      padding: '10px 12px',
      background: 'rgba(8,12,18,0.92)',
      border: '1px solid rgba(80,120,170,0.82)',
      boxShadow: '0 12px 34px rgba(0,0,0,0.52)',
      cursor: 'pointer',
    });
  } else {
    Object.assign(container.style, {
      width: 'min(62vw, 580px)',
      maxHeight: '',
      gap: '3px',
      fontSize: 'min(14px, 3.2vw)',
      lineHeight: '1.3',
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
      gap: '6px',
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
          row.textContent = formatMessageLine(m);
          row.style.color = getMessageColor(String(m.type || 'default'));
        } else {
          row.textContent = String(m ?? '');
          row.style.color = getMessageColor('default');
        }
        row.style.opacity = i === 0 ? '1' : '0.9';
        row.style.textShadow = '0 1px 0 rgba(0,0,0,0.42)';
        row.style.whiteSpace = 'normal';
        row.style.overflowWrap = 'anywhere';
        row.style.wordBreak = 'break-word';
        row.style.lineHeight = '1.45';
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
      row.textContent = formatMessageLine(m);
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
 * @param {any} message
 * @returns {string}
 */
function formatMessageLine(message) {
  const text = String(message?.text || '');
  const repeat = Math.max(1, Number(message?.repeat || 1));
  if (repeat <= 1) return text;
  return `${text} ×${repeat}`;
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

/** Helper: create a styled stat line for the death screen. */
function _deathStatLine(label, value, color) {
  const el = document.createElement('div');
  el.textContent = `${label}: ${value}`;
  if (color) el.style.color = color;
  return el;
}

/** @param {HTMLDivElement} panel @param {object} detail */
function renderDeathScreen(panel, detail) {
  panel.innerHTML = '';

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(460px, 90vw)', textAlign: 'center',
    background: '#0b0e16', border: '1px solid #3a1c1c', borderRadius: '10px',
    padding: '28px 24px', boxShadow: '0 0 60px rgba(180,40,40,0.35)',
    color: '#cfe8ff', maxHeight: '90vh', overflowY: 'auto',
  });

  // Skull
  const skull = document.createElement('div');
  skull.textContent = '\u2620\uFE0F';
  skull.style.fontSize = '64px';
  skull.style.marginBottom = '8px';
  box.appendChild(skull);

  // Title — include player name if available
  const pName = detail?.playerName && detail.playerName !== 'Unnamed' ? detail.playerName : null;
  const title = document.createElement('div');
  title.textContent = pName ? `${pName} Has Perished` : 'You Have Perished';
  Object.assign(title.style, {
    fontSize: '22px', fontWeight: 'bold', color: '#ff6b6b',
    textShadow: '0 0 12px rgba(255,60,60,0.4)', marginBottom: '16px',
  });
  box.appendChild(title);

  // --- Primary stats ---
  const depth = detail?.depth ?? 1;
  const score = detail?.score ?? 0;
  const seed = detail?.seed ?? 0;
  const seedHex = seed ? '0x' + seed.toString(16).toUpperCase() : '???';
  const killerName = detail?.killerName;
  const cause = detail?.cause;

  const stats = document.createElement('div');
  Object.assign(stats.style, { marginBottom: '14px', lineHeight: '1.8', fontSize: '14px' });

  if (detail?.className) {
    stats.appendChild(_deathStatLine('Class', detail.className, '#90caf9'));
  }

  if (killerName) {
    stats.appendChild(_deathStatLine('Slain by', killerName, '#ff9999'));
  } else if (cause && cause !== 'unknown') {
    stats.appendChild(_deathStatLine('Cause', cause, '#ff9999'));
  }

  stats.appendChild(_deathStatLine('Depth reached', depth));
  stats.appendChild(_deathStatLine('Score', score));

  // Gold
  const gold = detail?.gold ?? 0;
  if (gold > 0) stats.appendChild(_deathStatLine('Gold', `${gold}g`, '#ffd700'));

  // Turns / days survived
  const turns = detail?.turns ?? 0;
  const days = detail?.days ?? 0;
  if (turns > 0) {
    const timeStr = days > 0 ? `${turns} (${days} day${days === 1 ? '' : 's'})` : String(turns);
    stats.appendChild(_deathStatLine('Turns survived', timeStr));
  }

  // Spells learned
  const spellCount = detail?.spellCount ?? 0;
  if (spellCount > 0) stats.appendChild(_deathStatLine('Spells learned', spellCount, '#b388ff'));

  // Equipped weapon
  if (detail?.weaponName) {
    stats.appendChild(_deathStatLine('Weapon', detail.weaponName, '#4fc3f7'));
  }

  // Deity
  if (detail?.deityName) {
    stats.appendChild(_deathStatLine('Devoted to', detail.deityName, '#ce93d8'));
  }

  // Status effects at death
  const statusList = detail?.statusList;
  if (statusList && statusList.length > 0) {
    stats.appendChild(_deathStatLine('Status', statusList.join(', '), '#ff8a65'));
  }

  box.appendChild(stats);

  // --- Traits ---
  const traitList = detail?.traitList;
  if (traitList && traitList.length > 0) {
    const traitBox = document.createElement('div');
    Object.assign(traitBox.style, {
      marginBottom: '14px', fontSize: '12px', color: '#a0c4ff',
      fontStyle: 'italic', lineHeight: '1.6',
    });
    traitBox.textContent = traitList.join(' \u00B7 ');
    box.appendChild(traitBox);
  }

  // Seed + Version
  const version = String((/** @type {any} */ (globalThis)).VERSION || '').trim();
  const metaText = version ? `Seed: ${seedHex}  |  v${version}` : `Seed: ${seedHex}`;
  const seedLine = document.createElement('div');
  seedLine.textContent = metaText;
  Object.assign(seedLine.style, { opacity: '0.5', fontSize: '12px', marginBottom: '14px' });
  box.appendChild(seedLine);

  // --- Global Highscores ---
  {
    const hsSection = document.createElement('div');
    Object.assign(hsSection.style, {
      marginBottom: '16px', borderTop: '1px solid #1e2a3e', paddingTop: '14px',
    });
    const hsHeading = document.createElement('div');
    hsHeading.textContent = 'Global Highscores';
    Object.assign(hsHeading.style, {
      fontSize: '11px', color: '#3a5070', textTransform: 'uppercase',
      letterSpacing: '0.1em', marginBottom: '8px',
    });
    hsSection.appendChild(hsHeading);
    const hsList = document.createElement('div');
    hsList.textContent = 'Loading\u2026';
    Object.assign(hsList.style, { fontSize: '12px', color: '#3a5070' });
    hsSection.appendChild(hsList);
    box.appendChild(hsSection);
    getHighscores().then(scores => {
      hsList.textContent = '';
      if (!scores || scores.length === 0) return;
      const top = scores.slice(0, 10);
      for (let i = 0; i < top.length; i++) {
        const entry = top[i];
        const isPlayer = detail?.playerName && entry.playerName === detail.playerName;
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex', gap: '8px', lineHeight: '1.7',
          fontSize: '12px', fontFamily: 'monospace',
          color: isPlayer ? '#ffd700' : '#7a9ab0',
          fontWeight: isPlayer ? 'bold' : 'normal',
        });
        const rankEl = document.createElement('span');
        rankEl.textContent = `#${i + 1}`;
        rankEl.style.cssText = 'width:2.2em;text-align:right;flex-shrink:0;color:#3a5878';
        if (isPlayer) rankEl.style.color = '#ffd700';
        const versionEl = document.createElement('span');
        versionEl.textContent = getHighscoreVersionLabel(entry);
        versionEl.style.cssText = 'width:5.4em;text-align:left;flex-shrink:0;color:#6a84a2;opacity:0.9';
        if (isPlayer) { versionEl.style.color = '#ffd700'; versionEl.style.opacity = '1'; }
        const nameEl = document.createElement('span');
        nameEl.textContent = entry.playerName || '???';
        nameEl.style.cssText = 'flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const scoreEl = document.createElement('span');
        scoreEl.textContent = String(entry.score ?? 0);
        scoreEl.style.cssText = 'text-align:right;flex-shrink:0;color:#90c89a';
        if (isPlayer) scoreEl.style.color = '#ffd700';
        const clsEl = document.createElement('span');
        clsEl.textContent = entry.className || '';
        clsEl.style.cssText = 'width:5.5em;text-align:left;flex-shrink:0;color:#7090b0;opacity:0.8';
        if (isPlayer) { clsEl.style.color = '#ffd700'; clsEl.style.opacity = '1'; }
        row.appendChild(rankEl);
        row.appendChild(versionEl);
        row.appendChild(nameEl);
        row.appendChild(scoreEl);
        row.appendChild(clsEl);
        hsList.appendChild(row);
      }
    }).catch(() => { hsList.textContent = ''; });
  }

  // Share button
  if (detail?.shareUrl) {
    const shareBtn = document.createElement('a');
    shareBtn.href = detail.shareUrl;
    shareBtn.target = '_blank';
    shareBtn.rel = 'noopener';
    shareBtn.textContent = '\u2620\uFE0F Share Your Death';
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

  // Copy Score Proof button
  if (detail?.proofBundle) {
    const proofBtn = document.createElement('button');
    proofBtn.textContent = '\uD83D\uDD12 Copy Score Proof';
    Object.assign(proofBtn.style, {
      display: 'inline-block', padding: '10px 22px',
      background: '#1a1a2e', color: '#cfe8ff', fontFamily: 'monospace',
      border: '1px solid #2d3b52', borderRadius: '6px',
      cursor: 'pointer', fontSize: '14px',
      marginBottom: '12px',
      transition: 'background 120ms',
    });
    proofBtn.addEventListener('mouseenter', () => { proofBtn.style.background = '#242448'; });
    proofBtn.addEventListener('mouseleave', () => { proofBtn.style.background = '#1a1a2e'; });
    proofBtn.addEventListener('click', () => {
      const json = JSON.stringify(detail.proofBundle, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json)
          .then(() => { proofBtn.textContent = '\u2705 Copied!'; })
          .catch(() => { proofBtn.textContent = '\u274C Copy failed'; });
      } else {
        proofBtn.textContent = '\u274C Clipboard unavailable';
      }
    });
    box.appendChild(proofBtn);
    box.appendChild(document.createElement('br'));
  }

  // New Game button
  {
    const newGameBtn = document.createElement('a');
    newGameBtn.href = location.origin + location.pathname;
    newGameBtn.textContent = '\u2694 New Game';
    Object.assign(newGameBtn.style, {
      display: 'inline-block', padding: '10px 22px',
      background: '#1a2e1a', color: '#b4ffb4', fontFamily: 'monospace',
      border: '1px solid #2d523b', borderRadius: '6px',
      cursor: 'pointer', textDecoration: 'none', fontSize: '14px',
      marginBottom: '12px',
      transition: 'background 120ms',
    });
    newGameBtn.addEventListener('mouseenter', () => { newGameBtn.style.background = '#244824'; });
    newGameBtn.addEventListener('mouseleave', () => { newGameBtn.style.background = '#1a2e1a'; });
    box.appendChild(newGameBtn);
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
