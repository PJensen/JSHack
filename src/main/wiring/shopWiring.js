import { createFrom } from "../../lib/ecs-js/archetype.js";
import { GoldStack } from "../../rules/archetypes/Items.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { ShopInventory } from "../../rules/components/ShopInventory.js";
import { Unpaid } from "../../rules/components/Unpaid.js";

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
    for (const id of inv.items) {
      const info = world.get(id, ItemInfo);
      if (info && info.type === "currency") return info.count || 0;
    }
    return 0;
  }

  function buildShopItemDetail(id, markup) {
    const info = world.get(id, ItemInfo);
    const name = world.get(id, NamedIdentity);
    if (!info) return null;
    return {
      id,
      name: name?.name || info.description || info.type || "item",
      type: info.type,
      slot: info.slot,
      count: info.count || 1,
      value: info.value || 0,
      buyPrice: Math.ceil((info.value || 0) * markup),
      rarityName: info.rarityName || "common",
      description: info.description || "",
      bonuses: info.bonuses || {},
      affixes: Array.isArray(info.affixes) ? info.affixes.slice() : [],
    };
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
            const name = world.get(id, NamedIdentity);
            const detail = {
              id,
              name: name?.name || info.description || info.type || "item",
              type: info.type,
              slot: info.slot,
              count: info.count || 1,
              value: info.value || 0,
              price: unpaid.price,
              unpaid: true,
              rarityName: info.rarityName || "common",
              description: info.description || "",
            };
            unpaidItems.push(detail);
            totalBill += unpaid.price;
          } else if (info.type !== "currency") {
            // Regular item for selling
            const name = world.get(id, NamedIdentity);
            playerItems.push({
              id,
              name: name?.name || info.description || info.type || "item",
              type: info.type,
              slot: info.slot,
              count: info.count || 1,
              value: info.value || 0,
              sellPrice: Math.floor((info.value || 0) * sellDiscount),
              rarityName: info.rarityName || "common",
              description: info.description || "",
            });
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
    } catch {}
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
    try { window.dispatchEvent(new CustomEvent("ui:closeShop")); } catch {}
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
    try { window.dispatchEvent(new CustomEvent("ui:openShop", { detail: { shopkeeperId: targetId, buyMarkup: markup, sellDiscount: discount, mode: "browse" } })); } catch {}
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
    const hasCapacity = inv.capacity == null || inv.items.length < inv.capacity;
    if (!hasCapacity) {
      log("Your pack is full.");
      return;
    }

    // Deduct gold
    for (const gid of inv.items) {
      const gi = world.get(gid, ItemInfo);
      if (gi && gi.type === "currency") {
        world.mutate(gid, ItemInfo, (r) => { r.count = (r.count || 0) - price; });
        break;
      }
    }

    // Remove from floor and add to inventory
    try { world.remove(itemId, Position); } catch {}
    // Remove unpaid status (item is now paid for)
    try { world.remove(itemId, Unpaid); } catch {}
    inv.items.push(itemId);

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You buy ${bracketizeName(itemName)} for ${price} gold.`);

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
    const price = Math.floor((info.value || 0) * sellDiscount);

    const inv = world.get(pe.id, Inventory);
    if (!inv) return;
    if (!inv.items.includes(itemId)) return;
    const idx = inv.items.indexOf(itemId);
    if (idx !== -1) inv.items.splice(idx, 1);

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo"]) {
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

    let found = false;
    for (const gid of inv.items) {
      const gi = world.get(gid, ItemInfo);
      if (gi && gi.type === "currency") {
        world.mutate(gid, ItemInfo, (r) => { r.count = (r.count || 0) + price; });
        found = true;
        break;
      }
    }
    if (!found && price > 0) {
      const gid = createFrom(world, GoldStack, {});
      try { world.remove(gid, Position); } catch {}
      world.mutate(gid, ItemInfo, (r) => { r.count = price; });
      inv.items.push(gid);
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You sell ${bracketizeName(itemName)} for ${price} gold.`);

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
    } catch {}
  });

  // Handle item pickup - notify when picking up unpaid items
  world.on("item:pickup", ({ actor, itemId }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;

    const unpaid = world.get(itemId, Unpaid);
    if (unpaid && unpaid.price > 0) {
      const itemName = world.get(itemId, NamedIdentity)?.name || "item";
      log(`You pick up ${bracketizeName(itemName)} (unpaid, ${unpaid.price} gold).`);
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
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo"]) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }

    placeItemOnShopFloor(itemId, shopkeeperId);
    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You return ${bracketizeName(itemName)} to the shop floor.`);

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

    // Deduct gold
    for (const gid of inv.items) {
      const gi = world.get(gid, ItemInfo);
      if (gi && gi.type === "currency") {
        world.mutate(gid, ItemInfo, (r) => { r.count = (r.count || 0) - totalBill; });
        break;
      }
    }

    // Remove Unpaid component from all items
    for (const itemId of unpaidItemIds) {
      try {
        world.remove(itemId, Unpaid);
      } catch {}
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
