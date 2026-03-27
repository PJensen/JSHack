import { assert, assertEquals } from "jsr:@std/assert";
import { World, attach } from "../src/lib/ecs-js/index.js";
import { ActivationGate } from "../src/rules/components/ActivationGate.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ProcEffect } from "../src/rules/components/ProcEffect.js";
import { ProcNode } from "../src/rules/components/ProcNode.js";
import { ProcPackageNode } from "../src/rules/components/ProcPackageNode.js";
import { buildItemDisplayData } from "../src/main/wiring/itemName.js";
import { identify, resetIdentification } from "../src/rules/data/identification.js";

Deno.test("buildItemDisplayData enriches spell-linked items with target effects", () => {
  resetIdentification();
  const world = new World({ seed: 1 });
  const wand = world.create();
  identify("wand_frost"); // Item must be identified to reveal spell details
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

Deno.test("buildItemDisplayData includes proc-node summaries for gear items", () => {
  resetIdentification();
  const world = new World({ seed: 7 });
  const sword = world.create();
  identify("test_proc_sword");
  world.add(sword, NamedIdentity, { identity: "test_proc_sword", name: "Proc Sword" });
  world.add(sword, ItemInfo, {
    type: "equip",
    slot: "weapon",
    count: 1,
    identified: true,
    bonuses: {},
    affixes: [],
  });

  const pkg = world.create();
  world.add(pkg, ProcPackageNode, { packageId: "echoStrike" });
  attach(world, pkg, sword);

  const proc = world.create();
  world.add(proc, ProcNode, { enabled: true, priority: 0 });
  attach(world, proc, pkg);

  const gate = world.create();
  world.add(gate, ActivationGate, { kind: "eventKind", a: "onHit", b: 0, c: "", enabled: true, priority: 0 });
  attach(world, gate, proc);

  const chance = world.create();
  world.add(chance, ActivationGate, { kind: "chance", a: "", b: 0.35, c: "", enabled: true, priority: 0 });
  attach(world, chance, proc);

  const effect = world.create();
  world.add(effect, ProcEffect, { kind: "bonusDamageFlat", a: 1, b: 4, c: "fire", enabled: true, priority: 0 });
  attach(world, effect, proc);

  const data = buildItemDisplayData(world, sword);
  assert(data, "display data should exist");
  assert(Array.isArray(data.procNodes), "procNodes should be present");
  assertEquals(data.procNodes.length, 1);
  assertEquals(data.procNodes[0].source, "Package: Echo Strike");
  assertEquals(data.procNodes[0].trigger, "On Hit");
  assert(data.procNodes[0].qualifiers.includes("35%"), "chance gate should be represented in qualifiers");
  assert(data.procNodes[0].effects.some((line) => String(line).includes("+1-4 Fire Damage")), "effect summary should include damage range and type");
});
