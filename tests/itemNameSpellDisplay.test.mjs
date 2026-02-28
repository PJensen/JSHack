import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { buildItemDisplayData } from "../src/main/wiring/itemName.js";

Deno.test("buildItemDisplayData enriches spell-linked items with target effects", () => {
  const world = new World({ seed: 1 });
  const wand = world.create();
  world.add(wand, NamedIdentity, { identity: "wand_frost", name: "Wand of Frost" });
  world.add(wand, ItemInfo, {
    type: "wand",
    slot: "ranged",
    count: 1,
    rarityName: "rare",
    description: "fallback description",
    bonuses: {},
    affixes: [],
  });

  const data = buildItemDisplayData(world, wand);
  assert(data, "display data should exist");
  assertEquals(data.spellId, "frost");
  assert(Array.isArray(data.detailLines) && data.detailLines.length > 0, "detail lines should be present");
  assert(Array.isArray(data.targetEffects) && data.targetEffects.length > 0, "target effects should be present");
  assert(String(data.description).toLowerCase().includes("winter"), "description should come from spell flavor text");
});
