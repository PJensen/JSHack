import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Alignment, LawChaosAxis, GoodEvilAxis } from "../src/rules/components/Alignment.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { evaluateShopExitClaim } from "../src/rules/utils/shopEnforcement.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { recordShopDebt } from "../src/rules/utils/shopDebt.js";

function makeActor(world) {
  const actor = world.create();
  world.add(actor, Inventory, { capacity: 20 });
  return actor;
}

function addGold(world, actor, amount) {
  const gold = world.create();
  world.add(gold, ItemInfo, { type: "currency", count: amount, value: 1 });
  addToInventory(world, actor, gold);
  return gold;
}

function addUnpaidItem(world, actor, shopkeeperId, price) {
  const item = world.create();
  world.add(item, NamedIdentity, { identity: "test_item", name: "Test Item" });
  world.add(item, ItemInfo, { type: "potion", count: 1, value: price });
  world.add(item, Unpaid, { shopkeeperId, price });
  addToInventory(world, actor, item);
  return item;
}

Deno.test("shop enforcement demands payment when actor can pay bill", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const shopkeeperId = 9001;
  addUnpaidItem(world, actor, shopkeeperId, 40);
  addGold(world, actor, 100);

  const decision = evaluateShopExitClaim(world, { actorId: actor, shopkeeperId });

  assertEquals(decision.kind, "demand_payment");
  assertEquals(decision.blocksExit, true);
  assertEquals(decision.bill, 40);
  assertEquals(decision.canPay, true);
});

Deno.test("shop enforcement can extend credit for small extracted-value debt in good standing", () => {
  const world = new World({ seed: 2 });
  const actor = makeActor(world);
  const shopkeeperId = 9001;
  world.add(actor, Alignment, { lawChaos: LawChaosAxis.LAWFUL, goodEvil: GoodEvilAxis.GOOD });
  recordShopDebt(world, {
    actorId: actor,
    shopkeeperId,
    amount: 20,
    reason: "knowledge_theft",
    itemId: 123,
  });

  const decision = evaluateShopExitClaim(world, { actorId: actor, shopkeeperId });

  assertEquals(decision.kind, "credit_extended");
  assertEquals(decision.blocksExit, false);
  assertEquals(decision.bill, 20);
  assertEquals(decision.canPay, false);
});

Deno.test("shop enforcement contains unpaid physical goods when actor cannot pay", () => {
  const world = new World({ seed: 3 });
  const actor = makeActor(world);
  const shopkeeperId = 9001;
  addUnpaidItem(world, actor, shopkeeperId, 25);

  const decision = evaluateShopExitClaim(world, { actorId: actor, shopkeeperId });

  assertEquals(decision.kind, "containment");
  assertEquals(decision.blocksExit, true);
  assertEquals(decision.carriedBill, 25);
  assertEquals(decision.debtTotal, 0);
});

Deno.test("shop enforcement marks aged or repeated debt as refused", () => {
  const world = new World({ seed: 4 });
  const actor = makeActor(world);
  const shopkeeperId = 9001;
  recordShopDebt(world, {
    actorId: actor,
    shopkeeperId,
    amount: 10,
    reason: "knowledge_theft",
    itemId: 1,
    turn: 0,
  });
  world.step = 100;

  const decision = evaluateShopExitClaim(world, { actorId: actor, shopkeeperId });

  assertEquals(decision.kind, "debt_refused");
  assertEquals(decision.blocksExit, true);
  assertEquals(decision.debtAge, 100);
});
