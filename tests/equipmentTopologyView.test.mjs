import { assertEquals } from "jsr:@std/assert";
import { children, getParent, World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { EquipmentRoot } from "../src/rules/components/EquipmentRoot.js";
import { EquippedSlotNode } from "../src/rules/components/EquippedSlotNode.js";
import {
  clearEquippedSlotTopology,
  findEquipmentRoot,
  getOrCreateEquipmentRoot,
  resolveEquipmentView,
  setEquippedSlotTopology,
} from "../src/rules/utils/equipmentTopology.js";

Deno.test("resolveEquipmentView reads legacy equipment slots", () => {
  const world = new World({ seed: 8101 });
  const actor = world.create();
  const sword = world.create();
  world.add(actor, Equipment, { weapon: sword });

  assertEquals(resolveEquipmentView(world, actor).weapon, sword);
  assertEquals(findEquipmentRoot(world, actor), 0);
});

Deno.test("resolveEquipmentView prefers topology over legacy slot cache", () => {
  const world = new World({ seed: 8102 });
  const actor = world.create();
  const legacySword = world.create();
  const topologySword = world.create();
  world.add(actor, Equipment, { weapon: legacySword });

  setEquippedSlotTopology(world, actor, "weapon", topologySword);

  const root = getOrCreateEquipmentRoot(world, actor);
  assertEquals(world.has(root, EquipmentRoot), true);
  assertEquals(resolveEquipmentView(world, actor).weapon, topologySword);
  assertEquals(getParent(world, topologySword), slotNodeFor(world, actor, "weapon"));
});

Deno.test("set and clear equipment topology slots attach through slot nodes", () => {
  const world = new World({ seed: 8103 });
  const actor = world.create();
  const sword = world.create();

  const slotNode = setEquippedSlotTopology(world, actor, "shield", sword);
  assertEquals(world.get(slotNode, EquippedSlotNode), { slot: "offhand" });
  assertEquals(resolveEquipmentView(world, actor).offhand, sword);

  const cleared = clearEquippedSlotTopology(world, actor, "offhand");
  assertEquals(cleared, sword);
  assertEquals(resolveEquipmentView(world, actor).offhand, 0);
});

Deno.test("setting an equipment topology slot replaces the previous child", () => {
  const world = new World({ seed: 8104 });
  const actor = world.create();
  const oldSword = world.create();
  const newSword = world.create();

  const slotNode = setEquippedSlotTopology(world, actor, "weapon", oldSword);
  setEquippedSlotTopology(world, actor, "weapon", newSword);

  assertEquals([...children(world, slotNode)], [newSword]);
  assertEquals(getParent(world, oldSword), actor);
  assertEquals(getParent(world, newSword), slotNode);
  assertEquals(resolveEquipmentView(world, actor).weapon, newSword);
});

function slotNodeFor(world, actor, slot) {
  const root = findEquipmentRoot(world, actor);
  for (const child of children(world, root)) {
    if (world.get(child, EquippedSlotNode)?.slot === slot) return child;
  }
  return 0;
}
