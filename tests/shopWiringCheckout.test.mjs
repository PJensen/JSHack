import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installShopWiring } from "../src/main/wiring/shopWiring.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { ShopInventory } from "../src/rules/components/ShopInventory.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";

Deno.test("shop checkout return works while blocked at exit even when not adjacent", () => {
  const priorWindow = globalThis.window;
  // @ts-ignore Deno test runtime does not always define window, but wiring uses it.
  globalThis.window = globalThis;

  const world = new World({ seed: 0xC0FFEE });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 2, y: 2 });
  world.add(playerId, Inventory, { capacity: 20 });
  world.add(playerId, Equipment, {});

  const shopkeeperId = world.create();
  world.add(shopkeeperId, Position, { x: 15, y: 15 });
  world.add(shopkeeperId, ShopInventory, { buyMarkup: 1.3, sellDiscount: 0.5 });

  const itemId = world.create();
  world.add(itemId, NamedIdentity, { identity: "test_ring", name: "Test Ring" });
  world.add(itemId, ItemInfo, {
    type: "equip",
    slot: "ring",
    weight: 1,
    value: 75,
    description: "",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  world.add(itemId, Unpaid, { shopkeeperId, price: 75 });
  addToInventory(world, playerId, itemId);

  const closeEvents = [];
  const shopDataEvents = [];
  const onClose = (ev) => closeEvents.push(ev);
  const onShopData = (ev) => shopDataEvents.push(ev?.detail || null);

  addEventListener("ui:closeShop", onClose);
  addEventListener("ui:shopData", onShopData);

  try {
    installShopWiring({
      world,
      playerEntity: (w) => {
        const pos = w.get(playerId, Position);
        return pos ? { id: playerId, pos: { x: pos.x, y: pos.y } } : null;
      },
      log: () => {},
      bracketizeName: (s) => s,
    });

    world.emit("shop:exit-blocked", { actor: playerId, shopkeeperId, bill: 75 });

    dispatchEvent(new CustomEvent("ui:removeFromInvoice", {
      detail: { shopkeeperId, itemId },
    }));

    assert(!inventoryContains(world, playerId, itemId), "item should be removed from player inventory");
    const itemPos = world.get(itemId, Position);
    assert(itemPos, "returned item should be placed on shop floor");
    assertEquals(itemPos.x, 15);
    assertEquals(itemPos.y, 15);
    assertEquals(closeEvents.length, 0, "checkout popup should remain open while returning item");

    const lastShopData = shopDataEvents.at(-1) || {};
    assertEquals(lastShopData.mode, "checkout");
    assertEquals(lastShopData.shopkeeperId, shopkeeperId);
  } finally {
    removeEventListener("ui:closeShop", onClose);
    removeEventListener("ui:shopData", onShopData);
    if (typeof priorWindow === "undefined") {
      // @ts-ignore restore no-window state
      delete globalThis.window;
    } else {
      // @ts-ignore restore prior window reference
      globalThis.window = priorWindow;
    }
  }
});
