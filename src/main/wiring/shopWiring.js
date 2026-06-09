import { createFrom } from "../../lib/ecs-js/archetype.js";
import { GoldStack } from "../../rules/archetypes/Items.js";
import { Equipment, GEAR_SLOTS, getEquippedSlot } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { ShopInventory } from "../../rules/components/ShopInventory.js";
import { Unpaid } from "../../rules/components/Unpaid.js";
import {
  inventoryItems, inventoryContains, addToInventory,
  removeFromInventory, hasCapacityForItem, transferItem,
} from "../../rules/utils/inventoryFacade.js";
import { resolveItemDisplayName, buildItemDisplayData } from "./itemName.js";
import { appraiseItemValue, getUnidentifiedGemAppraisal } from "../../rules/utils/shopAppraisal.js";
import { isItemCursed } from "../../rules/utils/curseUtils.js";
import { chebyshevScalar } from "../../rules/utils/distance.js";
import { identify, isIdentified } from "../../rules/data/identification.js";
import { requiresIdentification, getUnidentifiedName } from "../../rules/data/itemAppearances.js";
import { groupDisplayItems } from "../ui/itemGrouping.js";
import { calculateShopDebt, clearShopDebt, shopDebtRecords } from "../../rules/utils/shopDebt.js";

const INSTALLED = Symbol.for("jshack:main:shopWiring:installed");
const API_KEY = Symbol.for("jshack:main:shopWiring:api");

/**
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   playerEntity: (world: import("../../lib/ecs-js/index.js").World) => ({id:number,pos:{x:number,y:number}}|null),
 *   log: (msg: string) => void,
 *   bracketizeName: (s: string) => string,
 * }} opts
 */
export function installShopWiring({ world, playerEntity, log, bracketizeName }) {
  if (!world || typeof playerEntity !== "function" || typeof log !== "function" || typeof bracketizeName !== "function") {
    return Object.freeze({ handlePlayerMoved: () => {} });
  }
  if (world[INSTALLED] && world[API_KEY]) return world[API_KEY];
  world[INSTALLED] = true;

  let activeShopSession = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5, mode: "browse", vendorKind: "" };

  function playerGoldCount() {
    const pe = playerEntity(world);
    if (!pe) return 0;
    let total = 0;
    for (const id of inventoryItems(world, pe.id)) {
      const info = world.get(id, ItemInfo);
      if (info && info.type === "currency") total += info.count || 0;
    }
    return total;
  }

  function spendGold(ownerId, amount) {
    let remaining = Math.max(0, Number(amount || 0));
    if (remaining <= 0) return true;
    for (const gid of inventoryItems(world, ownerId)) {
      const gi = world.get(gid, ItemInfo);
      if (!gi || gi.type !== "currency") continue;
      const have = Math.max(0, Number(gi.count || 0));
      if (have <= 0) continue;
      const spend = Math.min(have, remaining);
      world.mutate(gid, ItemInfo, (r) => { r.count = Math.max(0, (r.count || 0) - spend); });
      remaining -= spend;
      const next = world.get(gid, ItemInfo)?.count || 0;
      if (next <= 0) {
        removeFromInventory(world, ownerId, gid);
        try { world.destroy(gid); } catch {} // ECS: entity may already be destroyed
      }
      if (remaining <= 0) break;
    }
    return remaining <= 0;
  }

  function grantGold(ownerId, amount) {
    const n = Math.max(0, Number(amount || 0));
    if (n <= 0) return;
    const gid = createFrom(world, GoldStack, {});
    world.mutate(gid, ItemInfo, (r) => { r.count = n; });
    addToInventory(world, ownerId, gid);
  }

  function resolveItemAppraisal(id) {
    return appraiseItemValue(world, id, {
      unidentifiedGemValue: getUnidentifiedGemAppraisal(world, id),
    });
  }

  function buildShopItemDetail(id, markup) {
    const base = buildItemDisplayData(world, id);
    if (!base) return null;
    const appraisedValue = resolveItemAppraisal(id);
    base.value = appraisedValue;
    base.buyPrice = Math.ceil(appraisedValue * markup);
    return base;
  }

  function dispatchShopData(shopkeeperId, buyMarkup, sellDiscount, mode = 'browse') {
    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;

    const shopItems = [];
    const unpaidItems = [];
    let totalBill = 0;

    // Collect floor items with Unpaid component belonging to this shopkeeper
    for (const [itemId, unpaid, pos] of world.query(Unpaid, Position)) {
      if (unpaid.shopkeeperId === shopkeeperId) {
        const detail = buildShopItemDetail(itemId, 1.0); // Price already in Unpaid
        if (detail) {
          detail.buyPrice = unpaid.price; // Use the pre-calculated price
          shopItems.push(detail);
        }
      }
    }

    // Collect unpaid items in player inventory (for bill/checkout)
    const pe = playerEntity(world);
    const playerItems = [];
    const appraisableItems = [];
    if (pe) {
        for (const id of inventoryItems(world, pe.id)) {
          const info = world.get(id, ItemInfo);
          if (!info) continue;

          const unpaid = world.get(id, Unpaid);
          if (unpaid && unpaid.shopkeeperId === shopkeeperId) {
            // This is an unpaid item from this shop
            const detail = buildItemDisplayData(world, id) || { id, name: resolveItemDisplayName(world, id) };
            detail.value = resolveItemAppraisal(id);
            detail.price = unpaid.price;
            detail.unpaid = true;
            unpaidItems.push(detail);
            totalBill += unpaid.price;
          } else if (info.type !== "currency") {
            // Regular item for selling
            const sellValue = resolveItemAppraisal(id);
            const detail = buildItemDisplayData(world, id) || { id, name: resolveItemDisplayName(world, id) };
            detail.value = sellValue;
            detail.sellPrice = Math.floor(sellValue * sellDiscount);
            playerItems.push(detail);

            // Also check if appraisable (unidentified, non-gem)
            if (requiresIdentification(info)) {
              const identity = world.get(id, NamedIdentity)?.identity;
              if (identity && !isIdentified(identity)) {
                const appDetail = buildItemDisplayData(world, id) || { id, name: resolveItemDisplayName(world, id) };
                appDetail.appraiseFee = getAppraiseFee(info);
                appraisableItems.push(appDetail);
              }
            }
          }
        }
        const debts = shopDebtRecords(world, pe.id, shopkeeperId);
        for (let i = 0; i < debts.length; i++) {
          const debt = debts[i];
          const amount = Math.max(0, Number(debt?.amount || 0));
          if (amount <= 0) continue;
          unpaidItems.push({
            id: `debt:${i}`,
            name: debt.name || debt.identity || "Unauthorized use",
            price: amount,
            unpaid: true,
            debt: true,
            reason: debt.reason,
          });
          totalBill += amount;
        }
    }

    const groupedShopItems = groupDisplayItems(shopItems);
    const groupedPlayerItems = groupDisplayItems(playerItems);
    const groupedUnpaidItems = groupDisplayItems(unpaidItems);
    const groupedAppraisableItems = groupDisplayItems(appraisableItems);

    try {
      window.dispatchEvent(new CustomEvent("ui:shopData", { detail: {
        shopkeeperId,
        shopItems: groupedShopItems,
        playerItems: groupedPlayerItems,
        unpaidItems: groupedUnpaidItems,
        appraisableItems: groupedAppraisableItems,
        totalBill,
        gold: playerGoldCount(),
        buyMarkup,
        sellDiscount,
        mode,
        vendorKind: activeShopSession.vendorKind,
      } }));
    } catch (e) { console.debug('[shopWiring] dispatch ui:shopData:', e); }
  }

  function isPlayerAdjacentToEntity(entityId) {
    const pe = playerEntity(world);
    if (!pe || pe.id <= 0 || !Number.isInteger(entityId) || entityId <= 0) return false;
    const pPos = world.get(pe.id, Position);
    const tPos = world.get(entityId, Position);
    if (!pPos || !tPos) return false;
    const dist = chebyshevScalar(pPos.x, pPos.y, tPos.x, tPos.y);
    return dist <= 1;
  }

  function placeItemOnShopFloor(itemId, shopkeeperId) {
    const shopPos = world.get(shopkeeperId, Position);
    if (!shopPos) return false;
    if (world.has(itemId, Position)) {
      world.set(itemId, Position, { x: shopPos.x, y: shopPos.y });
    } else {
      world.add(itemId, Position, { x: shopPos.x, y: shopPos.y });
    }
    return true;
  }

  function closeShopUI() {
    activeShopSession.shopkeeperId = 0;
    activeShopSession.mode = "browse";
    try { window.dispatchEvent(new CustomEvent("ui:closeShop")); } catch (e) { console.debug('[shopWiring] dispatch ui:closeShop:', e); }
  }

  function isActiveCheckoutSessionFor(shopkeeperId) {
    const sid = Number(shopkeeperId) || 0;
    if (sid <= 0) return false;
    return activeShopSession.mode === "checkout" && activeShopSession.shopkeeperId === sid;
  }

  world.on("shop:open", ({ actor, targetId, buyMarkup, sellDiscount, vendorKind }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;
    if (!isPlayerAdjacentToEntity(Number(targetId) || 0)) return;
    const sid = Number(targetId) || 0;
    if (sid > 0 && activeShopSession.shopkeeperId === sid) return;
    log("You approach the shopkeeper.");
    const shop = world.get(targetId, ShopInventory);
    const markup = buyMarkup ?? shop?.buyMarkup ?? 1.0;
    const discount = sellDiscount ?? shop?.sellDiscount ?? 0.5;
    const vkind = String(vendorKind || "");
    activeShopSession = {
      shopkeeperId: Number(targetId) || 0,
      buyMarkup: markup,
      sellDiscount: discount,
      mode: "browse",
      vendorKind: vkind,
    };
    dispatchShopData(targetId, markup, discount, "browse");
    try { window.dispatchEvent(new CustomEvent("ui:openShop", { detail: { shopkeeperId: targetId, buyMarkup: markup, sellDiscount: discount, mode: "browse", vendorKind: vkind } })); } catch (e) { console.debug('[shopWiring] dispatch ui:openShop:', e); }
  });

  addEventListener("ui:requestBuy", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isPlayerAdjacentToEntity(Number(shopkeeperId) || 0)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;
    const info = world.get(itemId, ItemInfo);
    if (!info) return;

    // Floor shop model: only unpaid floor items from this shopkeeper are purchasable.
    const unpaid = world.get(itemId, Unpaid);
    if (!unpaid || unpaid.shopkeeperId !== shopkeeperId || !world.has(itemId, Position)) {
      log("That item is not on this shop floor.");
      return;
    }
    const price = unpaid.price;
    const gold = playerGoldCount();

    if (gold < price) {
      log("You cannot afford that.");
      return;
    }

    if (!hasCapacityForItem(world, pe.id, itemId)) {
      log("Your pack is full.");
      return;
    }

    // Deduct gold across all currency stacks
    if (!spendGold(pe.id, price)) {
      log("You cannot afford that.");
      return;
    }

    // Remove unpaid status (item is now paid for)
    try { world.remove(itemId, Unpaid); } catch {} // ECS: may not exist
    addToInventory(world, pe.id, itemId);

    log(`You buy ${bracketizeName(resolveItemDisplayName(world, itemId))} for ${price} gold.`);

    const mode = activeShopSession.mode === "checkout" ? "checkout" : "browse";
    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5, mode);
  });

  addEventListener("ui:requestSell", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isPlayerAdjacentToEntity(Number(shopkeeperId) || 0)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;
    const info = world.get(itemId, ItemInfo);
    if (!info) return;

    const eq = world.get(pe.id, Equipment);
    if (getEquippedSlot(eq, itemId)) {
      log("You must unequip that item before selling it.");
      return;
    }

    if (isItemCursed(world, itemId)) {
      log("The shopkeeper recoils. \"I don't deal in cursed goods.\"");
      return;
    }

    const sellDiscount = shop.sellDiscount ?? 0.5;
    const sellValue = resolveItemAppraisal(itemId);
    const price = Math.floor(sellValue * sellDiscount);

    if (!inventoryContains(world, pe.id, itemId)) return;
    removeFromInventory(world, pe.id, itemId);

    const resalePrice = Math.ceil(sellValue * (shop.buyMarkup ?? 1.0));
    if (!placeItemOnShopFloor(itemId, shopkeeperId)) {
      log("The shop floor is inaccessible.");
      return;
    }
    if (world.has(itemId, Unpaid)) {
      world.set(itemId, Unpaid, { shopkeeperId, price: resalePrice });
    } else {
      world.add(itemId, Unpaid, { shopkeeperId, price: resalePrice });
    }

    grantGold(pe.id, price);

    log(`You sell ${bracketizeName(resolveItemDisplayName(world, itemId))} for ${price} gold.`);

    const mode = activeShopSession.mode === "checkout" ? "checkout" : "browse";
    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5, mode);
  });

  // Handle shop exit blocking (triggered when player tries to leave with unpaid items)
  world.on("shop:exit-blocked", ({ actor, shopkeeperId, bill, decision }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;

    // Open shop UI in checkout mode
    activeShopSession = {
      shopkeeperId: Number(shopkeeperId) || 0,
      buyMarkup: 1.3,
      sellDiscount: 0.5,
      mode: "checkout",
    };

    const shop = world.get(shopkeeperId, ShopInventory);
    const markup = shop?.buyMarkup ?? 1.3;
    const discount = shop?.sellDiscount ?? 0.5;

    dispatchShopData(shopkeeperId, markup, discount, 'checkout');
    try {
      window.dispatchEvent(new CustomEvent("ui:openShop", {
        detail: { shopkeeperId, buyMarkup: markup, sellDiscount: discount, mode: 'checkout' }
      }));
    } catch (e) { console.debug('[shopWiring] dispatch ui:openShop:', e); }
  });

  // Handle item pickup - notify when picking up unpaid items
  world.on("item:pickup", ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;

    const unpaid = world.get(itemId, Unpaid);
    if (unpaid && unpaid.price > 0) {
      log(`You pick up ${bracketizeName(resolveItemDisplayName(world, itemId))} (unpaid, ${unpaid.price} gold).`);
    }
  });

  world.on("shop:unauthorized-use", ({ actor, shopkeeperId, amount, reason }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;
    const sid = Number(shopkeeperId) || 0;
    if (sid > 0 && activeShopSession.shopkeeperId === sid) {
      const shop = world.get(sid, ShopInventory);
      dispatchShopData(sid, shop?.buyMarkup ?? activeShopSession.buyMarkup, shop?.sellDiscount ?? activeShopSession.sellDiscount, activeShopSession.mode);
    }
  });

  addEventListener("ui:removeFromInvoice", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId, itemId } = e?.detail || {};
    const sid = Number(shopkeeperId) || 0;
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isActiveCheckoutSessionFor(sid) && !isPlayerAdjacentToEntity(sid)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    if (!inventoryContains(world, pe.id, itemId)) return;

    const unpaid = world.get(itemId, Unpaid);
    if (!unpaid || unpaid.shopkeeperId !== sid) return;

    if (!transferItem(world, itemId, pe.id, sid, { silent: true })) {
      log("The shopkeeper cannot take that back right now.");
      return;
    }
    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of GEAR_SLOTS) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }
    log(`You return ${bracketizeName(resolveItemDisplayName(world, itemId))} to the shopkeeper.`);

    const shop = world.get(sid, ShopInventory);
    dispatchShopData(sid, shop?.buyMarkup ?? 1.0, shop?.sellDiscount ?? 0.5, "checkout");
  });

  // Handle payment of bill
  addEventListener("ui:payBill", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId } = e?.detail || {};
    const requestedShopkeeperId = Number(shopkeeperId) || 0;
    const sid = requestedShopkeeperId > 0 ? requestedShopkeeperId : (activeShopSession.shopkeeperId | 0);
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isActiveCheckoutSessionFor(sid) && !isPlayerAdjacentToEntity(sid)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(sid, ShopInventory);
    if (!shop) return;

    // Calculate total bill
    let totalBill = 0;
    const unpaidItemIds = [];

    for (const itemId of inventoryItems(world, pe.id)) {
      const unpaid = world.get(itemId, Unpaid);
      if (unpaid && unpaid.shopkeeperId === sid) {
        totalBill += unpaid.price;
        unpaidItemIds.push(itemId);
      }
    }
    totalBill += calculateShopDebt(world, pe.id, sid);

    if (totalBill === 0) {
      log("You have no unpaid items.");
      closeShopUI();
      return;
    }

    const gold = playerGoldCount();
    if (gold < totalBill) {
      log(`You cannot afford that. You need ${totalBill} gold but only have ${gold}.`);
      return;
    }

    // Deduct gold across all currency stacks
    if (!spendGold(pe.id, totalBill)) {
      log(`You cannot afford that. You need ${totalBill} gold but only have ${gold}.`);
      return;
    }

    // Remove Unpaid component from all items
    for (const itemId of unpaidItemIds) {
      try {
        world.remove(itemId, Unpaid);
      } catch {} // ECS: may not exist
    }
    clearShopDebt(world, pe.id, sid);

    log(`You pay ${totalBill} gold for your purchases. "Thank you, come again!"`);
    activeShopSession.mode = "browse";
    closeShopUI();
  });

  const GEM_APPRAISE_FEE = 10;

  const APPRAISE_FEES = { scroll: 15, potion: 15, wand: 25, ring: 30, neck: 30 };
  function getAppraiseFee(info) {
    if (!info) return 0;
    return APPRAISE_FEES[String(info.type || "").toLowerCase()]
      || APPRAISE_FEES[String(info.slot || "").toLowerCase()]
      || 20;
  }

  addEventListener("ui:requestGemAppraise", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isPlayerAdjacentToEntity(Number(shopkeeperId) || 0)) {
      log("The gem merchant is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;
    if (!inventoryContains(world, pe.id, itemId)) return;

    const info = world.get(itemId, ItemInfo);
    if (!info || String(info.type || "") !== "gem") {
      log("The merchant only appraises gems.");
      return;
    }

    const identity = world.get(itemId, NamedIdentity)?.identity;
    if (!identity || isIdentified(identity)) {
      log("That gem is already known to you.");
      return;
    }

    const gold = playerGoldCount();
    if (gold < GEM_APPRAISE_FEE) {
      log(`The merchant charges ${GEM_APPRAISE_FEE} gold to appraise a gem. You cannot afford it.`);
      return;
    }

    if (!spendGold(pe.id, GEM_APPRAISE_FEE)) {
      log("You cannot afford the appraisal fee.");
      return;
    }

    identify(identity);
    const newName = resolveItemDisplayName(world, itemId);
    log(`The merchant examines the stone. "Ah — ${bracketizeName(newName)}." (${GEM_APPRAISE_FEE} gold)`);

    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.5, shop.sellDiscount ?? 0.5, activeShopSession.mode);
  });

  addEventListener("ui:requestAppraise", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId, itemId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isPlayerAdjacentToEntity(Number(shopkeeperId) || 0)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;
    if (!inventoryContains(world, pe.id, itemId)) return;

    const info = world.get(itemId, ItemInfo);
    if (!info || !requiresIdentification(info)) {
      log("That item does not need identification.");
      return;
    }

    const identity = world.get(itemId, NamedIdentity)?.identity;
    if (!identity || isIdentified(identity)) {
      log("You already know what that is.");
      return;
    }

    const fee = getAppraiseFee(info);
    const gold = playerGoldCount();
    if (gold < fee) {
      log(`The shopkeeper charges ${fee} gold to identify that. You cannot afford it.`);
      return;
    }

    if (!spendGold(pe.id, fee)) {
      log("You cannot afford the identification fee.");
      return;
    }

    identify(identity);
    const newName = resolveItemDisplayName(world, itemId);
    log(`The shopkeeper examines the item carefully. "This is ${bracketizeName(newName)}." (${fee} gold)`);

    world.emit("item:identified", {
      actor: pe.id,
      identity,
      name: newName,
      appearance: getUnidentifiedName(info) || "item",
      category: String(info.type || info.slot || "item"),
    });

    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5, activeShopSession.mode);
  });

  const api = Object.freeze({
    handlePlayerMoved() {
      if (activeShopSession.shopkeeperId > 0 && !isPlayerAdjacentToEntity(activeShopSession.shopkeeperId)) {
        closeShopUI();
      }
    },
  });

  world[API_KEY] = api;
  return api;
}
