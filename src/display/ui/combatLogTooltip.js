// src/display/ui/combatLogTooltip.js
// Tooltip controller for rich combat log entries.
// Delegates pointer events on [data-entity-id] and [data-spell-id] elements
// inside the message ticker to show a floating tooltip with entity/spell info.

const TIP_Z = 1100;

/**
 * @param {HTMLElement} tickerEl - The message ticker container element
 * @param {{ world: any, getMonster: Function, getSpell: Function, components: Object }} deps
 */
export function installCombatLogTooltip(tickerEl, deps) {
  const { world, getMonster, getSpell, components } = deps;
  const { NamedIdentity, ItemInfo, Vitality, Equipment } = components;

  // ── Create tooltip element ──
  const tip = document.createElement('div');
  Object.assign(tip.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'auto',
    zIndex: String(TIP_Z),
    background: 'rgba(8,12,20,0.96)',
    border: '1px solid rgba(80,120,170,0.7)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#cfe8ff',
    maxWidth: 'min(360px, 85vw)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  });
  document.body.appendChild(tip);

  // Inject a style rule so tooltip-target elements look interactive
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

  // ── Rarity colors ──
  const rarityColors = {
    common: '#ddd', uncommon: '#1eff00', rare: '#55aaff',
    magic: '#55aaff', epic: '#c47bff', legendary: '#ff9f3b',
  };

  // ── Build tooltip content ──
  function buildItemTip(entityId) {
    const ni = world.get(entityId, NamedIdentity);
    const info = world.get(entityId, ItemInfo);
    if (!ni || !info) return null;

    const name = ni.name || ni.identity || 'Item';
    const rn = String(info.rarityName || 'common').toLowerCase();
    const color = rarityColors[rn] || '#ddd';
    const lines = [];
    lines.push(`<div style="color:${color};font-weight:bold;font-size:13px">${name}</div>`);
    if (rn !== 'common') lines.push(`<div style="color:${color};font-size:11px;text-transform:capitalize">${rn}</div>`);

    if (info.slot) lines.push(`<div style="color:#888;margin-top:4px">${info.slot}${info.twoHanded ? ' (two-handed)' : ''}</div>`);

    const bonuses = info.bonuses || {};
    const statLines = [];
    if (bonuses.attack) statLines.push(`+${bonuses.attack} Attack`);
    if (bonuses.defense) statLines.push(`+${bonuses.defense} Defense`);
    if (bonuses.maxHp) statLines.push(`+${bonuses.maxHp} Max HP`);
    if (bonuses.maxMana) statLines.push(`+${bonuses.maxMana} Max Mana`);
    if (bonuses.maxStamina) statLines.push(`+${bonuses.maxStamina} Max Stamina`);
    if (bonuses.critChance) statLines.push(`+${Math.round(bonuses.critChance * 100)}% Crit`);
    if (bonuses.critMult) statLines.push(`+${Math.round((bonuses.critMult - 1) * 100)}% Crit Damage`);
    if (statLines.length) lines.push(`<div style="color:#aaccee;margin-top:4px">${statLines.join('<br>')}</div>`);

    if (info.damageType) lines.push(`<div style="color:#999;margin-top:2px">Damage: ${info.damageType}</div>`);

    if (info.description) {
      lines.push(`<div style="color:#8899aa;margin-top:6px;font-style:italic;font-size:11px">"${info.description}"</div>`);
    }

    return lines.join('');
  }

  function buildMonsterTip(entityId) {
    const ni = world.get(entityId, NamedIdentity);
    if (!ni) return null;
    const name = ni.name || ni.identity || 'Creature';
    const identity = String(ni.identity || '');

    const monsterDef = getMonster(identity);
    const vit = Vitality ? world.get(entityId, Vitality) : null;

    const lines = [];
    const isRare = monsterDef?.rare;
    const nameColor = isRare ? '#ff9f3b' : '#cfe8ff';
    lines.push(`<div style="color:${nameColor};font-weight:bold;font-size:13px">${name}</div>`);

    if (vit) {
      const pct = vit.maxHp > 0 ? Math.round((vit.hp / vit.maxHp) * 100) : 0;
      const hpColor = pct > 60 ? '#77dd77' : pct > 25 ? '#ffd966' : '#ff6b6b';
      lines.push(`<div style="color:${hpColor};margin-top:2px">HP: ${vit.hp}/${vit.maxHp} (${pct}%)</div>`);
    }

    if (monsterDef) {
      if (monsterDef.specials && monsterDef.specials.length) {
        lines.push(`<div style="color:#aaccee;margin-top:4px">${monsterDef.specials.join(', ')}</div>`);
      }
      if (monsterDef.description) {
        lines.push(`<div style="color:#8899aa;margin-top:6px;font-style:italic;font-size:11px">"${monsterDef.description}"</div>`);
      }
    }

    return lines.join('');
  }

  function buildEntityTip(entityId) {
    // Try item first, then monster
    const info = ItemInfo ? world.get(entityId, ItemInfo) : null;
    if (info) return buildItemTip(entityId);
    return buildMonsterTip(entityId);
  }

  function buildSpellTip(spellId) {
    const spell = getSpell(String(spellId || ''));
    if (!spell) return null;
    const lines = [];
    lines.push(`<div style="color:#79c0ff;font-weight:bold;font-size:13px">${spell.name || spellId}</div>`);

    const meta = [];
    if (spell.manaCost) meta.push(`${spell.manaCost} mana`);
    if (spell.staminaCost) meta.push(`${spell.staminaCost} stamina`);
    if (spell.range) meta.push(`range ${spell.range}`);
    if (spell.cooldown) meta.push(`${spell.cooldown}t cooldown`);
    if (meta.length) lines.push(`<div style="color:#aaccee;margin-top:2px">${meta.join(' \u00b7 ')}</div>`);

    if (spell.schools?.length) {
      lines.push(`<div style="color:#888;margin-top:2px">${spell.schools.join(', ')}</div>`);
    }

    if (spell.description) {
      lines.push(`<div style="color:#8899aa;margin-top:6px;font-style:italic;font-size:11px">"${spell.description}"</div>`);
    }

    return lines.join('');
  }

  // ── Position tooltip near the trigger element ──
  function positionTip(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    // Place below the text by default
    let top = rect.bottom + 6;
    let left = rect.left;

    // If it would overflow bottom, place above
    const tipH = tip.offsetHeight || 120;
    if (top + tipH > window.innerHeight - 10) {
      top = rect.top - tipH - 6;
    }
    // Clamp horizontal
    const tipW = tip.offsetWidth || 300;
    if (left + tipW > window.innerWidth - 10) {
      left = window.innerWidth - tipW - 10;
    }
    if (left < 4) left = 4;

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }

  // ── Event delegation ──
  let activeTarget = null;
  let showTimer = 0;

  function show(el) {
    const entityId = Number(el.dataset.entityId || 0);
    const spellId = el.dataset.spellId || '';
    const tipType = el.dataset.tip || '';

    let html = null;
    if (spellId) html = buildSpellTip(spellId);
    else if (entityId > 0 && world.isAlive(entityId)) {
      if (tipType === 'item') html = buildItemTip(entityId);
      else if (tipType === 'monster') html = buildMonsterTip(entityId);
      else html = buildEntityTip(entityId);
    }

    if (!html) { hide(); return; }
    tip.innerHTML = html;
    tip.style.display = 'block';
    positionTip(el);
  }

  function hide() {
    tip.style.display = 'none';
    tip.innerHTML = '';
    activeTarget = null;
    clearTimeout(showTimer);
  }

  const SELECTOR = '[data-entity-id],[data-spell-id]';

  // Hover: use pointerover/pointerout (they bubble, unlike pointerenter/pointerleave)
  tickerEl.addEventListener('pointerover', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target)?.closest?.(SELECTOR);
    if (!el) return;
    if (el === activeTarget) return;
    activeTarget = el;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(el), 100);
  });

  tickerEl.addEventListener('pointerout', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target)?.closest?.(SELECTOR);
    if (!el) return;
    // Only hide if we're leaving the active target and not entering another tip target
    const related = /** @type {HTMLElement} */ (ev.relatedTarget)?.closest?.(SELECTOR);
    if (related === activeTarget) return;
    hide();
  });

  // Click/tap: toggle tooltip on rich elements, block expand/collapse
  tickerEl.addEventListener('click', (ev) => {
    const el = /** @type {HTMLElement} */ (ev.target)?.closest?.(SELECTOR);
    if (el) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (el === activeTarget && tip.style.display === 'block') {
        hide();
      } else {
        activeTarget = el;
        clearTimeout(showTimer);
        show(el);
      }
      return;
    }
    // Non-tooltip click — hide any open tooltip (expand/collapse will handle itself)
    hide();
  }, true);

  // Hide on scroll/resize or touch outside
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide, { passive: true });
  // Tap tooltip itself to dismiss
  tip.addEventListener('click', (ev) => {
    ev.stopPropagation();
    hide();
  });

  // Tap outside tooltip + ticker to dismiss
  document.addEventListener('pointerdown', (ev) => {
    if (!tip.contains(/** @type {Node} */ (ev.target)) && !tickerEl.contains(/** @type {Node} */ (ev.target))) {
      hide();
    }
  }, { passive: true });
}
