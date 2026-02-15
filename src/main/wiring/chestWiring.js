import { Equipment } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetForItem,
} from "../../rules/utils/inventoryStacking.js";

const INSTALLED = Symbol.for("jshack:main:chestWiring:installed");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   log: (msg: string) => void,
 *   bracketizeName: (s: string) => string,
 * }} opts
 */
export function installChestWiring({ world, playerEntity, log, bracketizeName }) {
  if (!world || typeof playerEntity !== "function" || typeof log !== "function" || typeof bracketizeName !== "function") return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  function buildChestItemDetail(id) {
    const info = world.get(id, ItemInfo);
    const name = world.get(id, NamedIdentity);
    if (!info) return null;
    return {
      id,
      name: name?.name || info.description || info.type || "item",
      type: info.type,
      slot: info.slot,
      count: info.count || 1,
      rarityName: info.rarityName || "common",
      description: info.description || "",
      bonuses: info.bonuses || {},
      affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
    };
  }

  function dispatchChestData(chestId) {
    const inv = world.get(chestId, Inventory);
    if (!inv) return;
    const chestItems = [];
    for (const id of (inv.items || [])) {
      const detail = buildChestItemDetail(id);
      if (detail) chestItems.push(detail);
    }
    const pe = playerEntity(world);
    const playerItems = [];
    if (pe) {
      const playerInv = world.get(pe.id, Inventory);
      if (playerInv) {
        for (const id of playerInv.items) {
          const info = world.get(id, ItemInfo);
          if (!info || info.type === "currency") continue;
          const name = world.get(id, NamedIdentity);
          playerItems.push({
            id,
            name: name?.name || info.description || info.type || "item",
            type: info.type,
            slot: info.slot,
            count: info.count || 1,
            rarityName: info.rarityName || "common",
            description: info.description || "",
          });
        }
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("ui:chestData", { detail: {
        chestId, chestItems, playerItems,
      } }));
    } catch {}
  }

  world.on("chest:open", ({ targetId }) => {
    log("You open the chest.");
    dispatchChestData(targetId);
    try { window.dispatchEvent(new CustomEvent("ui:openChest", { detail: { chestId: targetId } })); } catch {}
  });

  addEventListener("ui:requestChestTake", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { chestId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;

    const chestInv = world.get(chestId, Inventory);
    if (!chestInv) return;

    const idx = chestInv.items.indexOf(itemId);
    if (idx === -1) return;

    const playerInv = world.get(pe.id, Inventory);
    const stackIntoId = playerInv ? findInventoryStackTargetForItem(world, playerInv, itemId) : 0;
    const needsSlot = playerInv ? (!stackIntoId && !playerInv.items.includes(itemId)) : false;
    if (playerInv && playerInv.capacity != null && playerInv.items.length >= playerInv.capacity && needsSlot) {
      log("Your inventory is full.");
      return;
    }

    chestInv.items.splice(idx, 1);
    if (playerInv) {
      addItemEntityToInventory(world, playerInv, itemId);
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You take ${bracketizeName(itemName)} from the chest.`);

    dispatchChestData(chestId);
  });

  addEventListener("ui:requestChestPut", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { chestId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;

    const chestInv = world.get(chestId, Inventory);
    if (!chestInv) return;
    const info = world.get(itemId, ItemInfo);
    if (!info) return;

    if (chestInv.items.length >= chestInv.capacity) {
      log("The chest is full.");
      return;
    }

    const playerInv = world.get(pe.id, Inventory);
    if (playerInv) {
      const idx = playerInv.items.indexOf(itemId);
      if (idx !== -1) playerInv.items.splice(idx, 1);
    }

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo"]) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }

    chestInv.items.push(itemId);

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You put ${bracketizeName(itemName)} in the chest.`);

    dispatchChestData(chestId);
  });
}
