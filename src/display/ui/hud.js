// display/ui/hud.js
// Minimal HUD with an Active Spell button.
import { createConcentricGauge } from './concentricGauge.js';

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
  const identified = it?.details?.identified ?? it?.identified;
  if (identity === 'scroll_identify') return 'apply';
  if (identified === false && !!it?.hasScrollOfIdentify) return 'identify';
  const t = String(it?.type || '');
  if (t === 'equip' || t === 'ammo' || t === 'wand') return 'equip';
  if (t === 'potion') return 'drink';
  return 'use';
}

/**
 * @param {any} it
 * @returns {string}
 */
export function getQuickChipPrimaryActionLabel(it) {
  const action = getQuickChipPrimaryAction(it);
  if (action === 'identify') return 'Identify';
  if (action === 'apply') return 'Apply';
  if (action === 'equip') return 'Equip';
  if (action === 'drink') return 'Drink';
  return 'Use';
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

  {
    const SEARCH_LONG_PRESS_MS = 500;
    const WAIT_REPEAT_MS = 222;
    let searchPressTimer = null;
    let searchRepeatTimer = null;
    let searchIsLongPress = false;

    function searchStartPress() {
      searchIsLongPress = false;
      searchPressTimer = setTimeout(() => {
        searchIsLongPress = true;
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
    display: 'none' // Hidden by default, shown when pet exists
  });

  const ACTION_ICONS = Object.freeze({
    character: '@',
    bag: '\u{1F392}',         // 🎒
    cast: '\u2726',           // ✦
    spells: '\u{1F4D6}',      // 📖
    shoot: '\u{1F3F9}',       // 🏹
    zap: '\u26A1',            // ⚡
    pray: '\u{1F64F}',        // 🙏
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
    pressTimer = setTimeout(() => {
      isLongPress = true;
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

  const commandButtons = [charBtn, bagBtn, petBtn, castBtn, spellSelectBtn, shootBtn, prayBtn, waitBtn];
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
    }
  };

  setDesktopLabel(charBtn, 'Character'); setMobileLabel(charBtn, 'Character');
  setDesktopLabel(bagBtn, 'Inventory'); setMobileLabel(bagBtn, 'Bag');
  setDesktopLabel(petBtn, 'Pet: Following'); setMobileLabel(petBtn, 'Pet');
  setDesktopLabel(castBtn, 'Cast'); setMobileLabel(castBtn, 'Cast');
  setDesktopLabel(spellSelectBtn, 'Spells'); setMobileLabel(spellSelectBtn, 'Spells');
  setDesktopLabel(shootBtn, 'Shoot'); setMobileLabel(shootBtn, 'Shoot');
  setDesktopLabel(prayBtn, 'Pray'); setMobileLabel(prayBtn, 'Pray');
  setDesktopLabel(waitBtn, 'Search'); setMobileLabel(waitBtn, 'Search');
  setDesktopIcon(charBtn, ACTION_ICONS.character); setMobileIcon(charBtn, ACTION_ICONS.character);
  setDesktopIcon(bagBtn, ACTION_ICONS.bag); setMobileIcon(bagBtn, ACTION_ICONS.bag);
  setDesktopIcon(petBtn, ACTION_ICONS.petDefault); setMobileIcon(petBtn, ACTION_ICONS.petDefault);
  setDesktopIcon(castBtn, ACTION_ICONS.cast); setMobileIcon(castBtn, ACTION_ICONS.cast);
  setDesktopIcon(spellSelectBtn, ACTION_ICONS.spells); setMobileIcon(spellSelectBtn, ACTION_ICONS.spells);
  setDesktopIcon(shootBtn, ACTION_ICONS.shoot); setMobileIcon(shootBtn, ACTION_ICONS.shoot);
  setDesktopIcon(prayBtn, ACTION_ICONS.pray); setMobileIcon(prayBtn, ACTION_ICONS.pray);
  setDesktopIcon(waitBtn, ACTION_ICONS.search); setMobileIcon(waitBtn, ACTION_ICONS.search);
  setBarLabel(charBtn, 'Char');
  setBarLabel(bagBtn, 'Bag');
  setBarLabel(petBtn, 'Pet');
  setBarLabel(castBtn, 'Cast');
  setBarLabel(spellSelectBtn, 'Spells');
  setBarLabel(shootBtn, 'Shoot');
  setBarLabel(prayBtn, 'Pray');
  setBarLabel(waitBtn, 'Search');
  charBtn.dataset.keyHint = 'c';
  bagBtn.dataset.keyHint = 'i';
  petBtn.dataset.keyHint = 'p';
  castBtn.dataset.keyHint = 'f';
  spellSelectBtn.dataset.keyHint = 'S';
  shootBtn.dataset.keyHint = 'r';
  prayBtn.dataset.keyHint = 'P';
  waitBtn.dataset.keyHint = '.';

  function applyCommandBarLayout() {
    const isMobile = mobileLayoutMq.matches;
    // Temporarily hidden per UX direction.
    helpBtn.style.display = 'none';
    // Resize vitals gauge for mobile vs desktop
    const gaugeSize = isMobile ? 'min(110px, 26vw)' : 'min(188px, 22vw)';
    vitals.style.width = gaugeSize;
    vitals.style.height = gaugeSize;
    // Hide spell slots on mobile, show on desktop
    spellSlotsContainer.style.display = isMobile ? 'none' : 'flex';
    // Show mobile radial on mobile, hide on desktop
    if (_mobileRadialEl) _mobileRadialEl.style.display = isMobile ? 'block' : 'none';

    if (isMobile) {
      Object.assign(bar.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
      refreshCommandLabels();
      return;
    }

    Object.assign(bar.style, {
      display: 'flex',
      gridTemplateColumns: '',
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
    }
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
    petBtn.style.display = exists ? 'grid' : 'none';
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
    const canCast = Boolean(e?.detail?.canCast ?? true);
    setDesktopLabel(castBtn, name ? (cost ? `Cast [${name}] (${cost})` : `Cast [${name}]`) : 'Cast');
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

    // Fingerprint includes cooldown state so UI updates each tick while any CD is active
    const fp = JSON.stringify(slots.map(s => {
      if (!s) return '';
      return s.id + ':' + (s.cdRemaining || 0);
    })) + '|' + (activeId || '') + '|' + mana;
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
        const canAfford = mana >= Number(spell.cost || 0);
        btn.style.opacity = (canAfford && !onCooldown) ? '1' : '0.5';
        const isActive = spell.id === activeId;
        btn.style.borderColor = isActive ? '#6b8fbf' : '#2d3b52';
        btn.style.background = isActive ? '#152035' : '#101626';
        const cdTip = onCooldown ? ` [${cdRemaining} turns]` : '';
        btn.title = `${spell.name || spell.id} (${spell.cost || 0} mana)${cdTip}`;
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
          position: 'absolute', bottom: '2px', left: '0', right: '0',
          textAlign: 'center', fontSize: '9px', lineHeight: '1',
          opacity: '0.7', letterSpacing: '0.3px', pointerEvents: 'none',
          zIndex: '3',
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
  const quick = createQuickSlot();
  bar.appendChild(charBtn);
  bar.appendChild(bagBtn);
  bar.appendChild(petBtn);
  bar.appendChild(spellSlotsContainer);
  bar.appendChild(castBtn);
  bar.appendChild(spellSelectBtn);
  bar.appendChild(shootBtn);
  bar.appendChild(prayBtn);
  bar.appendChild(waitBtn);
  root.appendChild(bar);
  root.appendChild(quick.el);

  // --- Channeling overlay (progress bar + cancel button) ---
  const channelingOverlay = createChannelingOverlay();
  root.appendChild(channelingOverlay.el);

  // --- Mobile radial spell button ---
  const mobileRadial = createMobileSpellRadial(mobileLayoutMq);
  _mobileRadialEl = mobileRadial.el;
  root.appendChild(mobileRadial.el);

  applyCommandBarLayout();
  syncActionBarHeight();

  if (typeof mobileLayoutMq.addEventListener === 'function') {
    mobileLayoutMq.addEventListener('change', () => {
      applyCommandBarLayout();
      syncActionBarHeight();
    });
  } else if (typeof mobileLayoutMq.addListener === 'function') {
    mobileLayoutMq.addListener(() => {
      applyCommandBarLayout();
      syncActionBarHeight();
    });
  }
  window.addEventListener('resize', syncActionBarHeight);
  if (typeof ResizeObserver !== 'undefined') {
    const obs = new ResizeObserver(() => syncActionBarHeight());
    obs.observe(bar);
  }

  return { castBtn, charBtn, bagBtn, spellSelectBtn, shootBtn, prayBtn, waitBtn, petBtn };
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

  function createBadge(spec, total) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'relative', width: '58px', height: '58px', borderRadius: '8px',
      display: 'grid', placeItems: 'center',
      boxShadow: '0 1px 0 rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04)',
      outline: `1px solid ${hsla(spec.hue, 0.28)}`,
      background: hsla(spec.hue, 0.2),
    });
    el.title = `${spec.name} \u2022 ${total} turns`;

    const glyph = document.createElement('div');
    glyph.textContent = spec.glyph;
    Object.assign(glyph.style, { fontSize: '28px', lineHeight: '1', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.6))', color: shadowColor(spec.hue) });

    const label = document.createElement('div');
    Object.assign(label.style, { position: 'absolute', left: '6px', bottom: '2px', fontSize: '10px', color: 'rgba(255,255,255,.8)' });
    label.textContent = String(spec.name).split(' ')[0];

    const ticks = document.createElement('div');
    Object.assign(ticks.style, { position: 'absolute', right: '4px', bottom: '2px', fontSize: '12px', fontWeight: '700', color: '#fff', textShadow: '0 1px 0 #000, 0 0 4px rgba(0,0,0,.7)' });
    ticks.textContent = String(total);

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute', left: '6px', top: '6px', right: '6px', bottom: '6px', borderRadius: '8px', pointerEvents: 'none',
      background: 'conic-gradient(rgba(180,190,200,.2) 0deg, transparent 0)'
    });

    const stacksEl = document.createElement('div');
    Object.assign(stacksEl.style, { position: 'absolute', right: '4px', top: '2px', fontSize: '11px', fontWeight: '700', color: '#ffcc44', textShadow: '0 1px 0 #000, 0 0 4px rgba(0,0,0,.7)', zIndex: '2' });
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
function createQuickSlot() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    right: '8px',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 12px + env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
    pointerEvents: 'auto',
    zIndex: 901,
  });

  /** @type {Array<{id:number, identity?:string, type:string, slot?:string, name:string, count:number, rarityName?:string, glyph?:string, glyphColor?:string, hasScrollOfIdentify?:boolean, details?:any, addedAt:number}>} */
  const stack = [];
  const AUTO_DISMISS_MS = 12000;

  function actionable(it) {
    const t = String(it.type||'');
    if (t === 'equip' || t === 'ammo' || t === 'wand') return true;
    if (t === 'tool') return true;
    if (t === 'potion' || t === 'scroll' || t === 'learn' || t === 'book' || t === 'food') return (it.count||0) > 0;
    return false;
  }

  let dismissTimer = 0;
  function resetDismissTimer() {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (stack.length === 0) return;
    dismissTimer = setTimeout(() => {
      stack.pop();
      renderStack();
      resetDismissTimer();
    }, AUTO_DISMISS_MS);
  }

  function renderStack() {
    el.innerHTML = '';
    popUntilActionableTop(stack, actionable);
    const it = peekStackTop(stack);
    if (!it) return;
    const chip = renderQuickChip(it, {
      onUse: () => dispatchAction(it),
      onThrow: Number(it?.id || 0) > 0 ? () => dispatchThrow(it) : null,
      onDrop: Number(it?.id || 0) > 0 ? () => dispatchDrop(it) : null,
      onDismiss: () => dismissTop()
    });
    el.appendChild(chip);
  }

  function dispatchAction(it) {
    const action = getQuickChipPrimaryAction(it);
    if (action === 'identify') {
      window.dispatchEvent(new CustomEvent('ui:requestQuickChipIdentify', { detail: { targetItemId: it.id } }));
    } else if (action === 'apply') {
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

  function dismissTop() {
    stack.pop();
    renderStack();
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
    stack.push({
      id: Number(item.id||0),
      identity: String(item.identity || ''),
      type: String(item.type||''),
      slot: String(item.slot||''),
      name: String(item.name||'item'),
      count: Number(item.count||1),
      rarityName: String(item.rarityName || 'common'),
      glyph: String(item.glyph || ''),
      glyphColor: String(item.glyphColor || ''),
      hasScrollOfIdentify: !!item.hasScrollOfIdentify,
      details: item,
      addedAt: Date.now()
    });
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
      stack.push({
        id,
        identity: String(item.identity || ''),
        type: String(item.type || ''),
        slot: String(item.slot || ''),
        name: String(item.name || 'item'),
        count: Number(item.count || 1),
        rarityName: String(item.rarityName || 'common'),
        glyph: String(item.glyph || ''),
        glyphColor: String(item.glyphColor || ''),
        hasScrollOfIdentify: !!item.hasScrollOfIdentify,
        details: item,
        addedAt: Date.now(),
      });
      renderStack();
      resetDismissTimer();
    }
  });

  return { el };
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
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    right: 'calc(12px + env(safe-area-inset-right, 0px))',
    bottom: 'calc(var(--jshack-actionbar-height, 48px) + 16px + env(safe-area-inset-bottom, 0px))',
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
      // Hold release — check if finger is over a fan item
      if (e && e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const item = target?.closest?.('[data-spell-id]');
        if (item) {
          window.dispatchEvent(new CustomEvent('ui:selectActiveSpell', {
            detail: { spellId: item.dataset.spellId }
          }));
        }
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
    trigger.style.transform = 'scale(1.1)';
    trigger.style.borderColor = '#6b8fbf';
    fan.style.display = 'block';
    window.dispatchEvent(new CustomEvent('ui:requestSpellData'));
  }

  function closeFan() {
    _fanOpen = false;
    trigger.style.transform = '';
    trigger.style.borderColor = '#2d3b52';
    fan.style.display = 'none';
    fan.innerHTML = '';
  }

  // --- Fan item rendering ---
  function renderFanItems(spells, activeId) {
    fan.innerHTML = '';
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
        transition: 'opacity 0.15s ease',
        opacity: '0',
      });

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

      // Stagger fade-in
      const idx = i;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (fan.contains(item)) {
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
    renderFanItems(spells, activeId);
  });

  // Close fan when a spell overlay opens or a spell is cast
  window.addEventListener('ui:castActiveSpell', () => { if (_fanOpen) closeFan(); });

  // Close fan on outside touch
  document.addEventListener('touchstart', (e) => {
    if (_fanOpen && !el.contains(/** @type {Node} */ (e.target))) closeFan();
  }, { passive: true });

  return { el };
}

/** @param {{id:number,identity?:string,name:string,type:string,count:number}} it @param {{onUse:Function,onDismiss:Function,onThrow?:Function|null,onDrop?:Function|null}} h */
function renderQuickChip(it, h) {
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '8px',
    minWidth: '220px',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #2d3b52',
    background: '#101626',
    color: '#cfe8ff'
  });
  const x = document.createElement('button');
  Object.assign(x.style, {
    position: 'absolute',
    right: '6px',
    top: '6px',
    width: '24px',
    height: '24px',
    lineHeight: '20px',
    textAlign: 'center',
    padding: '0',
    background: '#101626',
    color: '#cfe8ff',
    border: '1px solid #2d3b52',
    borderRadius: '6px',
    cursor: 'pointer',
  });
  x.textContent = '\u00D7';
  x.title = 'Dismiss';
  x.addEventListener('click', () => h.onDismiss && h.onDismiss());

  const summary = document.createElement('div');
  Object.assign(summary.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '26px',
    paddingRight: '28px',
  });

  const glyph = document.createElement('span');
  glyph.textContent = String(it?.glyph || '\u2022');
  Object.assign(glyph.style, {
    color: String(it?.glyphColor || '#cfe8ff'),
    minWidth: '16px',
    textAlign: 'center',
    fontWeight: '700',
  });

  const name = document.createElement('div');
  const count = Number(it?.count || 1);
  name.textContent = count > 1 ? `${String(it?.name || 'Item')} x${count}` : String(it?.name || 'Item');
  Object.assign(name.style, {
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1.3',
    wordBreak: 'break-word',
    color: quickChipRarityColor(it?.rarityName),
  });
  summary.appendChild(glyph);
  summary.appendChild(name);

  const statsText = buildQuickChipStatsText(it);
  if (statsText) {
    const stats = document.createElement('div');
    stats.textContent = statsText;
    Object.assign(stats.style, {
      fontSize: '11px',
      lineHeight: '1.2',
      opacity: '0.82',
      paddingLeft: '24px',
      marginTop: '-2px',
      marginBottom: '2px',
    });
    chip.appendChild(stats);
  }

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
  btn.textContent = getQuickChipPrimaryActionLabel(it);
  btn.addEventListener('click', () => h.onUse && h.onUse());

  let throwBtn = null;
  if (typeof h.onThrow === 'function') {
    throwBtn = document.createElement('button');
    Object.assign(throwBtn.style, {
      padding: '6px 10px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
    });
    throwBtn.textContent = 'Throw';
    throwBtn.addEventListener('click', () => h.onThrow && h.onThrow());
  }

  let dropBtn = null;
  if (typeof h.onDrop === 'function') {
    dropBtn = document.createElement('button');
    Object.assign(dropBtn.style, {
      padding: '6px 10px', background: '#101626', color: '#cfe8ff',
      border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
    });
    dropBtn.textContent = 'Drop';
    dropBtn.addEventListener('click', () => h.onDrop && h.onDrop());
  }

  const actions = document.createElement('div');
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: '6px',
    flexWrap: 'wrap',
  });
  actions.appendChild(btn);
  if (throwBtn) actions.appendChild(throwBtn);
  if (dropBtn) actions.appendChild(dropBtn);

  chip.appendChild(x);
  chip.appendChild(summary);
  chip.appendChild(actions);
  return chip;
}

/**
 * @param {any} rarityName
 * @returns {string}
 */
function quickChipRarityColor(rarityName) {
  const rn = String(rarityName || 'common').toLowerCase();
  if (rn === 'common') return '#cfe8ff';
  if (rn === 'uncommon') return '#7fe38f';
  if (rn === 'rare') return '#6eb2ff';
  if (rn === 'epic') return '#c18cff';
  if (rn === 'legendary') return '#ffcf5a';
  return '#cfe8ff';
}

/**
 * @param {any} it
 * @returns {string}
 */
function buildQuickChipStatsText(it) {
  const d = (it && typeof it.details === 'object' && it.details) ? it.details : it;
  const parts = [];

  const dd = d?.damageDice;
  const dc = Number(dd?.count || 0) | 0;
  const ds = Number(dd?.sides || 0) | 0;
  if (dc > 0 && ds > 0) parts.push(`DMG ${dc}d${ds}`);

  const staminaCost = Number(d?.staminaCost ?? 0);
  if (Number.isFinite(staminaCost) && staminaCost > 0) parts.push(`STA ${staminaCost}`);

  const bonuses = (d?.bonuses && typeof d.bonuses === 'object') ? d.bonuses : null;
  if (bonuses) {
    const labels = {
      attackBonus: 'ATK',
      armorClass: 'AC',
      defense: 'DEF',
      spellPower: 'SP',
      damagePower: 'POW',
      accuracy: 'ACC',
      evade: 'EVA',
      mitigation: 'MIT',
      luck: 'LUK',
    };
    for (const [key, label] of Object.entries(labels)) {
      const n = Number(bonuses[key] ?? 0);
      if (!Number.isFinite(n) || n === 0) continue;
      const sign = n > 0 ? '+' : '';
      parts.push(`${label} ${sign}${n}`);
    }
  }

  if (parts.length > 0) return parts.slice(0, 4).join(' · ');

  const detailLines = Array.isArray(d?.detailLines) ? d.detailLines : [];
  for (const line of detailLines) {
    const text = String(line || '').trim();
    if (text) return text;
  }
  return '';
}
