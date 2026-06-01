import { EquipIntent } from "../components/Intents/EquipIntent.js";
import { Inventory } from "../components/Inventory.js";
import { Equipment, GEAR_SLOT_SET, getEquippedSlot } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import {
  inventoryContains,
  addToInventory,
  removeFromInventory,
} from "../utils/inventoryFacade.js";
import {
  clearEquippedSlotTopology,
  isEquippedInTopology,
  setEquippedSlotTopology,
} from "../utils/equipmentTopology.js";
import { isItemCursed, blockIfCursed } from "../utils/curseUtils.js";

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
    const equippedSlot = getEquippedSlot(eq, itemId) || isEquippedInTopology(world, actor, itemId);
    if (equippedSlot) {
      if (blockIfCursed(world, actor, itemId)) { world.remove(actor, EquipIntent); continue; }
      eq[equippedSlot] = null;
      if (equippedSlot === 'weapon') {
        clearEquippedSlotTopology(world, actor, 'weapon');
        addToInventory(world, actor, itemId, { silent: true });
      }
      world.emit('item:unequipped', {
        actor,
        itemId,
        slot: equippedSlot,
        name: world.get(itemId, NamedIdentity)?.name,
      });
      world.remove(actor, EquipIntent);
      continue;
    }

    // Ensure the item is in inventory (hierarchy check) unless it was handled
    // by the already-equipped toggle path above.
    if (!inventoryContains(world, actor, itemId)) { world.remove(actor, EquipIntent); continue; }

    // Determine target slot (legacy "shield" → "offhand" compat)
    const rawSlot = (info.slot || '').toLowerCase();
    const slot = rawSlot === 'shield' ? 'offhand' : rawSlot;
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
        addToInventory(world, actor, id, { silent: true });
      }
    };

    const blockOnCursed = (id) => blockIfCursed(world, actor, id);

    const equipSingleSlot = (slotName) => {
      if (!GEAR_SLOT_SET.has(slotName)) return false;
      const occupant = eq[slotName];
      if (Number.isInteger(occupant) && occupant > 0) {
        if (blockOnCursed(occupant)) return false;
        pushToInventory(occupant);
      }
      eq[slotName] = itemId;
      if (slotName === 'weapon') setEquippedSlotTopology(world, actor, 'weapon', itemId);
      appliedSlot = slotName;
      return true;
    };

    if (slot === 'weapon') {
      const chosenSlot = (intent.targetSlot === 'weapon' || intent.targetSlot === 'offhand')
        ? intent.targetSlot : '';

      if (chosenSlot) {
        // Pre-check: a 2H in weapon must also displace offhand — block if offhand cursed.
        if (chosenSlot === 'weapon' && info.twoHanded && Number.isInteger(eq.offhand) && eq.offhand > 0) {
          if (blockOnCursed(eq.offhand)) { world.remove(actor, EquipIntent); continue; }
        }
        // Pre-check: a 1H in offhand while weapon is 2H must displace weapon — block if weapon cursed.
        if (chosenSlot === 'offhand' && Number.isInteger(eq.weapon) && eq.weapon > 0) {
          const weaponInfo = world.get(eq.weapon, ItemInfo);
          if (weaponInfo?.twoHanded && blockOnCursed(eq.weapon)) { world.remove(actor, EquipIntent); continue; }
        }
        // Player explicitly chose a slot — honour it directly.
        if (!equipSingleSlot(chosenSlot)) { world.remove(actor, EquipIntent); continue; }
        // Kick offhand after placing 2H weapon (already verified not cursed above).
        if (chosenSlot === 'weapon' && info.twoHanded && Number.isInteger(eq.offhand) && eq.offhand > 0) {
          pushToInventory(eq.offhand);
          eq.offhand = null;
        }
        // Kick 2H weapon after placing 1H in offhand (already verified not cursed above).
        if (chosenSlot === 'offhand' && Number.isInteger(eq.weapon) && eq.weapon > 0) {
          const weaponInfo = world.get(eq.weapon, ItemInfo);
          if (weaponInfo?.twoHanded) {
            pushToInventory(eq.weapon);
            eq.weapon = null;
          }
        }
      } else {
        // Auto-cascade: if weapon slot is occupied by a 1H, offhand is empty,
        // and new item is also 1H, cascade to offhand for dual-wielding.
        const mainOccupied = Number.isInteger(eq.weapon) && eq.weapon > 0;
        const offhandEmpty = !Number.isInteger(eq.offhand) || eq.offhand <= 0;
        const isOneHanded = !info.twoHanded;

        if (mainOccupied && offhandEmpty && isOneHanded) {
          const mainInfo = world.get(eq.weapon, ItemInfo);
          if (mainInfo && !mainInfo.twoHanded) {
            if (!equipSingleSlot('offhand')) { world.remove(actor, EquipIntent); continue; }
          } else {
            // Main hand is 2H — replace it, not cascade
            if (!equipSingleSlot('weapon')) { world.remove(actor, EquipIntent); continue; }
          }
        } else {
          // Pre-check: 2H weapon must also displace offhand — block if cursed.
          if (info.twoHanded && Number.isInteger(eq.offhand) && eq.offhand > 0) {
            if (blockOnCursed(eq.offhand)) { world.remove(actor, EquipIntent); continue; }
          }
          if (!equipSingleSlot('weapon')) { world.remove(actor, EquipIntent); continue; }
          // Kick offhand after placing 2H (already verified not cursed above).
          if (info.twoHanded && Number.isInteger(eq.offhand) && eq.offhand > 0) {
            pushToInventory(eq.offhand);
            eq.offhand = null;
          }
        }
      }
    } else if (slot === 'ring') {
      if (!Number.isInteger(eq.ring1) || eq.ring1 <= 0) {
        eq.ring1 = itemId; appliedSlot = 'ring1';
      } else if (!Number.isInteger(eq.ring2) || eq.ring2 <= 0) {
        eq.ring2 = itemId; appliedSlot = 'ring2';
      } else {
        // both rings occupied — swap with whichever ring isn't cursed (ring1 preferred)
        if (!isItemCursed(world, eq.ring1)) {
          pushToInventory(eq.ring1);
          eq.ring1 = itemId; appliedSlot = 'ring1';
        } else if (!isItemCursed(world, eq.ring2)) {
          pushToInventory(eq.ring2);
          eq.ring2 = itemId; appliedSlot = 'ring2';
        } else {
          // both cursed — block on ring1
          blockOnCursed(eq.ring1);
          world.remove(actor, EquipIntent); continue;
        }
      }
    } else if (slot === 'offhand') {
      // can't equip an offhand while wielding a two-handed weapon — kick it out first
      if (Number.isInteger(eq.weapon) && eq.weapon > 0) {
        const weaponInfo = world.get(eq.weapon, ItemInfo);
        if (weaponInfo?.twoHanded) {
          if (blockOnCursed(eq.weapon)) { world.remove(actor, EquipIntent); continue; }
          pushToInventory(eq.weapon);
          eq.weapon = null;
        }
      }
      equipSingleSlot('offhand');
    } else if (slot === 'ammo' || info.type === 'ammo') {
      equipSingleSlot('ammo');
      // Ammo should move out of carried inventory when equipped.
      removeFromInventory(world, actor, itemId);
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
    world.emit('item:equipped', { actor, itemId, slot: appliedSlot || slot, name: world.get(itemId, NamedIdentity)?.name });

    // Clear intent
    world.remove(actor, EquipIntent);
  }
}
