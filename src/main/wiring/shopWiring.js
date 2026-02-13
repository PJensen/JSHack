import { createFrom } from "../../lib/ecs-js/archetype.js";
import { GoldStack } from "../../rules/archetypes/Items.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { Inventory } from "../../rules/components/Inventory.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Position } from "../../rules/components/Position.js";
import { ShopInventory } from "../../rules/components/ShopInventory.js";

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

  let activeShopSession = { shopkeeperId: 0, buyMarkup: 1.0, sellDiscount: 0.5 };

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

  function dispatchShopData(shopkeeperId, buyMarkup, sellDiscount) {
    const shop = world.get(shopkeeperId, ShopInventory);
    if (!shop) return;
    const shopItems = [];
    for (const id of (shop.items || [])) {
      const detail = buildShopItemDetail(id, buyMarkup);
      if (detail) shopItems.push(detail);
    }
    const pe = playerEntity(world);
    const playerItems = [];
    if (pe) {
      const inv = world.get(pe.id, Inventory);
      if (inv) {
        for (const id of inv.items) {
          const info = world.get(id, ItemInfo);
          if (!info || info.type === "currency") continue;
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
    try {
      window.dispatchEvent(new CustomEvent("ui:shopData", { detail: {
        shopkeeperId, shopItems, playerItems,
        gold: playerGoldCount(),
        buyMarkup, sellDiscount,
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

  function closeShopUI() {
    activeShopSession.shopkeeperId = 0;
    try { window.dispatchEvent(new CustomEvent("ui:closeShop")); } catch {}
  }

  world.on("shop:open", ({ actor, targetId, buyMarkup, sellDiscount }) => {
    const pe = playerEntity(world);
    if (!pe || actor !== pe.id) return;
    if (!isPlayerAdjacentToEntity(Number(targetId) || 0)) return;
    log("You approach the shopkeeper.");
    activeShopSession = {
      shopkeeperId: Number(targetId) || 0,
      buyMarkup: buyMarkup ?? 1.0,
      sellDiscount: sellDiscount ?? 0.5,
    };
    dispatchShopData(targetId, buyMarkup, sellDiscount);
    try { window.dispatchEvent(new CustomEvent("ui:openShop", { detail: { shopkeeperId: targetId, buyMarkup, sellDiscount } })); } catch {}
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

    const buyMarkup = shop.buyMarkup ?? 1.0;
    const price = Math.ceil((info.value || 0) * buyMarkup);
    const gold = playerGoldCount();

    if (gold < price) {
      log("You cannot afford that.");
      return;
    }

    const inv = world.get(pe.id, Inventory);
    if (inv) {
      for (const gid of inv.items) {
        const gi = world.get(gid, ItemInfo);
        if (gi && gi.type === "currency") {
          world.mutate(gid, ItemInfo, (r) => { r.count = (r.count || 0) - price; });
          break;
        }
      }
    }

    const idx = shop.items.indexOf(itemId);
    if (idx !== -1) shop.items.splice(idx, 1);
    if (inv) {
      try { world.remove(itemId, Position); } catch {}
      inv.items.push(itemId);
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You buy ${bracketizeName(itemName)} for ${price} gold.`);

    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5);
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
    if (inv) {
      const idx = inv.items.indexOf(itemId);
      if (idx !== -1) inv.items.splice(idx, 1);
    }

    const eq = world.get(pe.id, Equipment);
    if (eq) {
      for (const slot of ["weapon", "armor", "shield", "ring1", "ring2", "ammo"]) {
        if (eq[slot] === itemId) { eq[slot] = null; break; }
      }
    }

    shop.items.push(itemId);

    if (inv) {
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
    }

    const itemName = world.get(itemId, NamedIdentity)?.name || "item";
    log(`You sell ${bracketizeName(itemName)} for ${price} gold.`);

    dispatchShopData(shopkeeperId, shop.buyMarkup ?? 1.0, shop.sellDiscount ?? 0.5);
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
