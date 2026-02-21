// src/main/wiring/eventUiWiring.js
// Event-driven UI wiring: engrave, item:used, spell:learned,
// interaction (chest), harvest:picked.

import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { resolveItemDisplayName } from "./itemName.js";
import { makeRulesDispatcher } from "../input/rulesDispatch.js";

const _installed = Symbol.for('jshack:main:eventUiWiring:installed');

/**
 * Install event-driven UI wiring listeners.
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   ftext: { addStatus: Function },
 *   getActiveSpellId: () => string|null,
 *   setActiveSpell: (id: string) => void,
 * }} deps
 */
export function installEventUiWiring({ world, ftext, getActiveSpellId, setActiveSpell }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;

  // Engrave floating text (messages handled in messageWiring)
  world.on('engrave', ({ text, x, y }) => {
    try { ftext.addStatus(x, y - 0.3, `"${text}"`, { color: '#8899aa', life: 1.2 }); } catch (e) { console.debug('[eventUiWiring] ftext failed:', e); }
  });

  // Refresh inventory UI when any item is used (consumed/learned/etc.)
  world.on('item:used', ({ actor, itemId }) => {
    try { window.dispatchEvent(new CustomEvent('ui:itemUsed', { detail: { itemId } })); } catch (e) { console.debug('[eventUiWiring] dispatch ui:itemUsed:', e); }
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestInventoryData:', e); }
  });

  // Spell learning logic (messages handled in messageWiring)
  world.on('spell:learned', ({ spellId }) => {
    if (!getActiveSpellId()) {
      setActiveSpell(String(spellId));
    }
    const learnedId = String(spellId || '');
    if (learnedId === 'lightning' || learnedId === 'meteor' || learnedId === 'blastwave') {
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
          const info = world.get(eid, ItemInfo);
          if (!info) continue;
          if (info.type === 'currency') {
            const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
            rulesHandler({ type: 'rules.pickupItem', payload: { itemId: eid } });
          } else {
            nonCurrency.push({
              id: eid,
              type: info.type || 'item',
              name: resolveItemDisplayName(world, eid),
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

  // Harvest updates: refresh inventory UI after gather actions.
  // Deferred so the tick's command queue (component adds) flushes first.
  world.on('harvest:picked', ({ actor, count, kind }) => {
    setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestInventoryData:', e); }
      try { window.dispatchEvent(new CustomEvent('ui:requestUsableItemsData')); } catch (e) { console.debug('[eventUiWiring] dispatch ui:requestUsableItemsData:', e); }
    }, 0);
    const pe = playerEntity(world);
    if (!pe || pe.id !== actor) return;
    const qty = Math.max(1, Number(count || 1) | 0);
    const k = String(kind || '').toLowerCase();
    const labels = (
      k === 'herbs'
        ? { one: 'herb', many: 'herbs' }
        : (k === 'thorn_bramble'
          ? { one: 'thorn pod', many: 'thorn pods' }
          : (k === 'venom_fern'
            ? { one: 'venom frond', many: 'venom fronds' }
            : { one: 'berry', many: 'berries' }))
    );
    const label = qty === 1 ? labels.one : labels.many;
    try { ftext.addStatus(pe.pos.x, pe.pos.y - 0.3, `+${qty} ${label}`, { color: '#b6e38d', life: 1.0 }); } catch (e) { console.debug('[eventUiWiring] ftext failed:', e); }
  });
}
