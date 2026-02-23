// display/ui/hud.js
// Minimal HUD with an Active Spell button.
import { createConcentricGauge } from './concentricGauge.js';

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

  // Inventory toggle button
  const invBtn = document.createElement('button');
  invBtn.id = 'btn-inventory';
  invBtn.textContent = 'Inventory';
  Object.assign(invBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  invBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:toggleInventory')); } catch (e) { console.debug('[hud] dispatch ui:toggleInventory:', e); }
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

  // Throw item button
  const throwBtn = document.createElement('button');
  throwBtn.id = 'btn-throw';
  throwBtn.textContent = 'Throw';
  Object.assign(throwBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  throwBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:openThrowChooser')); } catch (e) { console.debug('[hud] dispatch ui:openThrowChooser:', e); }
  });

  // Engrave button (to the right of Shoot)
  const engraveBtn = document.createElement('button');
  engraveBtn.id = 'btn-engrave';
  engraveBtn.textContent = 'Engrave';
  Object.assign(engraveBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff',
    cursor: 'pointer'
  });
  engraveBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:engrave')); } catch (e) { console.debug('[hud] dispatch ui:engrave:', e); }
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

  // Disarm trap button (context action — shown when standing on a trap)
  const disarmBtn = document.createElement('button');
  disarmBtn.id = 'btn-disarm';
  disarmBtn.textContent = 'Disarm';
  Object.assign(disarmBtn.style, {
    padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #52382d', background: '#261010', color: '#ffd6cf',
    cursor: 'pointer',
    display: 'none' // Hidden by default, shown when trap is nearby
  });
  disarmBtn.addEventListener('click', () => {
    try { window.dispatchEvent(new CustomEvent('ui:disarmTrap')); } catch (e) { console.debug('[hud] dispatch ui:disarmTrap:', e); }
  });

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
    inventory: '\u{1F392}',   // 🎒
    cast: '\u2726',           // ✦
    shoot: '\u{1F3F9}',       // 🏹
    zap: '\u26A1',            // ⚡
    throw: '\u2934',          // ⤴
    engrave: '\u270E',        // ✎
    pray: '\u{1F64F}',        // 🙏
    disarm: '\u{1F9F0}',      // 🧰
    petDefault: '\u{1F43E}',  // 🐾
  });

  const PET_STATE_ICONS = Object.freeze({
    following: '\u{1F43E}',    // 🐾
    staying: '\u2693',         // ⚓
    fetching: '\u{1F9B4}',     // 🦴
    returning: '\u21A9',       // ↩
    guarding: '\u{1F6E1}\uFE0F', // 🛡️
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
  petBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent mouse event emulation
    startPress();
  });

  petBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    endPress();
  });

  petBtn.addEventListener('touchcancel', () => {
    cancelPress();
  });

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

  const commandButtons = [invBtn, petBtn, castBtn, shootBtn, throwBtn, engraveBtn, prayBtn, disarmBtn];
  for (const btn of commandButtons) {
    Object.assign(btn.style, {
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
  const setDesktopLabel = (btn, text) => { btn.dataset.desktopLabel = String(text || ''); };
  const setMobileLabel = (btn, text) => { btn.dataset.mobileLabel = String(text || ''); };
  const setDesktopIcon = (btn, text) => { btn.dataset.desktopIcon = String(text || ''); };
  const setMobileIcon = (btn, text) => { btn.dataset.mobileIcon = String(text || ''); };
  const refreshCommandLabels = () => {
    const isMobile = mobileLayoutMq.matches;
    for (const btn of commandButtons) {
      const desktopText = String(btn.dataset.desktopLabel || btn.textContent || '');
      const mobileText = String(btn.dataset.mobileLabel || desktopText);
      const desktopIcon = String(btn.dataset.desktopIcon || btn.textContent || '');
      const mobileIcon = String(btn.dataset.mobileIcon || desktopIcon);
      const visibleText = isMobile ? mobileText : desktopText;
      btn.textContent = isMobile ? mobileIcon : desktopIcon;
      btn.title = desktopText || visibleText || '';
      btn.setAttribute('aria-label', desktopText || visibleText || 'Action');
    }
  };

  setDesktopLabel(invBtn, 'Inventory'); setMobileLabel(invBtn, 'Inventory');
  setDesktopLabel(petBtn, 'Pet: Following'); setMobileLabel(petBtn, 'Pet');
  setDesktopLabel(castBtn, 'Cast'); setMobileLabel(castBtn, 'Cast');
  setDesktopLabel(shootBtn, 'Shoot'); setMobileLabel(shootBtn, 'Shoot');
  setDesktopLabel(throwBtn, 'Throw'); setMobileLabel(throwBtn, 'Throw');
  setDesktopLabel(engraveBtn, 'Engrave'); setMobileLabel(engraveBtn, 'Engrave');
  setDesktopLabel(prayBtn, 'Pray'); setMobileLabel(prayBtn, 'Pray');
  setDesktopLabel(disarmBtn, 'Disarm'); setMobileLabel(disarmBtn, 'Disarm');
  setDesktopIcon(invBtn, ACTION_ICONS.inventory); setMobileIcon(invBtn, ACTION_ICONS.inventory);
  setDesktopIcon(petBtn, ACTION_ICONS.petDefault); setMobileIcon(petBtn, ACTION_ICONS.petDefault);
  setDesktopIcon(castBtn, ACTION_ICONS.cast); setMobileIcon(castBtn, ACTION_ICONS.cast);
  setDesktopIcon(shootBtn, ACTION_ICONS.shoot); setMobileIcon(shootBtn, ACTION_ICONS.shoot);
  setDesktopIcon(throwBtn, ACTION_ICONS.throw); setMobileIcon(throwBtn, ACTION_ICONS.throw);
  setDesktopIcon(engraveBtn, ACTION_ICONS.engrave); setMobileIcon(engraveBtn, ACTION_ICONS.engrave);
  setDesktopIcon(prayBtn, ACTION_ICONS.pray); setMobileIcon(prayBtn, ACTION_ICONS.pray);
  setDesktopIcon(disarmBtn, ACTION_ICONS.disarm); setMobileIcon(disarmBtn, ACTION_ICONS.disarm);

  function applyCommandBarLayout() {
    const isMobile = mobileLayoutMq.matches;
    // Temporarily hidden per UX direction.
    helpBtn.style.display = 'none';
    // Resize vitals gauge for mobile vs desktop
    const gaugeSize = isMobile ? 'min(110px, 26vw)' : 'min(188px, 22vw)';
    vitals.style.width = gaugeSize;
    vitals.style.height = gaugeSize;
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
    petBtn.style.display = exists ? '' : 'none';
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
    } else {
      petBtn.style.background = '#101626'; // Default
    }
  });

  // Show/hide disarm button based on trap proximity
  window.addEventListener('ui:trapNearby', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const nearby = Boolean(e?.detail?.nearby);
    const trapType = String(e?.detail?.trapType || 'Trap');
    disarmBtn.style.display = nearby ? '' : 'none';
    if (nearby) {
      const label = `Disarm ${trapType}`;
      setDesktopLabel(disarmBtn, label);
      setMobileLabel(disarmBtn, label);
      refreshCommandLabels();
    }
  });

  // Update label when app sets active spell
  window.addEventListener('ui:updateActiveSpellLabel', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const name = String(e?.detail?.name || '').trim();
    const cost = Number(e?.detail?.cost || 0);
    const canCast = Boolean(e?.detail?.canCast ?? true);
    setDesktopLabel(castBtn, name ? (cost ? `Cast [${name}] (${cost})` : `Cast [${name}]`) : 'Cast');
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
  });

  // Right-aligned bar: compact core actions only.
  const quick = createQuickSlot();
  bar.appendChild(invBtn);
  bar.appendChild(petBtn);
  bar.appendChild(castBtn);
  bar.appendChild(shootBtn);
  bar.appendChild(throwBtn);
  bar.appendChild(engraveBtn);
  bar.appendChild(prayBtn);
  bar.appendChild(disarmBtn);
  root.appendChild(bar);
  root.appendChild(quick.el);

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

  return { castBtn, invBtn, shootBtn, throwBtn, engraveBtn, prayBtn, petBtn, disarmBtn };
}

// --- Effects Stack (status badges with pie timers) -------------------------
function ensureEffectsStack(container) {
  if (container.__effectsStack) return container.__effectsStack;

  /** @type {Map<string, { el: HTMLDivElement, total: number, overlay: HTMLDivElement, ticksEl: HTMLDivElement, stacksEl: HTMLDivElement }>} */
  const byKey = new Map();

  // Keyed by canonical Status.type strings from effectDefs statuses[]
  const VIS = {
    invulnerable: { name: 'Aegis',     glyph: '\u{1F6E1}\uFE0F', hue: 190 },
    burning:      { name: 'Burning',   glyph: '\u{1F525}',       hue: 20  },
    poisoned:     { name: 'Poison',    glyph: '\u2620\uFE0F',    hue: 120 },
    regen:        { name: 'Regen',     glyph: '\u{1F49A}',       hue: 140 },
    stunned:      { name: 'Stunned',   glyph: '\u{1F4AB}',       hue: 45  },
    thorns:       { name: 'Thorns',    glyph: '\u{1F339}',       hue: 110 },
    disease:      { name: 'Disease',   glyph: '\u{1F9A0}',       hue: 55  },
    bleeding:     { name: 'Bleed',     glyph: '\u{1FA78}',       hue: 350 },
    shocked:      { name: 'Shocked',   glyph: '\u26A1',          hue: 55  },
    frozen:       { name: 'Frozen',    glyph: '\u2744\uFE0F',    hue: 200 },
    confused:     { name: 'Confused',     glyph: '\u{1F635}',       hue: 280 },
    hallucinating: { name: 'Hallucinating', glyph: '\u{1F300}',      hue: 210 },
    weakened:     { name: 'Weakened',  glyph: '\u{1FAB6}',       hue: 40  },
    cursed:       { name: 'Cursed',    glyph: '\u{1F52E}',       hue: 270 },
    blessed:      { name: 'Blessed',   glyph: '\u{1F31F}',       hue: 50  },
    stoneskin:    { name: 'Stoneskin', glyph: '\u{1FAA8}',       hue: 220 },
    taunted:      { name: 'Taunted',   glyph: '\u{1F624}',       hue: 0   },
    mindwiped:    { name: 'Mindwipe',  glyph: '\u{1F9E0}',       hue: 300 },
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

  function update(statuses) {
    const seen = new Set();
    for (const s of (Array.isArray(statuses) ? statuses : [])) {
      const key = String(s.key || '').toLowerCase();
      if (!key) continue;
      const turns = Math.max(0, Number(s.turns || 0));
      const stacks = Math.max(1, Number(s.stacks || 1));
      const spec = VIS[key] || { name: key.replace(/^./, c => c.toUpperCase()), glyph: '\u2728', hue: 210 };
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

// --- Singular Quick Slot (most recent pickup) -----------------------------
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

  /** @type {Array<{id:number, type:string, slot?:string, name:string, count:number}>} */
  const stack = [];
  const MAX_VISIBLE = 4;

  function actionable(it) {
    const t = String(it.type||'');
    if (t === 'equip' || t === 'ammo' || t === 'wand') return true;
    if (t === 'gem' || t === 'tool') return true;
    if (t === 'potion' || t === 'scroll' || t === 'learn' || t === 'book' || t === 'food') return (it.count||0) > 0;
    return false;
  }

  function renderStack() {
    el.innerHTML = '';
    let shown = 0;
    for (const it of stack) {
      if (!actionable(it)) continue;
      const chip = renderQuickChip(it, {
        onUse: () => dispatchAction(it),
        onDismiss: () => dismissTop(it.id)
      });
      el.appendChild(chip);
      shown++;
      if (shown >= MAX_VISIBLE) break;
    }
  }

  function dispatchAction(it) {
    const t = String(it.type||'');
    if (t === 'equip' || t === 'ammo' || t === 'wand') window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
    else window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
  }

  function dismissTop(id) {
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) stack.splice(idx, 1);
    renderStack();
  }

  window.addEventListener('ui:recentPickup', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    if (!item) return;
    const idx = stack.findIndex((x) => x && x.id === item.id);
    if (idx >= 0) stack.splice(idx, 1);
    stack.unshift({ id: Number(item.id||0), type: String(item.type||''), slot: String(item.slot||''), name: String(item.name||'item'), count: Number(item.count||1) });
    renderStack();
  });

  window.addEventListener('ui:itemEquipped', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = Number(e?.detail?.itemId || 0);
    if (!id) return;
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) { stack.splice(idx, 1); renderStack(); }
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
    }
  });

  return { el };
}

/** @param {{id:number,name:string,type:string,count:number}} it @param {{onUse:Function,onDismiss:Function}} h */
function renderQuickChip(it, h) {
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 8px', borderRadius: '6px',
    border: '1px solid #2d3b52', background: '#101626', color: '#cfe8ff'
  });
  const name = document.createElement('div');
  name.textContent = `[${String(it.name||'item')}]`;
  name.style.color = '#9cf';
  const count = document.createElement('div');
  count.dataset.role = 'count';
  count.style.opacity = '0.8';
  count.style.fontSize = '12px';
  if (it.type === 'wand') count.textContent = `${it.count || 1} ch`;
  else count.textContent = (it.type === 'potion' || it.type === 'scroll' || it.type === 'food') ? `x${it.count || 1}` : '';

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
  btn.textContent = (it.type === 'equip' || it.type === 'ammo' || it.type === 'wand') ? 'Equip' : (it.type === 'food' ? 'Eat' : (it.type === 'learn' ? 'Learn' : (it.type === 'gem' ? 'Appraise' : 'Use')));
  btn.addEventListener('click', () => h.onUse && h.onUse());

  const x = document.createElement('button');
  Object.assign(x.style, {
    padding: '6px 8px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer', minWidth: '28px'
  });
  x.textContent = '\u00D7';
  x.title = 'Dismiss';
  x.addEventListener('click', () => h.onDismiss && h.onDismiss());

  chip.appendChild(name);
  chip.appendChild(count);
  chip.appendChild(btn);
  chip.appendChild(x);
  return chip;
}
