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
  const ammoLine = document.createElement('div');
  ammoLine.style.fontSize = '12px'; ammoLine.style.color = '#cfe8ff'; ammoLine.style.display = 'none';
  const statusRow = document.createElement('div');
  Object.assign(statusRow.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'flex-start' });
  const affixRow = document.createElement('div');
  Object.assign(affixRow.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  combatBox.appendChild(weaponLine);
  combatBox.appendChild(defenseLine);
  combatBox.appendChild(ammoLine);
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

    // Ammo line (only visible when carrying arrows)
    const ammoCount = Number(e?.detail?.ammo ?? 0);
    if (ammoCount > 0) {
      ammoLine.textContent = `Ammo: ${ammoCount}`;
      ammoLine.style.display = '';
    } else {
      ammoLine.style.display = 'none';
    }

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

  // Right-aligned bar: Inventory appears left of Cast by append order
  const quick = createQuickSlot();
  bar.appendChild(invBtn);
  bar.appendChild(castBtn);
  bar.appendChild(shootBtn);
  root.appendChild(bar);
  root.appendChild(quick.el);
  return { castBtn, invBtn, shootBtn };
}

// --- Effects Stack (status badges with pie timers) -------------------------
function ensureEffectsStack(container) {
  if (container.__effectsStack) return container.__effectsStack;

  /** @type {Map<string, { el: HTMLDivElement, total: number, overlay: HTMLDivElement, ticksEl: HTMLDivElement, stacksEl: HTMLDivElement }>} */
  const byKey = new Map();

  const _VIS = {
    invulnerable: { name: 'Aegis', glyph: '\u{1F6E1}\uFE0F', hue: 190 },
    burning:      { name: 'Burning', glyph: '\u{1F525}', hue: 20 },
    poisoned:     { name: 'Poison', glyph: '\u2620\uFE0F', hue: 120 },
    regenerating: { name: 'Regen', glyph: '\u{1F49A}', hue: 140 },
    stunned:      { name: 'Stunned', glyph: '\u{1F4AB}', hue: 45 },
    thorns:       { name: 'Thorns', glyph: '\u{1F339}', hue: 110 },
    diseased:     { name: 'Disease', glyph: '\u{1F9A0}', hue: 55 },
    bleeding:     { name: 'Bleed', glyph: '\u{1FA78}', hue: 350 },
  };
  // Aliases: raw ActiveEffects keys → same VIS entry
  _VIS.invuln = _VIS.invulnerable;
  _VIS.burn   = _VIS.burning;
  _VIS.poison = _VIS.poisoned;
  _VIS.regen  = _VIS.regenerating;
  _VIS.regeneration = _VIS.regenerating;
  _VIS.stun   = _VIS.stunned;
  _VIS.disease = _VIS.diseased;
  _VIS.bleed  = _VIS.bleeding;
  const VIS = _VIS;

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
    rec.ticksEl.textContent = String(Math.max(0, remaining | 0));
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
      rec.stacksEl.textContent = `x${stacks}`;
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
    bottom: '56px',
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
    if (t === 'potion' || t === 'scroll' || t === 'learn' || t === 'book') return (it.count||0) > 0;
    if (t === 'equip' || t === 'ammo') return true;
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
    if (t === 'potion') window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId: it.id } }));
    else if (t === 'scroll' || t === 'learn' || t === 'book') window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId: it.id } }));
    else if (t === 'equip' || t === 'ammo') window.dispatchEvent(new CustomEvent('ui:requestEquip', { detail: { itemId: it.id } }));
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
  count.textContent = (it.type === 'potion' || it.type === 'scroll') ? `x${it.count||1}` : '';

  const btn = document.createElement('button');
  Object.assign(btn.style, {
    padding: '6px 10px', background: '#101626', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px', cursor: 'pointer'
  });
  btn.textContent = (it.type === 'equip' || it.type === 'ammo') ? 'Equip' : (it.type === 'potion' ? 'Drink' : (it.type === 'learn' ? 'Learn' : 'Read'));
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
