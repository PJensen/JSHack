// src/rules/systems/scriptTickSystem.js
// Fires onTurnWhileCarried / onTurnWhileEquipped hooks on inventory items
// that were defined via the content DSL. Runs in the 'scripts' phase.

import { Player } from '../components/Player.js';
import { NamedIdentity } from '../components/NamedIdentity.js';
import { ScriptState } from '../components/ScriptState.js';
import { Equipment } from '../components/Equipment.js';
import { inventoryItems } from '../utils/inventoryFacade.js';
import { getCatalogItem } from '../data/itemCatalog.js';
import { ScriptCtx } from '../../content/scriptCtx.js';
import { createWorldFacade } from '../../content/worldFacade.js';

/**
 * scriptTickSystem — each tick, for every player inventory item that has
 * content-DSL tick hooks, build a ScriptCtx and invoke the hook.
 */
export function scriptTickSystem(world) {
  // Find the player entity
  let playerId = 0;
  for (const [id] of world.query(Player)) {
    playerId = id;
    break;
  }
  if (!playerId) return;

  const items = inventoryItems(world, playerId);
  if (items.length === 0) return;

  // Check which items are equipped (for onTurnWhileEquipped)
  const equip = world.get(playerId, Equipment);
  const equippedSet = new Set();
  if (equip) {
    for (const slot of ['weapon', 'offhand', 'armor', 'helm', 'boots', 'gloves', 'belt', 'legs', 'ring1', 'ring2', 'amulet', 'shield']) {
      const eid = equip[slot];
      if (eid) equippedSet.add(eid);
    }
  }

  for (const itemId of items) {
    const ni = world.get(itemId, NamedIdentity);
    if (!ni?.identity) continue;

    const def = getCatalogItem(ni.identity);
    if (!def?._contentTickHooks) continue;

    const hooks = def._contentTickHooks;
    const isEquipped = equippedSet.has(itemId);

    // onTurnWhileCarried — fires for all inventory items
    if (typeof hooks.onTurnWhileCarried === 'function') {
      _runTickHook(world, playerId, itemId, ni.identity, hooks.onTurnWhileCarried);
    }

    // onTurnWhileEquipped — only for equipped items
    if (isEquipped && typeof hooks.onTurnWhileEquipped === 'function') {
      _runTickHook(world, playerId, itemId, ni.identity, hooks.onTurnWhileEquipped);
    }
  }
}

function _runTickHook(world, actor, itemId, identity, hookFn) {
  try {
    const facade = createWorldFacade(world, actor, itemId);
    const state = { actor, itemId, identity };
    const ctx = new ScriptCtx(facade, state);
    hookFn(ctx);
  } catch (err) {
    console.error(`[scriptTickSystem] Error in tick hook for "${identity}":`, err);
  }
}
