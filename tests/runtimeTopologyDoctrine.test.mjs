import { assert, assertEquals } from "jsr:@std/assert";

const KNOWN_LEGACY_ARRAYS = Object.freeze([
  "ActiveEffects.effects[]",
  "ItemInfo.affixes",
  "socket arrays",
  "Equipment",
]);

async function read(path) {
  return await Deno.readTextFile(new URL(path, import.meta.url));
}

Deno.test("runtime topology doctrine documents known legacy compatibility arrays", async () => {
  const doctrine = await read("../RUNTIME_TOPOLOGY_DOCTRINE.md");
  const agents = await read("../AGENTS.md");

  for (const legacy of KNOWN_LEGACY_ARRAYS) {
    const needle = legacy.replace("[]", "");
    assert(
      doctrine.includes(needle) || agents.includes(needle),
      `expected doctrine or AGENTS to mention legacy compatibility state: ${legacy}`,
    );
  }
});

Deno.test("runtime topology work items track current migration status", async () => {
  const workItems = await read("../RUNTIME_TOPOLOGY_WORK_ITEMS.md");
  for (let i = 1; i <= 12; i++) {
    const section = new RegExp(`## ${i}\\. [\\s\\S]*?Status: \`Done\``);
    assert(section.test(workItems), `work item ${i} should be marked Done`);
  }
  assert(workItems.includes("## 13. Retire One Legacy Mirror"), "work item 13 remains the next migration gate");
});

Deno.test("runtime topology primitives have canonical rules-layer surfaces", async () => {
  const componentIndex = await read("../src/rules/components/index.js");
  const topology = await read("../src/rules/utils/topology.js");
  const charges = await read("../src/rules/utils/charges.js");
  const equipment = await read("../src/rules/utils/equipmentTopology.js");
  const enchantments = await read("../src/rules/utils/enchantmentTopology.js");

  for (const exported of [
    "StatusEffectNode",
    "TimedEffectNode",
    "EnchantmentNode",
    "EquipmentRoot",
    "EquippedSlotNode",
    "Duration",
    "Source",
    "Charges",
  ]) {
    assert(componentIndex.includes(exported), `component index should export ${exported}`);
  }

  assert(topology.includes("childrenWith"), "topology helper should expose childrenWith");
  assert(charges.includes("resolveCharges"), "charges facade should expose resolveCharges");
  assert(equipment.includes("resolveEquipmentView"), "equipment facade should expose resolveEquipmentView");
  assert(enchantments.includes("attachEnchantmentNode"), "enchantment facade should expose attachEnchantmentNode");
});

Deno.test("runtime topology doctrine has no accidental new work item count drift", async () => {
  const workItems = await read("../RUNTIME_TOPOLOGY_WORK_ITEMS.md");
  const headings = [...workItems.matchAll(/^## \d+\. /gm)];
  assertEquals(headings.length, 14);
});
