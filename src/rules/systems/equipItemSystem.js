import { EquipIntent } from "../components/Intents/EquipIntent.js";
import { Inventory } from "../components/Inventory.js";
import { Equipment } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

/**
 * equipItemSystem — resolves EquipIntent:
 * - validates that item is in actor's inventory and is equippable
 * - determines target slot from ItemInfo.slot
 * - swaps out existing item in that slot back into inventory
 * - moves item from inventory into the equipment slot
 * - clears intent and emits an 'equipped' event
 */
export function equipItemSystem(world) {
  for (const [actor, intent] of world.query(EquipIntent)) {
    const itemId = intent.itemId | 0;
    if (!(itemId > 0)) { world.remove(actor, EquipIntent); continue; }

    const inv = world.get(actor, Inventory);
    if (!inv || !Array.isArray(inv.items)) { world.remove(actor, EquipIntent); continue; }

    // Ensure the item is in inventory
    const idx = inv.items.indexOf(itemId);
    if (idx === -1) { world.remove(actor, EquipIntent); continue; }

    const info = world.get(itemId, ItemInfo);
    if (!info || (info.type !== 'equip' && info.type !== 'ammo')) { world.remove(actor, EquipIntent); continue; }

    // Ensure Equipment component exists
    let eq = world.get(actor, Equipment);
    if (!eq) {
      try { world.add(actor, Equipment, {}); } catch {}
      eq = world.get(actor, Equipment);
    }
    if (!eq) { world.remove(actor, EquipIntent); continue; }

  // Determine target slot
    const slot = (info.slot || '').toLowerCase();
    let appliedSlot = null;

    // Helper to push item back to inventory (ensuring it isn't already present)
    const pushToInventory = (id) => {
      if (!Number.isInteger(id) || id <= 0) return;
      if (!inv.items.includes(id)) inv.items.push(id);
    };

    // previously, we removed items from inventory after equipping;
    // since we don't have an equipment screen yet, we should leave it
    // in the inventory for now to allow re-equipping
    // inv.items.splice(idx, 1);

    if (slot === 'weapon') {
      if (Number.isInteger(eq.weapon) && eq.weapon > 0) pushToInventory(eq.weapon);
      eq.weapon = itemId; appliedSlot = 'weapon';
    } else if (slot === 'armor') {
      if (Number.isInteger(eq.armor) && eq.armor > 0) pushToInventory(eq.armor);
      eq.armor = itemId; appliedSlot = 'armor';
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
      if (Number.isInteger(eq.shield) && eq.shield > 0) pushToInventory(eq.shield);
      eq.shield = itemId; appliedSlot = 'shield';
    } else if (slot === 'ammo' || info.type === 'ammo') {
      if (Number.isInteger(eq.ammo) && eq.ammo > 0) pushToInventory(eq.ammo);
      eq.ammo = itemId; appliedSlot = 'ammo';
    } else {
      // Unknown or unsupported slot: item is already in inventory, ignore.
      world.remove(actor, EquipIntent);
      continue;
    }

    // Ensure count is 1 when equipped (no stacking on body) — except ammo, which stacks
    if (info.type !== 'ammo' && (info.count | 0) > 1) {
      world.mutate(itemId, ItemInfo, (r) => { r.count = 1; });
    }

    // Emit events for UI/logging
    try { world.emit && world.emit('item:equipped', { actor, itemId, slot: appliedSlot || slot, name: world.get(itemId, NamedIdentity)?.name }); } catch {}

    // Clear intent
    world.remove(actor, EquipIntent);
  }
}
