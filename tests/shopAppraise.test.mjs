import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installShopWiring } from "../src/main/wiring/shopWiring.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { ShopInventory } from "../src/rules/components/ShopInventory.js";
import { isIdentified, resetIdentification } from "../src/rules/data/identification.js";
import { addToInventory, inventoryItems } from "../src/rules/utils/inventoryFacade.js";

function playerGold(world, playerId) {
  let total = 0;
  for (const id of inventoryItems(world, playerId)) {
    const info = world.get(id, ItemInfo);
    if (info?.type === "currency") total += Number(info.count || 0);
  }
  return total;
}

Deno.test("shop appraise tab identifies eligible items, charges fee, and updates shop data", () => {
  resetIdentification();

  const priorWindow = globalThis.window;
  // @ts-ignore test runtime may not define window
  globalThis.window = globalThis;

  const world = new World({ seed: 0xA77A77 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });
  world.add(playerId, Inventory, { capacity: 20 });

  const shopkeeperId = world.create();
  world.add(shopkeeperId, Position, { x: 11, y: 10 });
  world.add(shopkeeperId, ShopInventory, { buyMarkup: 1.3, sellDiscount: 0.5 });

  const goldStackA = world.create();
  world.add(goldStackA, ItemInfo, { type: "currency", count: 10 });
  addToInventory(world, playerId, goldStackA);

  const scrollId = world.create();
  world.add(scrollId, NamedIdentity, { identity: "scroll_identify", name: "Scroll of Identify" });
  world.add(scrollId, ItemInfo, {
    type: "scroll",
    slot: "bag",
    value: 60,
    description: "A parchment marked with arcane sigils",
    count: 1,
    rarity: 1,
    rarityName: "common",
    affixes: [],
    bonuses: {},
  });
  addToInventory(world, playerId, scrollId);

  const shopDataEvents = [];
  const identifiedEvents = [];
  const onShopData = (ev) => shopDataEvents.push(ev?.detail || null);
  const onIdentified = (ev) => identifiedEvents.push(ev || null);
  addEventListener("ui:shopData", onShopData);
  world.on("item:identified", onIdentified);

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

    world.emit("shop:open", {
      actor: playerId,
      targetId: shopkeeperId,
      buyMarkup: 1.3,
      sellDiscount: 0.5,
      vendorKind: "general",
    });

    const initialData = shopDataEvents.at(-1);
    assert(initialData, "shop data should be dispatched when shop opens");
    assertEquals(initialData.appraisableItems.length, 1, "one item should be appraisable");
    assertEquals(initialData.appraisableItems[0].id, scrollId);
    assertEquals(initialData.appraisableItems[0].appraiseFee, 15, "scroll appraisal fee should be 15");
    assertEquals(initialData.gold, 10, "initial gold should be reported");

    dispatchEvent(new CustomEvent("ui:requestAppraise", {
      detail: { shopkeeperId, itemId: scrollId },
    }));

    assertEquals(isIdentified("scroll_identify"), false, "item should stay unidentified when gold is insufficient");
    assertEquals(playerGold(world, playerId), 10, "gold should be unchanged after failed appraisal");

    const goldStackB = world.create();
    world.add(goldStackB, ItemInfo, { type: "currency", count: 10 });
    addToInventory(world, playerId, goldStackB);

    dispatchEvent(new CustomEvent("ui:requestAppraise", {
      detail: { shopkeeperId, itemId: scrollId },
    }));

    assertEquals(isIdentified("scroll_identify"), true, "item should be identified after successful appraisal");
    assertEquals(playerGold(world, playerId), 5, "appraisal should deduct 15 gold");
    assertEquals(identifiedEvents.length, 1, "item:identified event should fire exactly once");

    const refreshedData = shopDataEvents.at(-1);
    assert(refreshedData, "shop data should refresh after appraisal");
    assertEquals(refreshedData.gold, 5, "refreshed shop data should include deducted gold");
    assertEquals(refreshedData.appraisableItems.length, 0, "identified item should leave appraise tab list");
  } finally {
    removeEventListener("ui:shopData", onShopData);
    resetIdentification();
    if (typeof priorWindow === "undefined") {
      // @ts-ignore restore no-window state
      delete globalThis.window;
    } else {
      // @ts-ignore restore prior window reference
      globalThis.window = priorWindow;
    }
  }
});
