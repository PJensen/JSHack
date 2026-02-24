// src/main/ui/inventoryDataProvider.js
// addEventListener handlers that feed inventory, usable, throwable, apply,
// message-log and death-log data to display overlays.

import { playerEntity, itemsAt } from "../../rules/utils/queries.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { Unpaid } from "../../rules/components/Unpaid.js";
import { Brain } from "../../rules/components/Brain.js";
import { Settings } from "../../rules/components/Settings.js";
import { getSpell } from "../../rules/data/spells.js";
import { coalesceInventoryStacks } from "../../rules/utils/inventoryStacking.js";
import { isApplyTool, listApplyTargetsForTool } from "../../rules/content/items/applyPayloads.js";
import { resolveItemDisplayName, resolveAffixes, buildItemDisplayData as _buildItemDisplayData } from "../wiring/itemName.js";
import { makeRulesDispatcher } from "../input/rulesDispatch.js";

const _installed = Symbol.for('inventoryDataProvider');

/**
 * Install event listeners that supply inventory/use/throw/apply/message/death
 * data to the display overlays.
 *
 * @param {{
 *   world: import('../../lib/ecs-js/index.js').World,
 *   getActiveSpellId: () => string|null,
 *   isSimUiBlocked: () => boolean,
 *   getMessageLog: () => { getEntries(): any[] },
 *   tombstoneRepo: { getAll(): any[] },
 * }} deps
 * @returns {{ buildGroundPickupDetailAt: (actorId: number, x: number, y: number) => object|null }}
 */
export function installInventoryDataProvider({ world, getActiveSpellId, isSimUiBlocked, getMessageLog, tombstoneRepo }) {
  if (/** @type {any} */ (world)[_installed]) return { buildGroundPickupDetailAt };
  /** @type {any} */ (world)[_installed] = true;

  function buildItemDisplayData(info, itemId) {
    return _buildItemDisplayData(world, itemId) || {
      id: itemId,
      type: info.type || 'item',
      name: resolveItemDisplayName(world, itemId),
      slot: info.slot || '',
      count: 1,
      rarityName: 'common',
      description: '',
      bonuses: {},
      affixes: [],
      damageDice: null,
      staminaCost: null,
      twoHanded: false,
      coating: null,
    };
  }

  const _slotMap = {
    weapon: ['weapon'],
    armor: ['armor'],
    shield: ['shield'],
    ring: ['ring1', 'ring2'],
    ammo: ['ammo'],
    ranged: ['ranged'],
  };

  function buildEquippedComparison(eq, slot, currentItemId) {
    const fields = _slotMap[slot];
    if (!fields) return null;
    for (const field of fields) {
      const eqId = eq[field];
      if (!Number.isInteger(eqId) || eqId <= 0 || eqId === currentItemId) continue;
      const eqInfo = world.get(eqId, ItemInfo);
      if (!eqInfo) continue;
      return {
        name: resolveItemDisplayName(world, eqId),
        bonuses: eqInfo.bonuses || {},
        damageDice: eqInfo.damageDice || null,
        staminaCost: eqInfo.staminaCost ?? null,
        twoHanded: !!eqInfo.twoHanded,
        affixes: resolveAffixes(eqInfo.affixes),
      };
    }
    return null;
  }

  function buildGroundPickupDetailAt(actorId, x, y) {
    const tx = Number.isFinite(x) ? (x | 0) : 0;
    const ty = Number.isFinite(y) ? (y | 0) : 0;
    const ids = [...itemsAt(world, tx, ty)];
    // Include chest contents on the tile.
    let chestId = 0;
    for (const [eid, pos, ni] of world.query(Position, NamedIdentity)) {
      if (ni.identity !== 'chest' || pos.x !== tx || pos.y !== ty) continue;
      chestId = eid;
      const inv = world.get(eid, Inventory);
      if (!inv || !Array.isArray(inv.items)) continue;
      for (const itemId of inv.items) ids.push(itemId);
    }

    const nonCurrencyItems = [];
    for (const itemId of ids) {
      const info = world.get(itemId, ItemInfo);
      if (!info || info.type === 'currency') continue;
      nonCurrencyItems.push(buildItemDisplayData(info, itemId));
    }

    if (!nonCurrencyItems.length && !chestId) return null;

    if (chestId) {
      return {
        mode: 'multi',
        count: nonCurrencyItems.length,
        items: nonCurrencyItems,
        fromChest: true,
        chestId,
      };
    }
    if (nonCurrencyItems.length > 1) {
      return {
        mode: 'multi',
        count: nonCurrencyItems.length,
        items: nonCurrencyItems,
        fromChest: false,
      };
    }

    const single = nonCurrencyItems[0];
    const set = world.get(actorId, Settings);
    const pickupRange = Math.max(0, Number(set?.pickupRange ?? 0));
    return {
      mode: 'single',
      item: single,
      pickupRange,
    };
  }

  // Provide inventory data to overlay when requested
  addEventListener('ui:requestInventoryData', () => {
    const p = playerEntity(world);
    const items = [];
    let ground = null;
    if (p) {
      const inv = world.get(p.id, Inventory);
      const eq = world.get(p.id, Equipment);
      if (inv && Array.isArray(inv.items)) {
        coalesceInventoryStacks(world, inv);
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          if (info) {
            const equippedSlot = (eq && (
              (eq.weapon === id && 'weapon') ||
              (eq.armor === id && 'armor') ||
              (eq.shield === id && 'shield') ||
              (eq.ring1 === id && 'ring1') ||
              (eq.ring2 === id && 'ring2') ||
              (eq.ammo === id && 'ammo') ||
              (eq.ranged === id && 'ranged') ||
              (eq.feet === id && 'feet')
            )) || null;
            const applyTargetIds = listApplyTargetsForTool(world, p.id, id);
            const applyTargetCount = applyTargetIds.length;
            const canApply = isApplyTool(world, p.id, id);
            items.push({
              ...buildItemDisplayData(info, id),
              equipped: Boolean(equippedSlot),
              equippedSlot,
              equippedComparison: null,
              unpaid: world.has(id, Unpaid),
              unpaidPrice: world.get(id, Unpaid)?.price || 0,
              unpaidShopkeeperId: world.get(id, Unpaid)?.shopkeeperId || 0,
              canApply,
              applyTargetCount,
            });
          }
        }
      }
      // Append learned spells as virtual brain-slot items
      const brain = world.get(p.id, Brain);
      const activeSpellId = getActiveSpellId();
      const spellIds = Array.isArray(brain?.learnedSpellIds) ? brain.learnedSpellIds : [];
      for (const sid of spellIds) {
        const s = getSpell(sid);
        if (!s) continue;
        items.push({
          id: `spell:${sid}`,
          type: 'spell',
          description: `Mana ${s.manaCost}`,
          count: 1,
          slot: 'brain',
          name: s.symbol ? `${s.symbol} ${s.name}` : s.name,
          rarityName: 'rare',
          bonuses: {},
          affixes: [],
          equipped: activeSpellId === sid,
          equippedSlot: activeSpellId === sid ? 'brain' : null,
        });
      }
      // Attach comparison data for unequipped equippable items
      if (eq) {
        for (const it of items) {
          if (it.equipped || !(it.type === 'equip' || it.type === 'ammo' || it.type === 'wand' || it.slot === 'ranged')) continue;
          it.equippedComparison = buildEquippedComparison(eq, it.slot, it.id);
        }
      }
      ground = buildGroundPickupDetailAt(p.id, p.pos.x, p.pos.y);
    }
    window.dispatchEvent(new CustomEvent('ui:inventoryData', { detail: { items, ground } }));
  });

  // Provide usable items to the use-chooser overlay when requested
  const USABLE_TYPES = new Set(['wand', 'scroll', 'book', 'learn', 'food', 'potion']);
  addEventListener('ui:requestUsableItemsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      const inv = world.get(p.id, Inventory);
      if (inv && Array.isArray(inv.items)) {
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          if (!info || !USABLE_TYPES.has(info.type)) continue;
          items.push(buildItemDisplayData(info, id));
        }
      }
    }
    window.dispatchEvent(new CustomEvent('ui:usableItemsData', { detail: { items } }));
  });

  // Provide all inventory items to the throw-chooser overlay when requested
  addEventListener('ui:requestThrowableItemsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      const inv = world.get(p.id, Inventory);
      if (inv && Array.isArray(inv.items)) {
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          if (!info) continue;
          items.push(buildItemDisplayData(info, id));
        }
      }
    }
    window.dispatchEvent(new CustomEvent('ui:throwableItemsData', { detail: { items } }));
  });

  // Provide applicable tools to the apply-tool chooser
  addEventListener('ui:requestApplyToolsData', () => {
    const p = playerEntity(world);
    const items = [];
    if (p) {
      const inv = world.get(p.id, Inventory);
      if (inv && Array.isArray(inv.items)) {
        for (const id of inv.items) {
          if (!isApplyTool(world, p.id, id)) continue;
          items.push({ id, name: resolveItemDisplayName(world, id) });
        }
      }
    }
    window.dispatchEvent(new CustomEvent('ui:applyToolsData', { detail: { items } }));
  });

  // Provide filtered targets for an apply tool
  addEventListener('ui:requestApplyTargetsData', (ev) => {
    const toolId = ev?.detail?.toolId || 0;
    const p = playerEntity(world);
    const items = [];
    if (p && toolId) {
      const targetIds = listApplyTargetsForTool(world, p.id, toolId);
      for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const info = world.get(id, ItemInfo);
        items.push({ id, name: resolveItemDisplayName(world, id), description: info?.description || '' });
      }
    }
    window.dispatchEvent(new CustomEvent('ui:applyTargetsData', { detail: { items } }));
  });

  // When user confirms an apply action from the UI
  addEventListener('ui:requestApply', (ev) => {
    if (isSimUiBlocked()) return;
    const toolId = ev?.detail?.toolId || 0;
    const targetItemId = ev?.detail?.targetItemId || 0;
    if (!toolId || !targetItemId) return;
    const rulesHandler = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0));
    rulesHandler({ type: 'rules.applyItem', payload: { itemId: toolId, targetItemId } });
  });

  // Provide message log entries
  addEventListener('ui:requestMessageLogData', () => {
    const entries = getMessageLog().getEntries();
    window.dispatchEvent(new CustomEvent('ui:messageLogData', { detail: { entries } }));
  });

  // Provide death log records from tombstone repository
  addEventListener('ui:requestDeathLogData', () => {
    const records = tombstoneRepo.getAll();
    window.dispatchEvent(new CustomEvent('ui:deathLogData', { detail: { records } }));
  });

  return { buildGroundPickupDetailAt };
}
