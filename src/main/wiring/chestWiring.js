import { Equipment, GEAR_SLOTS } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import {
  inventoryItems, inventoryContains, addToInventory,
  removeFromInventory, hasCapacityForItem, transferItem,
} from "../../rules/utils/inventoryFacade.js";
import { buildItemDisplayData } from "./itemName.js";
import { groupDisplayItems } from "../ui/itemGrouping.js";

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
    return buildItemDisplayData(world, id);
  }

  function dispatchChestData(chestId) {
    const chestItems = [];
    for (const id of inventoryItems(world, chestId)) {
      const detail = buildChestItemDetail(id);
      if (detail) chestItems.push(detail);
    }
    const pe = playerEntity(world);
    const playerItems = [];
    if (pe) {
      for (const id of inventoryItems(world, pe.id)) {
        const info = world.get(id, ItemInfo);
        if (!info || info.type === "currency") continue;
        const detail = buildItemDisplayData(world, id);
        if (detail) playerItems.push(detail);
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("ui:chestData", { detail: {
        chestId,
        chestItems: groupDisplayItems(chestItems),
        playerItems: groupDisplayItems(playerItems),
      } }));
    } catch (e) { console.debug('[chestWiring] dispatch ui:chestData:', e); }
  }

  function refreshInventoryUi() {
    try { window.dispatchEvent(new CustomEvent("ui:requestInventoryData")); } catch (e) { console.debug('[chestWiring] dispatch ui:requestInventoryData:', e); }
    try { window.dispatchEvent(new CustomEvent("ui:requestUsableItemsData")); } catch (e) { console.debug('[chestWiring] dispatch ui:requestUsableItemsData:', e); }
  }

  world.on("chest:open", ({ targetId }) => {
    const chestId = Number(targetId || 0) | 0;
    if (!(chestId > 0)) return;
    log("You open the chest.");
    try { window.dispatchEvent(new CustomEvent("ui:openChest", { detail: { chestId } })); } catch (e) { console.debug('[chestWiring] dispatch ui:openChest:', e); }
    dispatchChestData(chestId);
  });

  addEventListener("ui:requestChestTake", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const chestId = Number(e?.detail?.chestId || 0) | 0;
    const itemId = Number(e?.detail?.itemId || 0) | 0;
    const pe = playerEntity(world);
    if (!pe) return;

    if (!inventoryContains(world, chestId, itemId)) return;

    if (!hasCapacityForItem(world, pe.id, itemId)) {
      log("Your inventory is full.");
      return;
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";

    transferItem(world, itemId, chestId, pe.id);

    log(`You take ${bracketizeName(itemName)} from the chest.`);

    dispatchChestData(chestId);
    refreshInventoryUi();
  });

  addEventListener("ui:requestChestPut", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const chestId = Number(e?.detail?.chestId || 0) | 0;
    const itemId = Number(e?.detail?.itemId || 0) | 0;
    const pe = playerEntity(world);
    if (!pe) return;

    const info = world.get(itemId, ItemInfo);
    if (!info || !world.isAlive(itemId)) return;

    if (!hasCapacityForItem(world, chestId, itemId)) {
      log("The chest is full.");
      return;
    }

    if (!inventoryContains(world, pe.id, itemId)) {
      log("You don't seem to be carrying that.");
      return;
    }

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of GEAR_SLOTS) {
        if (eq[slot] === itemId) {
          eq[slot] = null;
          break;
        }
      }
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    transferItem(world, itemId, pe.id, chestId);
    log(`You put ${bracketizeName(itemName)} in the chest.`);

    dispatchChestData(chestId);
    refreshInventoryUi();
  });
}
