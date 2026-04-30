import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { attach } from "../src/lib/ecs-js/hierarchy.js";
import { Charges } from "../src/rules/components/Charges.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import {
  addCharges,
  resolveCharges,
  setCharges,
  spendCharges,
} from "../src/rules/utils/charges.js";

function makeWorld() {
  return new World({ seed: 7101 });
}

Deno.test("resolveCharges reads topology charges before legacy item info", () => {
  const world = makeWorld();
  const item = world.create();
  const node = world.create();
  world.add(item, ItemInfo, { charges: 2, maxCharges: 5 });
  world.add(node, Charges, { current: 3, max: 6 });
  attach(world, node, item);

  assertEquals(resolveCharges(world, item), {
    entityId: node,
    current: 3,
    max: 6,
    source: "topology",
  });
});

Deno.test("resolveCharges falls back to legacy item info", () => {
  const world = makeWorld();
  const item = world.create();
  world.add(item, ItemInfo, { charges: 7, maxCharges: 4 });

  assertEquals(resolveCharges(world, item), {
    entityId: item,
    current: 4,
    max: 4,
    source: "legacy",
  });
});

Deno.test("setCharges updates topology and mirrors legacy by default", () => {
  const world = makeWorld();
  const item = world.create();
  const node = world.create();
  world.add(item, ItemInfo, { charges: 1, maxCharges: 5 });
  world.add(node, Charges, { current: 1, max: 5 });
  attach(world, node, item);

  assertEquals(setCharges(world, item, 9, 6), {
    entityId: node,
    current: 6,
    max: 6,
    source: "topology",
  });
  assertEquals(world.get(node, Charges), { current: 6, max: 6 });
  assertEquals(world.get(item, ItemInfo).charges, 6);
  assertEquals(world.get(item, ItemInfo).maxCharges, 6);
});

Deno.test("addCharges and spendCharges use resolved source", () => {
  const world = makeWorld();
  const item = world.create();
  world.add(item, ItemInfo, { charges: 2, maxCharges: 5 });

  assertEquals(addCharges(world, item, 10), {
    entityId: item,
    current: 5,
    max: 5,
    source: "legacy",
  });
  assertEquals(spendCharges(world, item, 3), {
    entityId: item,
    current: 2,
    max: 5,
    source: "legacy",
  });
});
