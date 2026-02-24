import { createFrom } from "../../lib/ecs-js/archetype.js";
import { GoldStack } from "../../rules/archetypes/Items.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { ShopInventory } from "../../rules/components/ShopInventory.js";
import { Unpaid } from "../../rules/components/Unpaid.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetByIdentity,
} from "../../rules/utils/inventoryStacking.js";
import { resolveItemDisplayName, buildItemDisplayData } from "./itemName.js";
import { isIdentified } from "../../rules/data/identification.js";
import { getUnidentifiedGemValue } from "../../rules/data/gemPricing.js";

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

  let activeShopSession = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5, mode: "browse" };

  function playerGoldCount() {
    const pe = playerEntity(world);
    if (!pe) return 0;
    const inv = world.get(pe.id, Inventory);
    if (!inv) return 0;
    let total = 0;
    for (const id of inv.items) {
      const info = world.get(id, ItemInfo);
      if (info && info.type === "currency") total += info.count || 0;
    }
    return total;
  }

  function spendGold(inv, amount) {
    let remaining = Math.max(0, Number(amount || 0));
    if (remaining <= 0) return true;
    for (const gid of [...inv.items]) {
      const gi = world.get(gid, ItemInfo);
      if (!gi || gi.type !== "currency") continue;
      const have = Math.max(0, Number(gi.count || 0));
      if (have <= 0) continue;
      const spend = Math.min(have, remaining);
      world.mutate(gid, ItemInfo, (r) => { r.count = Math.max(0, (r.count || 0) - spend); });
      remaining -= spend;
      const next = world.get(gid, ItemInfo)?.count || 0;
      if (next <= 0) {
        const idx = inv.items.indexOf(gid);
        if (idx !== -1) inv.items.splice(idx, 1);
        try { world.destroy(gid); } catch {} // ECS: entity may already be destroyed
      }
      if (remaining <= 0) break;
    }
    return remaining <= 0;
  }

  function grantGold(inv, amount) {
    const n = Math.max(0, Number(amount || 0));
    if (n <= 0) return;
    const gid = createFrom(world, GoldStack, {});
    world.mutate(gid, ItemInfo, (r) => { r.count = n; });
    addItemEntityToInventory(world, inv, gid);
  }

  /** Resolve sell value: unidentified gems use appearance-based pricing. */
  function resolveItemSellValue(id) {
    const info = world.get(id, ItemInfo);
    if (!info) return 0;
    if (info.type === 'gem') {
      const ni = world.get(id, NamedIdentity);
      const identity = ni?.identity || '';
      if (!identity || !isIdentified(identity)) {
        return getUnidentifiedGemValue(info.description) || info.value || 0;
      }
    }
    return info.value || 0;
  }

  function buildShopItemDetail(id, markup) {
    const base = buildItemDisplayData(world, id);
    if (!base) return null;
    const info = world.get(id, ItemInfo);
    base.value = info?.value || 0;
    base.buyPrice = Math.ceil((info?.value || 0) * markup);
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
    if (pe) {
      const inv = world.get(pe.id, Inventory);
      if (inv) {
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          if (!info) continue;

          const unpaid = world.get(id, Unpaid);
          if (unpaid && unpaid.shopkeeperId === shopkeeperId) {
            // This is an unpaid item from this shop
            const detail = buildItemDisplayData(world, id) || { id, name: resolveItemDisplayName(world, id) };
            detail.value = info.value || 0;
            detail.price = unpaid.price;
            detail.unpaid = true;
            unpaidItems.push(detail);
            totalBill += unpaid.price;
          } else if (info.type !== "currency") {
            // Regular item for selling
            const sellValue = resolveItemSellValue(id);
            const detail = buildItemDisplayData(world, id) || { id, name: resolveItemDisplayName(world, id) };
            detail.value = sellValue;
            detail.sellPrice = Math.floor(sellValue * sellDiscount);
            playerItems.push(detail);
          }
        }
      }
    }

    try {
      window.dispatchEvent(new CustomEvent("ui:shopData", { detail: {
        shopkeeperId,
        shopItems,
        playerItems,
        unpaidItems,
        totalBill,
        gold: playerGoldCount(),
        buyMarkup,
        sellDiscount,
        mode,
      } }));
    } catch (e) { console.debug('[shopWiring] dispatch ui:shopData:', e); }
  }

  function isPlayerAdjacentToEntity(entityId) {
    const pe = playerEntity(world);
    if (!pe || pe.id <= 0 || !Number.isInteger(entityId) || entityId <= 0) return false;
    const pPos = world.get(pe.id, Position);
    const tPos = world.get(entityId, Position);
    if (!pPos || !tPos) return false;
    const dist = Math.max(Math.abs(pPos.x - tPos.x), Math.abs(pPos.y - tPos.y));
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

  world.on("shop:open", ({ actor, targetId, buyMarkup, sellDiscount }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;
    if (!isPlayerAdjacentToEntity(Number(targetId) || 0)) return;
    log("You approach the shopkeeper.");
    const shop = world.get(targetId, ShopInventory);
    const markup = buyMarkup ?? shop?.buyMarkup ?? 1.0;
    const discount = sellDiscount ?? shop?.sellDiscount ?? 0.5;
    activeShopSession = {
      shopkeeperId: Number(targetId) || 0,
      buyMarkup: markup,
      sellDiscount: discount,
      mode: "browse",
    };
    dispatchShopData(targetId, markup, discount, "browse");
    try { window.dispatchEvent(new CustomEvent("ui:openShop", { detail: { shopkeeperId: targetId, buyMarkup: markup, sellDiscount: discount, mode: "browse" } })); } catch (e) { console.debug('[shopWiring] dispatch ui:openShop:', e); }
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

    const inv = world.get(pe.id, Inventory);
    if (!inv) return;

    // Check inventory capacity
    const identity = world.get(itemId, NamedIdentity)?.identity || "";
    const stackIntoId = identity
      ? findInventoryStackTargetByIdentity(world, inv, identity)
      : 0;
    const hasCapacity = stackIntoId || inv.capacity == null || inv.items.length < inv.capacity;
    if (!hasCapacity) {
      log("Your pack is full.");
      return;
    }

    // Deduct gold across all currency stacks
    if (!spendGold(inv, price)) {
      log("You cannot afford that.");
      return;
    }

    // Remove from floor and add to inventory
    try { world.remove(itemId, Position); } catch {} // ECS: may not exist
    // Remove unpaid status (item is now paid for)
    try { world.remove(itemId, Unpaid); } catch {} // ECS: may not exist
    addItemEntityToInventory(world, inv, itemId);

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

    const sellDiscount = shop.sellDiscount ?? 0.5;
    const sellValue = resolveItemSellValue(itemId);
    const price = Math.floor(sellValue * sellDiscount);

    const inv = world.get(pe.id, Inventory);
    if (!inv) return;
    if (!inv.items.includes(itemId)) return;
    const idx = inv.items.indexOf(itemId);
    if (idx !== -1) inv.items.splice(idx, 1);

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo", "ranged"]) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }

    const resalePrice = Math.ceil((info.value || 0) * (shop.buyMarkup ?? 1.0));
    if (!placeItemOnShopFloor(itemId, shopkeeperId)) {
      log("The shop floor is inaccessible.");
      return;
    }
    if (world.has(itemId, Unpaid)) {
      world.set(itemId, Unpaid, { shopkeeperId, price: resalePrice });
    } else {
      world.add(itemId, Unpaid, { shopkeeperId, price: resalePrice });
    }

    grantGold(inv, price);

    log(`You sell ${bracketizeName(resolveItemDisplayName(world, itemId))} for ${price} gold.`);

    const mode = activeShopSession.mode === "checkout" ? "checkout" : "browse";
    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5, mode);
  });

  // Handle shop exit blocking (triggered when player tries to leave with unpaid items)
  world.on("shop:exit-blocked", ({ actor, shopkeeperId, bill }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;

    log(`The shopkeeper blocks your way! "You owe me ${bill} gold!"`);

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

  addEventListener("ui:removeFromInvoice", (ev) => {
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

    const inv = world.get(pe.id, Inventory);
    if (!inv) return;
    if (!inv.items.includes(itemId)) return;

    const unpaid = world.get(itemId, Unpaid);
    if (!unpaid || unpaid.shopkeeperId !== shopkeeperId) return;

    const idx = inv.items.indexOf(itemId);
    if (idx !== -1) inv.items.splice(idx, 1);

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo", "ranged"]) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }

    placeItemOnShopFloor(itemId, shopkeeperId);
    log(`You return ${bracketizeName(resolveItemDisplayName(world, itemId))} to the shop floor.`);

    const shop = world.get(shopkeeperId, ShopInventory);
    dispatchShopData(shopkeeperId, shop?.buyMarkup ?? 1.0, shop?.sellDiscount ?? 0.5, "checkout");
  });

  // Handle payment of bill
  addEventListener("ui:payBill", (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const { shopkeeperId } = e?.detail || {};
    const pe = playerEntity(world);
    if (!pe) return;
    if (!isPlayerAdjacentToEntity(Number(shopkeeperId) || 0)) {
      log("The shopkeeper is too far away.");
      closeShopUI();
      return;
    }

    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;

    // Calculate total bill
    const inv = world.get(pe.id, Inventory);
    if (!inv) return;

    let totalBill = 0;
    const unpaidItemIds = [];

    for (const itemId of inv.items) {
      const unpaid = world.get(itemId, Unpaid);
      if (unpaid && unpaid.shopkeeperId === shopkeeperId) {
        totalBill += unpaid.price;
        unpaidItemIds.push(itemId);
      }
    }

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
    if (!spendGold(inv, totalBill)) {
      log(`You cannot afford that. You need ${totalBill} gold but only have ${gold}.`);
      return;
    }

    // Remove Unpaid component from all items
    for (const itemId of unpaidItemIds) {
      try {
        world.remove(itemId, Unpaid);
      } catch {} // ECS: may not exist
    }

    log(`You pay ${totalBill} gold for your purchases. "Thank you, come again!"`);
    activeShopSession.mode = "browse";
    closeShopUI();
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
