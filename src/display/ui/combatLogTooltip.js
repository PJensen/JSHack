// src/display/ui/combatLogTooltip.js
// Tooltip controller for rich combat log entries.
// Delegates pointer events on [data-entity-id] and [data-spell-id] elements
// inside the message ticker to show entity/spell tooltips.
//
// Items use the existing renderItemDetails (shared WoW/Diablo-style tooltip).
// Spells and monsters use a lightweight custom tooltip (no shared equivalent exists).

import { renderItemDetails, getItemTooltip, positionTooltip } from './overlayUtils.js';

/**
 * @param {HTMLElement} tickerEl - The message ticker container element
 * @param {{ world: any, getMonster: Function, getSpell: Function, resolveItemDisplayObject: Function, components: Object }} deps
 */
export function installCombatLogTooltip(tickerEl, deps) {
  const { world, getMonster, getSpell, resolveItemDisplayObject, components } = deps;
  const { NamedIdentity, ItemInfo, Vitality } = components;

  // ── Custom tip for spells/monsters (no shared equivalent) ──
  const customTip = document.createElement('div');
  Object.assign(customTip.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'auto',
    zIndex: '1400',
    background: 'rgba(14,18,26,0.96)',
    border: '1px solid #33435f',
    borderRadius: '10px',
    padding: '10px 12px',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#dbeaff',
    maxWidth: '280px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  });
  document.body.appendChild(customTip);

  // ── Interactive style for tappable elements ──
  const style = document.createElement('style');
  style.textContent = `
    [data-entity-id], [data-spell-id] {
      cursor: pointer;
      text-decoration-line: underline;
      text-decoration-style: dotted;
      text-underline-offset: 2px;
      text-decoration-thickness: 1px;
    }
    [data-entity-id]:hover, [data-spell-id]:hover {
      text-decoration-style: solid;
      filter: brightness(1.25);
    }
  `;
  document.head.appendChild(style);

  // ── Spell tooltip ──
  function showSpellTip(spellId, anchorEl) {
    const spell = getSpell(String(spellId || ''));
    if (!spell) return false;
    const lines = [];
    lines.push(`<div style="color:#79c0ff;font-weight:bold;font-size:14px">${spell.name || spellId}</div>`);
    const meta = [];
    if (spell.manaCost) meta.push(`${spell.manaCost} mana`);
    if (spell.staminaCost) meta.push(`${spell.staminaCost} stamina`);
    if (spell.range) meta.push(`range ${spell.range}`);
    if (spell.cooldown) meta.push(`${spell.cooldown}t cd`);
    if (meta.length) lines.push(`<div style="color:#aaccee;margin-top:2px">${meta.join(' \u00b7 ')}</div>`);
    if (spell.schools?.length) lines.push(`<div style="color:#888;margin-top:2px">${spell.schools.join(', ')}</div>`);
    if (spell.description) lines.push(`<div style="color:#8899aa;margin-top:6px;font-style:italic;font-size:11px">"${spell.description}"</div>`);
    customTip.innerHTML = lines.join('');
    customTip.style.display = 'block';
    positionTooltip(customTip, anchorEl);
    return true;
  }

  // ── Monster tooltip ──
  function showMonsterTip(entityId, anchorEl) {
    const ni = world.get(entityId, NamedIdentity);
    const name = ni?.name || ni?.identity || String(anchorEl?.textContent || 'Creature').replace(/[\[\]]/g, '').trim() || 'Creature';
    const identity = String(ni?.identity || '');
    const monsterDef = getMonster(identity);
    const vit = Vitality ? world.get(entityId, Vitality) : null;
    const lines = [];
    const isRare = monsterDef?.rare;
    const nameColor = isRare ? '#ff9f3b' : '#dbeaff';
    lines.push(`<div style="color:${nameColor};font-weight:bold;font-size:14px">${name}</div>`);
    if (vit) {
      const pct = vit.maxHp > 0 ? Math.round((vit.hp / vit.maxHp) * 100) : 0;
      const hpColor = pct > 60 ? '#77dd77' : pct > 25 ? '#ffd966' : '#ff6b6b';
      lines.push(`<div style="color:${hpColor};margin-top:2px">HP: ${vit.hp}/${vit.maxHp} (${pct}%)</div>`);
    }
    if (monsterDef?.specials?.length) {
      lines.push(`<div style="color:#aaccee;margin-top:4px">${monsterDef.specials.join(', ')}</div>`);
    }
    if (monsterDef?.description) {
      lines.push(`<div style="color:#8899aa;margin-top:6px;font-style:italic;font-size:11px">"${monsterDef.description}"</div>`);
    }
    customTip.innerHTML = lines.join('');
    customTip.style.display = 'block';
    positionTooltip(customTip, anchorEl);
    return true;
  }

  function useItemFromTooltip(itemObj) {
    const itemId = Number(itemObj?.id || 0) | 0;
    if (!(itemId > 0)) return;
    const type = String(itemObj?.type || '').toLowerCase();
    if (type === 'potion') {
      window.dispatchEvent(new CustomEvent('ui:requestDrink', { detail: { itemId } }));
    } else {
      window.dispatchEvent(new CustomEvent('ui:requestUse', { detail: { itemId } }));
    }
  }

  // ── Item tooltip — delegates to existing renderItemDetails ──
  function showItemTip(entityId, anchorEl) {
    const tip = getItemTooltip();
    if (!tip) return false;
    // Build the item display object the same way inventory/pinned slots do
    const obj = typeof resolveItemDisplayObject === 'function'
      ? resolveItemDisplayObject(world, entityId)
      : null;
    if (!obj) {
      const label = String(anchorEl?.textContent || '').trim() || 'Item';
      customTip.innerHTML = `<div style="color:#dbeaff;font-weight:bold;font-size:14px">${label}</div><div style="color:#8899aa;margin-top:4px">Details unavailable.</div>`;
      customTip.style.display = 'block';
      positionTooltip(customTip, anchorEl);
      return true;
    }
    renderItemDetails(tip, obj, {
      onNameTap: () => {
        useItemFromTooltip(obj);
        hideAll();
      },
    });
    tip.style.display = 'block';
    tip.style.maxWidth = '280px';
    tip.style.pointerEvents = 'auto';
    positionTooltip(tip, anchorEl);
    return true;
  }

  // ── Resolve what kind of entity this is ──
  function showTipFor(el) {
    const spellId = el.dataset.spellId || '';
    if (spellId) return showSpellTip(spellId, el);

    const entityId = Number(el.dataset.entityId || 0);
    if (!(entityId > 0)) return false;

    const tipType = el.dataset.tip || '';
    if (tipType === 'item') return showItemTip(entityId, el);
    if (tipType === 'monster') return showMonsterTip(entityId, el);

    // Auto-detect: has ItemInfo → item, otherwise monster
    const info = ItemInfo ? world.get(entityId, ItemInfo) : null;
    return info ? showItemTip(entityId, el) : showMonsterTip(entityId, el);
  }

  function hideAll() {
    customTip.style.display = 'none';
    customTip.innerHTML = '';
    const itemTip = getItemTooltip();
    if (itemTip) {
      itemTip.style.display = 'none';
      itemTip.style.pointerEvents = 'none';
    }
    activeTarget = null;
    clearTimeout(showTimer);
  }

  // ── Event delegation ──
  let activeTarget = null;
  let showTimer = 0;
  const SELECTOR = '[data-entity-id],[data-spell-id]';

  function _find(ev) {
    const el = /** @type {HTMLElement|null} */ (ev.target);
    if (!el) return null;
    const match = el.closest?.(SELECTOR);
    return (match && tickerEl.contains(match)) ? /** @type {HTMLElement} */ (match) : null;
  }

  // Desktop hover
  tickerEl.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'touch') return;
    const el = _find(ev);
    if (!el || el === activeTarget) return;
    activeTarget = el;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => showTipFor(el), 100);
  });
  tickerEl.addEventListener('pointerout', (ev) => {
    if (ev.pointerType === 'touch') return;
    const to = ev.relatedTarget ? /** @type {HTMLElement} */ (ev.relatedTarget).closest?.(SELECTOR) : null;
    if (to === activeTarget) return;
    hideAll();
  });

  // Touch + click
  tickerEl.addEventListener('pointerup', (ev) => {
    const el = _find(ev);
    if (!el) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (el === activeTarget && (customTip.style.display === 'block' || getItemTooltip()?.style.display === 'block')) {
      hideAll(); return;
    }
    hideAll();
    activeTarget = el;
    showTipFor(el);
  }, true);

  tickerEl.addEventListener('click', (ev) => {
    if (_find(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); return; }
    hideAll();
  }, true);

  customTip.addEventListener('pointerup', (ev) => { ev.stopPropagation(); hideAll(); });

  document.addEventListener('pointerdown', (ev) => {
    const t = /** @type {Node} */ (ev.target);
    if (!customTip.contains(t) && !tickerEl.contains(t)) {
      const itemTip = getItemTooltip();
      if (!itemTip || !itemTip.contains(t)) hideAll();
    }
  }, { passive: true });
  window.addEventListener('scroll', hideAll, { passive: true });
  window.addEventListener('resize', hideAll, { passive: true });
}
