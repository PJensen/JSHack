import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getParent } from "../src/lib/ecs-js/hierarchy.js";
import { ShopDebt } from "../src/rules/components/ShopDebt.js";
import { defineShopDebtVirtuals, getShopDebtView, getShopDebtViewVirtual, calculateShopDebt, clearShopDebt, recordShopDebt, shopDebtRecords } from "../src/rules/utils/shopDebt.js";
import { installVirtuals } from "../src/rules/utils/inventoryVirtuals.js";

Deno.test("shop debt records are typed child entities attached to the debtor", () => {
  const world = new World({ seed: 11 });
  const actorId = world.create();

  const debt = recordShopDebt(world, {
    actorId,
    shopkeeperId: 9001,
    amount: 120,
    reason: "knowledge_theft",
    itemId: 42,
    identity: "book_lightning",
    name: "Spellbook of Lightning",
    turn: 7,
  });

  assert(debt && debt.id > 0, "recordShopDebt should return the created debt fact");
  assertEquals(getParent(world, debt.id), actorId, "debt entity should be attached under debtor");

  const comp = world.get(debt.id, ShopDebt);
  assert(comp, "debt entity should have ShopDebt component");
  assertEquals(comp.amount, 120);
  assertEquals(comp.reason, "knowledge_theft");
  assertEquals(comp.createdTurn, 7);

  assertEquals(calculateShopDebt(world, actorId, 9001), 120);
  assertEquals(calculateShopDebt(world, actorId, 9002), 0);
  assertEquals(shopDebtRecords(world, actorId, 9001).length, 1);
});

Deno.test("shop debt virtual aggregates child debts and invalidates on record and clear", () => {
  const world = new World({ seed: 12 });
  installVirtuals(world);
  defineShopDebtVirtuals(world);

  const actorId = world.create();
  const DebtView = getShopDebtViewVirtual(world);
  assert(DebtView, "shop debt virtual should be defined");

  const emptyView = getShopDebtView(world, actorId);
  assertEquals(emptyView.total, 0);

  const first = recordShopDebt(world, {
    actorId,
    shopkeeperId: 9001,
    amount: 50,
    reason: "knowledge_theft",
    itemId: 1,
  });
  assert(first && first.id > 0, "first debt should be created");

  const afterFirst = getShopDebtView(world, actorId);
  assertEquals(afterFirst.total, 50, "recordShopDebt should invalidate same-step virtual cache");
  assertEquals(afterFirst.byShopkeeper["9001"].total, 50);

  const second = recordShopDebt(world, {
    actorId,
    shopkeeperId: 9002,
    amount: 25,
    reason: "consumption_theft",
    itemId: 2,
  });
  assert(second && second.id > 0, "second debt should be created");

  const afterSecond = getShopDebtView(world, actorId);
  assertEquals(afterSecond.total, 75);
  assertEquals(calculateShopDebt(world, actorId, 9001), 50);
  assertEquals(calculateShopDebt(world, actorId, 9002), 25);

  assertEquals(clearShopDebt(world, actorId, 9001), 1);
  const afterClear = getShopDebtView(world, actorId);
  assertEquals(afterClear.total, 25, "clearShopDebt should invalidate same-step virtual cache");
  assertEquals(calculateShopDebt(world, actorId, 9001), 0);
  assertEquals(calculateShopDebt(world, actorId, 9002), 25);
  assert(!world.isAlive(first.id), "cleared debt entity should be destroyed");
  assert(world.isAlive(second.id), "unmatched debt entity should remain");
});
