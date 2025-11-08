// display/ui/hud.js
// Minimal HUD with an Active Spell button.

export function initHUD() {
  const root = ensureRoot();
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', left: '8px', right: '8px', bottom: '8px',
    display: 'flex', gap: '8px', justifyContent: 'flex-end',
    pointerEvents: 'auto', zIndex: 900
  });

  // Top-right vitals (HP/Mana) bars
  const vitals = document.createElement('div');
  Object.assign(vitals.style, {
    position: 'fixed', right: '8px', top: '8px',
    display: 'flex', flexDirection: 'column', gap: '6px',
    width: 'min(260px, 45vw)', pointerEvents: 'none', zIndex: 900,
    fontFamily: 'monospace'
  });

  /** @param {string} label @param {string} fg @param {string} bg */
  function makeBar(label, fg, bg) {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.flexDirection = 'column'; row.style.gap = '2px';
    const cap = document.createElement('div');
    cap.textContent = label; 
    cap.style.fontSize = '12px'; 
    cap.style.opacity = '0.9'; 
    cap.style.textAlign = 'left';
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'relative', height: '12px', borderRadius: '6px', background: bg, border: '1px solid #2d3b52' });
    const fill = document.createElement('div');
    Object.assign(fill.style, { position: 'absolute', left: 0, top: 0, bottom: 0, width: '0%', background: fg, borderRadius: '6px' });
    const text = document.createElement('div');
    Object.assign(text.style, { position: 'absolute', right: '6px', top: '-18px', fontSize: '11px', color: '#cfe8ff', opacity: '0.9' });
    box.appendChild(fill); box.appendChild(text);
    row.appendChild(cap); row.appendChild(box);
    return { row, box, fill, text };
  }

  const hp = makeBar('HP', 'linear-gradient(90deg,#7bff7b,#3ad13a)', '#0f1421');
  const mp = makeBar('Mana', 'linear-gradient(90deg,#55aaff,#2d7dd2)', '#0f1421');
  vitals.appendChild(hp.row); vitals.appendChild(mp.row);

  // Combat HUD: weapon, defense, status chips
  const combatBox = document.createElement('div');
  Object.assign(combatBox.style, {
    display: 'flex', flexDirection: 'column', gap: '4px',
    marginTop: '6px', padding: '6px 8px', borderRadius: '6px',
    background: 'rgba(10,14,22,0.55)', border: '1px solid #2d3b52',
    pointerEvents: 'none'
  });
  const weaponLine = document.createElement('div');
  weaponLine.style.fontSize = '12px'; weaponLine.style.color = '#cfe8ff';
  const defenseLine = document.createElement('div');
  defenseLine.style.fontSize = '12px'; defenseLine.style.color = '#cfe8ff';
  const statusRow = document.createElement('div');
  Object.assign(statusRow.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  const affixRow = document.createElement('div');
  Object.assign(affixRow.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  combatBox.appendChild(weaponLine); 
  combatBox.appendChild(defenseLine); 
  combatBox.appendChild(statusRow);
  combatBox.appendChild(affixRow);
  vitals.appendChild(combatBox);
  root.appendChild(vitals);

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
    try { window.dispatchEvent(new CustomEvent('ui:toggleInventory')); } catch {}
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
    try { window.dispatchEvent(new CustomEvent('ui:shootRanged')); } catch {}
  });

  // Update label when app sets active spell
  window.addEventListener('ui:updateActiveSpellLabel', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const name = String(e?.detail?.name || '').trim();
    const cost = Number(e?.detail?.cost || 0);
    const canCast = Boolean(e?.detail?.canCast ?? true);
    castBtn.textContent = name ? (cost ? `Cast [${name}] (${cost})` : `Cast [${name}]`) : 'Cast';
    castBtn.disabled = !canCast;
    castBtn.style.opacity = canCast ? '1' : '0.6';
    castBtn.style.cursor = canCast ? 'pointer' : 'not-allowed';
  });

  // Update vitals bars
  window.addEventListener('ui:updateVitals', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const hpVal = Number(e?.detail?.hp ?? 0), hpMax = Math.max(1, Number(e?.detail?.maxHp ?? 1));
    const mpVal = Number(e?.detail?.mana ?? 0), mpMax = Math.max(1, Number(e?.detail?.maxMana ?? 1));
    const hpf = Math.max(0, Math.min(1, hpVal / hpMax));
    const mpf = Math.max(0, Math.min(1, mpVal / mpMax));
    hp.fill.style.width = `${(hpf * 100).toFixed(1)}%`;
    mp.fill.style.width = `${(mpf * 100).toFixed(1)}%`;
    hp.text.textContent = `${hpVal}/${hpMax}`;
    mp.text.textContent = `${mpVal}/${mpMax}`;
  });

  // Update combat HUD details
  window.addEventListener('ui:updateCombatHUD', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const weapon = e?.detail?.weapon || null;
    const defense = Number(e?.detail?.defense ?? 0);
  const statuses = Array.isArray(e?.detail?.statuses) ? e.detail.statuses : [];
  const affixes = Array.isArray(e?.detail?.affixes) ? e.detail.affixes : [];

    // Weapon line
    if (weapon && weapon.name) {
      const dd = weapon.damageDice ? `, ${weapon.damageDice}` : '';
      const atk = Number(weapon.attack||0);
      const atkTxt = Number.isFinite(atk) && atk !== 0 ? (atk > 0 ? `+${atk}` : `${atk}`) : '0';
      weaponLine.textContent = `Weapon: [${String(weapon.name)}] (Atk ${atkTxt}${dd ? `, ${dd}` : ''})`;
    } else {
      weaponLine.textContent = `Weapon: (none)`;
    }
    // Defense line
    const defTxt = Number.isFinite(defense) && defense !== 0 ? (defense > 0 ? `+${defense}` : `${defense}`) : '0';
    defenseLine.textContent = `Defense: ${defTxt}`;

    // Status chips
    statusRow.innerHTML = '';
    for (const s of statuses) {
      const chip = document.createElement('div');
      chip.textContent = `${String(s.key)}` + (Number.isFinite(s.turns) && s.turns > 0 ? ` (${s.turns})` : '');
      Object.assign(chip.style, {
        fontSize: '11px', padding: '2px 6px', borderRadius: '999px',
        background: 'rgba(85,170,255,0.15)', color: '#cfe8ff', border: '1px solid #2d3b52'
      });
      if (String(s.key).toLowerCase() === 'invulnerable') {
        chip.style.background = 'rgba(160,255,255,0.15)';
        chip.style.color = '#e8ffff';
      }
      statusRow.appendChild(chip);
    }

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

  // Right-aligned bar: Inventory appears left of Cast by append order
  // Quick slot sits to the left of Inventory
  const quick = createQuickSlot();
  bar.appendChild(quick.el);
  bar.appendChild(invBtn);
  bar.appendChild(castBtn);
  bar.appendChild(shootBtn);
  root.appendChild(bar);
  return { castBtn, invBtn, shootBtn };
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
    display: 'flex', alignItems: 'center', gap: '8px'
  });

  /** @type {Array<{id:number, type:string, slot?:string, name:string, count:number}>} */
  const stack = [];
  /** @type {HTMLDivElement|null} */
  let chip = null;

  function actionable(it) {
    const t = String(it.type||'');
    if (t === 'potion' || t === 'scroll' || t === 'learn' || t === 'book') return (it.count||0) > 0;
    if (t === 'equip') return true; // show until equipped
    return false;
  }

  function renderTop() {
    // Clean up existing
    if (chip) { try { chip.remove(); } catch {}; chip = null; }
    // Find first actionable entry from front
    let top = null;
    for (const it of stack) { if (actionable(it)) { top = it; break; } }
    if (!top) return;
    chip = renderQuickChip(top, {
      onUse: () => dispatchAction(top),
      onDismiss: () => dismissTop(top.id)
    });
    el.appendChild(chip);
  }

  function dispatchAction(it) {
    const t = String(it.type||'');
    if (t === 'potion') window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    else if (t === 'scroll' || t === 'learn' || t === 'book') window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
    else if (t === 'equip') window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
    else window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
  }

  function dismissTop(id) {
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) stack.splice(idx, 1);
    renderTop();
  }

  // Events
  window.addEventListener('ui:recentPickup', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const item = e?.detail?.item;
    if (!item) return;
    // Insert at front, de-dup
    const idx = stack.findIndex((x) => x && x.id === item.id);
    if (idx >= 0) stack.splice(idx, 1);
    stack.unshift({ id: Number(item.id||0), type: String(item.type||''), slot: String(item.slot||''), name: String(item.name||'item'), count: Number(item.count||1) });
    renderTop();
  });

  window.addEventListener('ui:itemEquipped', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = Number(e?.detail?.itemId || 0);
    if (!id) return;
    const idx = stack.findIndex((x) => x && x.id === id);
    if (idx >= 0) { stack.splice(idx, 1); renderTop(); }
  });

  window.addEventListener('ui:itemUsed', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const id = Number(e?.detail?.itemId || 0);
    const removed = !!e?.detail?.removed;
    const count = Number(e?.detail?.count || 0);
    if (!id) return;
    const it = stack.find((x) => x && x.id === id) || null;
    if (!it) return;
    if (removed || count <= 0) {
      // Pop this and show next
      const idx = stack.findIndex((x) => x && x.id === id);
      if (idx >= 0) stack.splice(idx, 1);
      renderTop();
    } else {
      it.count = count;
      // Update count in UI
      if (chip) {
        const cnt = chip.querySelector('[data-role="count"]');
        if (cnt) cnt.textContent = `x${count}`;
      }
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
  count.textContent = (it.type === 'potion' || it.type === 'scroll') ? `x${it.count||1}` : '';

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
  btn.textContent = (it.type === 'equip') ? 'Equip' : (it.type === 'potion' ? 'Drink' : 'Read');
  btn.addEventListener('click', () => h.onUse && h.onUse());

  const x = document.createElement('button');
  Object.assign(x.style, {
    padding: '6px 8px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer', minWidth: '28px'
  });
  x.textContent = '×';
  x.title = 'Dismiss';
  x.addEventListener('click', () => h.onDismiss && h.onDismiss());

  chip.appendChild(name);
  chip.appendChild(count);
  chip.appendChild(btn);
  chip.appendChild(x);
  return chip;
}
