// src/display/ui/wiring/eventUiWiring.js
// Event-driven UI wiring: engrave, item:used, spell:learned,
// interaction (chest), harvest:picked.

const _installed = Symbol.for('jshack:display:eventUiWiring:installed');

/**
 * Install event-driven UI wiring listeners.
 * @param {{
 *   world: import('../../../lib/ecs-js/index.js').World,
 *   ftext: { addStatus: Function },
 *   getActiveSpellId: () => string|null,
 *   setActiveSpell: (id: string) => void,
 *   getPlayerEntity: () => ({ id:number, pos:{x:number,y:number} } | null),
 *   getPosition: (id:number) => ({ x:number, y:number } | null),
 *   getItemInfo: (id:number) => any,
 *   resolveItemDisplayName: (id:number) => string,
 *   dispatchRulesAction: (action:any) => void,
 * }} deps
 */
export function installEventUiWiring({
  world,
  ftext,
  getActiveSpellId,
  setActiveSpell,
  getPlayerEntity,
  getPosition,
  getItemInfo,
  resolveItemDisplayName,
  dispatchRulesAction,
}) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;

  // Engrave floating text (messages handled in messageWiring)
  world.on('engrave', ({ text, x, y, profane }) => {
    const color = profane ? '#ff6655' : '#8899aa';
    try { ftext.addStatus(x, y - 0.3, `"${text}"`, { color, life: 1.2 }); } catch (e) { console.debug('[eventUiWiring] ftext failed:', e); }
  });

  // Refresh inventory UI when any item is used (consumed/learned/etc.).
  // ui:itemUsed is emitted centrally from main.js with pin metadata;
  // avoid dispatching it here to prevent double-consumption in quick slots.
  world.on('item:used', ({ actor, itemId }) => {
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestInventoryData:', e); }
  });

  // Spell learning logic (messages handled in messageWiring)
  world.on('spell:learned', ({ spellId }) => {
    if (!getActiveSpellId()) {
      setActiveSpell(String(spellId));
    }
    const learnedId = String(spellId || '');
    if (learnedId === 'lightning') {
      try {
        window.dispatchEvent(new CustomEvent('ui:showSpellGestureHint', {
          detail: { id: learnedId, mode: 'learn', quality: 1 },
        }));
      } catch (e) { console.debug('[eventUiWiring] dispatch ui:showSpellGestureHint:', e); }
    }
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestInventoryData:', e); }
  });

  // Interaction UI logic (messages handled in messageWiring)
  world.on('interaction', ({ action, items: droppedIds }) => {
    if (action === 'openChest') {
      const nonCurrency = [];
      if (Array.isArray(droppedIds)) {
        for (const eid of droppedIds) {
          const info = getItemInfo(Number(eid || 0));
          if (!info) continue;
          if (info.type === 'currency') {
            dispatchRulesAction({ type: 'rules.pickupItem', payload: { itemId: eid } });
          } else {
            nonCurrency.push({
              id: eid,
              type: info.type || 'item',
              name: resolveItemDisplayName(eid),
              count: info.count || 1,
              rarityName: info.rarityName || 'common',
              bonuses: info.bonuses || {},
              affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
            });
          }
        }
      }
      if (nonCurrency.length === 1) {
        const it = nonCurrency[0];
        try {
          window.dispatchEvent(new CustomEvent('ui:showGroundItem', {
            detail: { mode: 'single', item: it, pickupRange: 2 }
          }));
        } catch (e) { console.debug('[eventUiWiring] dispatch ui:showGroundItem:', e); }
      } else if (nonCurrency.length > 1) {
        try {
          window.dispatchEvent(new CustomEvent('ui:openPickupChooser', { detail: { items: nonCurrency } }));
        } catch (e) { console.debug('[eventUiWiring] dispatch ui:openPickupChooser:', e); }
      }
    }
  });

  // Altar offering: present the player's inventory so they can choose an item to offer.
  world.on('altar:offerPrompt', ({ actor, targetId, items }) => {
    const pe = getPlayerEntity();
    if (!pe || pe.id !== actor) return;
    if (!Array.isArray(items)) return;
    const offerableItems = [];
    for (const iid of items) {
      const info = getItemInfo(Number(iid || 0));
      if (!info) continue;
      offerableItems.push({
        id: iid,
        type: info.type || 'item',
        name: resolveItemDisplayName(Number(iid || 0)),
        count: info.count || 1,
        rarityName: info.rarityName || 'common',
        value: info.value || 0,
      });
    }
    try {
      window.dispatchEvent(new CustomEvent('ui:altarOfferPrompt', {
        detail: { altarId: targetId, items: offerableItems },
      }));
    } catch (e) { console.debug('[eventUiWiring] dispatch ui:altarOfferPrompt:', e); }
  });

  // Harvest updates: refresh inventory UI after gather actions.
  // Deferred so the tick's command queue (component adds) flushes first.
  world.on('harvest:picked', ({ actor, count, kind }) => {
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestInventoryData:', e); }
      try { window.dispatchEvent(new CustomEvent('ui:requestUsableItemsData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestUsableItemsData:', e); }
    }, 0);
    const pe = getPlayerEntity();
    if (!pe || pe.id !== actor) return;
    const qty = Math.max(1, Number(count || 1) | 0);
    const k = String(kind || '').toLowerCase();
    const LABELS = /** @type {Record<string,{one:string,many:string,color:string}>} */ ({
      berries:       { one: 'berry',        many: 'berries',      color: '#b6e38d' },
      herbs:         { one: 'herb',         many: 'herbs',        color: '#b6e38d' },
      thorn_bramble: { one: 'thorn pod',    many: 'thorn pods',   color: '#b6e38d' },
      venom_fern:    { one: 'venom frond',  many: 'venom fronds', color: '#b6e38d' },
      mushrooms:     { one: 'mushroom',     many: 'mushrooms',    color: '#b6e38d' },
      iron_ore:      { one: 'iron ore',     many: 'iron ore',     color: '#c07850' },
      coal_ore:      { one: 'coal',         many: 'coal',         color: '#909090' },
      stone:         { one: 'stone chip',   many: 'stone chips',  color: '#a0a8b0' },
    });
    const entry = LABELS[k] ?? { one: k, many: k, color: '#b6e38d' };
    const label = qty === 1 ? entry.one : entry.many;
    try { ftext.addStatus(pe.pos.x, pe.pos.y - 0.3, `+${qty} ${label}`, { color: entry.color, life: 1.0 }); } catch (e) { console.debug('[eventUiWiring] ftext failed:', e); }
  });
}
