import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Unpaid } from "../src/rules/components/Unpaid.js";
import { Potion } from "../src/rules/components/Potion.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { executeInteraction } from "../src/rules/interaction/runtime/actionRuntime.js";
import { drinkPipeline } from "../src/rules/interaction/verbs/drinkPipeline.js";
import { addToInventory, inventoryContains } from "../src/rules/utils/inventoryFacade.js";
import { calculateShopDebt } from "../src/rules/utils/shopDebt.js";

function makePotion(world, init = {}) {
  const itemId = world.create();
  world.add(itemId, Potion, {
    name: "Test Potion",
    route: "oral",
    doses: 1,
    channels: [],
    effects: [],
    toxicity: null,
    ...init,
  });
  world.add(itemId, ItemInfo, {
    type: "potion",
    slot: "",
    weight: 1,
    value: 1,
    description: "",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  return itemId;
}

Deno.test("drink runtime returns canonical result and commits queued mechanics", () => {
  const world = new World({ seed: 1234 });
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 50, hp: 30 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const drankEvents = [];
  world.on("drank", (ev) => drankEvents.push(ev));

  const potion = makePotion(world, {
    effects: [{ key: "regen", potency: 2, onset: 0, peak: 0, duration: 4, stack: "add" }],
  });
  addToInventory(world, actor, potion);

  const result = executeInteraction(world, {
    verb: "drink",
    actor,
    primary: potion,
    target: 0,
    params: { stepHint: world.step | 0 },
    pipeline: drinkPipeline,
  });

  assertEquals(result.schemaVersion, 1);
  assertEquals(result.kind, "interaction");
  assertEquals(result.verb, "drink");
  assertEquals(result.ok, true);
  assertEquals(result.canceled, false);
  assert(result.metrics.committedOps > 0);
  assertEquals(drankEvents.length, 1);
  assert(!world.isAlive(potion), "single-dose potion should be consumed");

  const ae = world.get(actor, ActiveEffects);
  assert(ae && ae.effects.length === 1);
  assertEquals(ae.effects[0].key, "regen");
  assertEquals(ae.effects[0].turnsLeft, 4);
});

Deno.test("drink payload can cancel before mechanics and roll back transaction", () => {
  const world = new World({ seed: 9876 });
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 20, hp: 20 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const drankEvents = [];
  world.on("drank", (ev) => drankEvents.push(ev));

  const potion = makePotion(world, {
    effects: [{ key: "regen", potency: 1, onset: 0, peak: 0, duration: 2, stack: "add" }],
  });
  world.add(potion, Unpaid, { shopkeeperId: 9001, price: 30 });
  addToInventory(world, actor, potion);

  const result = executeInteraction(world, {
    verb: "drink",
    actor,
    primary: potion,
    target: 0,
    params: {
      stepHint: world.step | 0,
      payload: {
        beforeDrink(ctx) {
          ctx.cancel({ code: "TEST_BLOCK", message: "blocked in payload" });
        },
      },
    },
    pipeline: drinkPipeline,
  });

  assertEquals(result.ok, false);
  assertEquals(result.canceled, true);
  assertEquals(result.reason, "TEST_BLOCK");
  assertEquals(drankEvents.length, 0, "cancelled drink should emit no drank event");
  assert(world.isAlive(potion), "cancelled action should not consume potion");
  assert(inventoryContains(world, actor, potion), "item should remain in inventory after cancellation");
  assert(!world.get(actor, ActiveEffects), "no effects should commit on cancellation");
  assertEquals(calculateShopDebt(world, actor, 9001), 0, "cancelled drink should create no shop debt");
});

Deno.test("drink payload onDrink can queue mutations via ctx.mutate", () => {
  const world = new World({ seed: 42 });
  const actor = world.create();
  world.add(actor, Vitality, { maxHp: 12, hp: 5 });
  world.add(actor, Inventory, { items: [], maxWeight: 100 });

  const potion = makePotion(world);
  addToInventory(world, actor, potion);

  const result = executeInteraction(world, {
    verb: "drink",
    actor,
    primary: potion,
    target: 0,
    params: {
      stepHint: world.step | 0,
      payload: {
        onDrink(ctx) {
          ctx.mutate.heal(ctx.actor, 3);
          return { healed: 3 };
        },
      },
    },
    pipeline: drinkPipeline,
  });

  assertEquals(result.ok, true);
  assertEquals(result.payload.onDrink.healed, 3);
  assertEquals(world.get(actor, Vitality).hp, 8);
});
