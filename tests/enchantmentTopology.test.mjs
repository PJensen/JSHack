import { assert, assertEquals } from "jsr:@std/assert";
import { children } from "../src/lib/ecs-js/index.js";
import { World } from "../src/lib/ecs-js/index.js";
import { AffixTopologyNode } from "../src/rules/components/AffixTopologyNode.js";
import { Charges } from "../src/rules/components/Charges.js";
import { EnchantmentNode } from "../src/rules/components/EnchantmentNode.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { ProcNode } from "../src/rules/components/ProcNode.js";
import { ProcPackageNode } from "../src/rules/components/ProcPackageNode.js";
import { Source } from "../src/rules/components/Source.js";
import { ensureAffixTopology } from "../src/rules/utils/affixTopology.js";
import { attachEnchantmentNode } from "../src/rules/utils/enchantmentTopology.js";
import { descendantsWith, firstChildWith } from "../src/rules/utils/topology.js";

function makeItem(world) {
  const item = world.create();
  world.add(item, ItemInfo, { type: "equip", slot: "weapon", affixes: [] });
  return item;
}

Deno.test("attachEnchantmentNode creates affix-backed runtime enchantment subtree", () => {
  const world = new World({ seed: 7301 });
  const item = makeItem(world);
  const source = world.create();

  const enchantment = attachEnchantmentNode(world, item, {
    defId: "ench.firestorm",
    affixId: "firestorm1",
    level: 2,
    sourceKind: "scroll",
    sourceId: source,
    sourceKey: "scroll_enchant_fire",
    charges: 3,
    maxCharges: 5,
  });

  assert(enchantment > 0, "enchantment should be created");
  assertEquals(firstChildWith(world, item, EnchantmentNode), [
    enchantment,
    { defId: "ench.firestorm", level: 2 },
  ]);
  assertEquals(world.get(enchantment, Source), {
    kind: "scroll",
    id: source,
    key: "scroll_enchant_fire",
  });
  assertEquals(world.get(enchantment, Charges), { current: 3, max: 5 });

  const affixes = [...descendantsWith(world, enchantment, AffixTopologyNode)];
  assertEquals(affixes.length, 1);
  assertEquals(affixes[0][1].affixId, "firestorm1");
  assert([...descendantsWith(world, enchantment, ProcNode)].length > 0, "affix triggers should attach proc nodes");
  assertEquals(world.get(item, ItemInfo).affixes, [], "runtime node should not mutate legacy affix array");
});

Deno.test("attachEnchantmentNode can attach proc package topology under enchantment", () => {
  const world = new World({ seed: 7302 });
  const item = makeItem(world);

  const enchantment = attachEnchantmentNode(world, item, {
    defId: "ench.grave_current",
    procPackageId: "graveCurrent",
  });

  const packageNodes = [...descendantsWith(world, enchantment, ProcPackageNode)];
  assertEquals(packageNodes.length, 1);
  assertEquals(packageNodes[0][1].packageId, "graveCurrent");
  assert([...children(world, enchantment)].length > 0, "enchantment should own runtime children");
});

Deno.test("ensureAffixTopology replaces existing affix children without accumulating stale topology", () => {
  const world = new World({ seed: 7303 });
  const item = makeItem(world);
  world.get(item, ItemInfo).affixes = ["stunning1", "firestorm1"];

  for (let i = 0; i < 20; i++) ensureAffixTopology(world, item);

  const affixes = [...children(world, item)]
    .filter((childId) => world.get(childId, AffixTopologyNode))
    .map((childId) => world.get(childId, AffixTopologyNode).affixId)
    .sort();

  assertEquals(affixes, ["firestorm1", "stunning1"]);
  assert([...descendantsWith(world, item, ProcNode)].length > 0, "replacement topology should retain proc nodes");
});
