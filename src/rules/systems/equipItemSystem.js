import { EquipIntent } from "../components/Intents/EquipIntent.js";
import { Inventory } from "../components/Inventory.js";
import { Equipment, GEAR_SLOT_SET, getEquippedSlot } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Beatitude } from "../components/Beatitude.js";
import {
  inventoryContains,
  addToInventory,
} from "../utils/inventoryFacade.js";

/**
 * equipItemSystem — resolves EquipIntent:
 * - validates that item is in actor's inventory and is equippable
 * - toggles off when selecting an already equipped item
 * - determines target slot from ItemInfo.slot
 * - swaps out existing item in that slot back into inventory
 * - moves item from inventory into the equipment slot
 * - clears intent and emits equip/unequip events
 */
export function equipItemSystem(world) {
  for (const [actor, intent] of world.query(EquipIntent)) {
    const itemId = intent.itemId | 0;
    if (!(itemId > 0)) { world.remove(actor, EquipIntent); continue; }

    // Ensure the item is in inventory (hierarchy check)
    if (!inventoryContains(world, actor, itemId)) { world.remove(actor, EquipIntent); continue; }

    const info = world.get(itemId, ItemInfo);
    if (!info || (info.type !== 'equip' && info.type !== 'ammo' && info.type !== 'wand')) { world.remove(actor, EquipIntent); continue; }

    // Ensure Equipment component exists
    let eq = world.get(actor, Equipment);
    if (!eq) {
      try { world.add(actor, Equipment, {}); } catch {} // ECS: may already exist
      eq = world.get(actor, Equipment);
    }
    if (!eq) { world.remove(actor, EquipIntent); continue; }

    // Toggle path: selecting an item that's already equipped unequips it.
    const equippedSlot = getEquippedSlot(eq, itemId);
    if (equippedSlot) {
      // Cursed items cannot be unequipped — they are welded to the player.
      const beat = world.get(itemId, Beatitude);
      if (beat && beat.state === 'cursed') {
        try {
          world.emit && world.emit('item:welded', {
            actor,
            itemId,
            slot: equippedSlot,
            name: world.get(itemId, NamedIdentity)?.name,
          });
        } catch (e) { console.debug('[equipItemSystem] emit item:welded failed:', e); }
        world.remove(actor, EquipIntent);
        continue;
      }
      eq[equippedSlot] = null;
      try {
        world.emit && world.emit('item:unequipped', {
          actor,
          itemId,
          slot: equippedSlot,
          name: world.get(itemId, NamedIdentity)?.name,
        });
      } catch (e) { console.debug('[equipItemSystem] emit item:unequipped failed:', e); }
      world.remove(actor, EquipIntent);
      continue;
    }

    // Determine target slot
    const slot = (info.slot || '').toLowerCase();
    let appliedSlot = null;
    const isSupportedSlot = slot === 'ring' || GEAR_SLOT_SET.has(slot) || info.type === 'ammo';
    if (!isSupportedSlot) {
      world.remove(actor, EquipIntent);
      continue;
    }

    // Helper to push swapped-out item back to inventory via facade
    const pushToInventory = (id) => {
      if (!Number.isInteger(id) || id <= 0) return;
      // Item may already be in inventory (hierarchy child). If not, add it.
      if (!inventoryContains(world, actor, id)) {
        addToInventory(world, actor, id);
      }
    };

    const equipSingleSlot = (slotName) => {
      if (!GEAR_SLOT_SET.has(slotName)) return false;
      if (Number.isInteger(eq[slotName]) && eq[slotName] > 0) pushToInventory(eq[slotName]);
      eq[slotName] = itemId;
      appliedSlot = slotName;
      return true;
    };

    if (slot === 'weapon') {
      equipSingleSlot('weapon');
      // two-handers occupy both hands — kick out any equipped shield
      if (info.twoHanded && Number.isInteger(eq.shield) && eq.shield > 0) {
        pushToInventory(eq.shield);
        eq.shield = null;
      }
    } else if (slot === 'ring') {
      if (!Number.isInteger(eq.ring1) || eq.ring1 <= 0) {
        eq.ring1 = itemId; appliedSlot = 'ring1';
      } else if (!Number.isInteger(eq.ring2) || eq.ring2 <= 0) {
        eq.ring2 = itemId; appliedSlot = 'ring2';
      } else {
        // both rings occupied — swap with ring1 by default
        pushToInventory(eq.ring1);
        eq.ring1 = itemId; appliedSlot = 'ring1';
      }
    } else if (slot === 'shield') {
      // can't equip a shield while wielding a two-handed weapon — kick it out first
      if (Number.isInteger(eq.weapon) && eq.weapon > 0) {
        const weaponInfo = world.get(eq.weapon, ItemInfo);
        if (weaponInfo?.twoHanded) {
          pushToInventory(eq.weapon);
          eq.weapon = null;
        }
      }
      equipSingleSlot('shield');
    } else if (slot === 'ammo' || info.type === 'ammo') {
      equipSingleSlot('ammo');
    } else if (!equipSingleSlot(slot)) {
      // Unknown or unsupported slot: ignore.
      world.remove(actor, EquipIntent);
      continue;
    }

    // Ensure count is 1 when equipped (no stacking on body) — except ammo, which stacks
    if (info.type !== 'ammo' && info.type !== 'wand' && (info.count | 0) > 1) {
      world.mutate(itemId, ItemInfo, (r) => { r.count = 1; });
    }

    // Emit events for UI/logging
    try { world.emit && world.emit('item:equipped', { actor, itemId, slot: appliedSlot || slot, name: world.get(itemId, NamedIdentity)?.name }); } catch (e) { console.debug('[equipItemSystem] emit item:equipped failed:', e); }

    // Clear intent
    world.remove(actor, EquipIntent);
  }
}
