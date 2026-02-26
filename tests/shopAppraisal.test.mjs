import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createRng } from "../src/lib/ecs-js/rng.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { initGemPricing, resetGemPricing } from "../src/rules/data/gemPricing.js";
import { identify, resetIdentification } from "../src/rules/data/identification.js";
import { appraiseItemValue, getUnidentifiedGemAppraisal } from "../src/rules/utils/shopAppraisal.js";

Deno.test("appraiseItemValue keeps explicit item value", () => {
  const world = new World({ seed: 42 });
  const id = world.create();
  world.add(id, ItemInfo, {
    type: "equip",
    slot: "weapon",
    value: 77,
    bonuses: { attack: 5 },
    damageDice: "2d6",
    rarity: 3,
  });

  assertEquals(appraiseItemValue(world, id), 77);
});

Deno.test("appraiseItemValue estimates value for zero-value equipment", () => {
  const world = new World({ seed: 42 });

  const plain = world.create();
  world.add(plain, ItemInfo, {
    type: "equip",
    slot: "weapon",
    value: 0,
    bonuses: {},
    rarity: 1,
  });

  const strong = world.create();
  world.add(strong, ItemInfo, {
    type: "equip",
    slot: "weapon",
    value: 0,
    bonuses: { attack: 3, critChance: 0.08 },
    damageDice: "1d8",
    rarity: 2,
    affixes: ["affix:fierce"],
  });

  const plainValue = appraiseItemValue(world, plain);
  const strongValue = appraiseItemValue(world, strong);

  assert(plainValue > 0, "plain zero-value equipment should still be appraised");
  assert(strongValue > plainValue, "stronger equipment should appraise above plain equipment");
});

Deno.test("unidentified gem appraisal uses appearance pricing override", () => {
  resetIdentification();
  resetGemPricing();
  initGemPricing(createRng(0xC0FFEE));

  try {
    const world = new World({ seed: 42 });
    const gem = world.create();
    world.add(gem, ItemInfo, {
      type: "gem",
      slot: "bag",
      value: 0,
      description: "Red Gem",
      count: 1,
    });
    world.add(gem, NamedIdentity, {
      name: "Ruby",
      identity: "gem_ruby",
    });

    const unknownValue = getUnidentifiedGemAppraisal(world, gem);
    assert(unknownValue > 0, "pricing table should provide a value for unidentified gem appearance");
    assertEquals(appraiseItemValue(world, gem), 0, "identified-value path keeps explicit gem value when no override is given");
    assertEquals(
      appraiseItemValue(world, gem, { unidentifiedGemValue: unknownValue }),
      unknownValue,
      "explicit unidentified override should be applied",
    );

    identify("gem_ruby");
    assertEquals(getUnidentifiedGemAppraisal(world, gem), 0, "identified gems should not use appearance pricing");
  } finally {
    resetIdentification();
    resetGemPricing();
  }
});

