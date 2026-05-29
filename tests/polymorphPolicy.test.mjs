import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Traits } from "../src/rules/components/Traits.js";
import { getCatalogItem } from "../src/rules/data/itemCatalog.js";
import { getPassiveBonuses } from "../src/rules/utils/passiveBonuses.js";
import { getPolymorphControl } from "../src/rules/utils/polymorphPolicy.js";

function makeActor(world) {
  const actor = world.create();
  world.add(actor, Equipment);
  return actor;
}

function makeRing(world, bonuses = { polymorphControl: 1 }) {
  const ring = world.create();
  world.add(ring, NamedIdentity, { name: "Ring of Polymorph Control", identity: "ring_polymorph_control" });
  world.add(ring, ItemInfo, {
    type: "equip",
    slot: "ring",
    weight: 0.05,
    value: 0,
    description: "",
    count: 1,
    rarity: 4,
    rarityName: "epic",
    bonuses,
    affixes: [],
  });
  return ring;
}

Deno.test("polymorph policy: no trait or equipment means no control", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);

  const control = getPolymorphControl(world, actor);

  assertEquals(control.hasControl, false);
  assertEquals(control.controlScore, 0);
  assertEquals(control.sources.length, 0);
});

Deno.test("polymorph policy: permanent trait grants control", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  world.add(actor, Traits, { polymorph_control: true });

  const control = getPolymorphControl(world, actor);

  assertEquals(control.hasControl, true);
  assertEquals(control.controlScore, 1);
  assert(control.sources.includes("trait:polymorph_control"));
});

Deno.test("polymorph policy: equipped ring bonus grants control through passive bonuses", () => {
  const world = new World({ seed: 1 });
  const actor = makeActor(world);
  const ring = makeRing(world);
  world.get(actor, Equipment).ring1 = ring;

  const passive = getPassiveBonuses(world, actor);
  const control = getPolymorphControl(world, actor);

  assertEquals(passive.polymorphControlDerived, 1);
  assertEquals(control.hasControl, true);
  assertEquals(control.controlScore, 1);
  assert(control.sources.includes("ring_polymorph_control"));
});

Deno.test("ring of polymorph control content defines the passive control bonus", () => {
  const ring = getCatalogItem("ring_polymorph_control");

  assert(ring, "ring should be registered in the item catalog");
  assertEquals(ring.name, "Ring of Polymorph Control");
  assertEquals(ring.type, "equip");
  assertEquals(ring.slot, "ring");
  assertEquals(ring.bonuses?.polymorphControl, 1);
});

